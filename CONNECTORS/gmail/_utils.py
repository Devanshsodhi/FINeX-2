"""Shared helpers for Gmail actions: MIME build/parse, async wrapper, reply utils."""

from __future__ import annotations

import base64
import email
from email import policy
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from typing import Any, Callable, TypeVar

from app.services.tools.connectors._google_utils import run_blocking

T = TypeVar("T")


def ensure_list(value: Any) -> list[str]:
    """Normalise str / list / None → list of non-empty trimmed strings."""
    if value is None:
        return []
    if isinstance(value, str):
        parts = [p.strip() for p in value.split(",")]
    else:
        parts = [str(p).strip() for p in value]
    return [p for p in parts if p]


def _format_from(sender_email: str | None, sender_name: str | None) -> str | None:
    if not sender_email:
        return None
    if sender_name:
        return formataddr((sender_name, sender_email))
    return sender_email


def build_mime_message(args: dict[str, Any]) -> MIMEBase:
    """Build a MIME message from an action's args dict."""
    body = args.get("body", "")
    subtype = "html" if args.get("body_type") == "html" else "plain"
    attachments = args.get("attachments") or []

    # SMTP policy → CRLF line endings + RFC 2047 encoding for non-ASCII headers (subjects with é, emoji, etc).
    if attachments:
        msg: MIMEBase = MIMEMultipart(policy=policy.SMTP)
        msg.attach(MIMEText(body, subtype, "utf-8", policy=policy.SMTP))
        for att in attachments:
            _attach(msg, att)
    else:
        msg = MIMEText(body, subtype, "utf-8", policy=policy.SMTP)

    to_list = ensure_list(args.get("to"))
    cc_list = ensure_list(args.get("cc"))
    bcc_list = ensure_list(args.get("bcc"))
    reply_to_list = ensure_list(args.get("reply_to"))

    if to_list:
        msg["To"] = ", ".join(to_list)
    if cc_list:
        msg["Cc"] = ", ".join(cc_list)
    if bcc_list:
        msg["Bcc"] = ", ".join(bcc_list)
    if reply_to_list:
        msg["Reply-To"] = ", ".join(reply_to_list)

    if subject := args.get("subject"):
        msg["Subject"] = subject

    if from_header := _format_from(args.get("from"), args.get("sender_name")):
        msg["From"] = from_header

    for key, value in (args.get("extra_headers") or {}).items():
        if value is None:
            continue
        msg[key] = value

    return msg


def _attach(msg: MIMEBase, att: dict[str, Any]) -> None:
    from email.mime.application import MIMEApplication

    filename = att.get("filename") or "attachment"
    content = att["content_bytes"]
    mime_type = att.get("mime_type")

    part = (
        MIMEApplication(content, _subtype=mime_type, policy=policy.SMTP)
        if mime_type
        else MIMEApplication(content, policy=policy.SMTP)
    )
    part.add_header("Content-Disposition", "attachment", filename=filename)
    msg.attach(part)


def encode_raw(msg: MIMEBase) -> str:
    """URL-safe base64 of the MIME bytes — the shape Gmail expects in `raw`."""
    return base64.urlsafe_b64encode(msg.as_bytes()).decode("ascii")


def parse_raw_message(raw_b64: str) -> dict[str, Any]:
    """Decode Gmail's `raw` response into headers + text/html bodies + attachments."""
    raw_bytes = base64.urlsafe_b64decode(raw_b64.encode("ascii"))
    message = email.message_from_bytes(raw_bytes, policy=policy.default)

    headers = {k.lower(): str(v) for k, v in message.items()}
    text_body: str | None = None
    html_body: str | None = None
    attachments: list[dict[str, Any]] = []

    for part in message.walk():
        if part.is_multipart():
            continue
        disposition = (part.get("Content-Disposition") or "").lower()
        content_type = part.get_content_type()

        if "attachment" in disposition or (not content_type.startswith("text/") and part.get_filename()):
            attachments.append(
                {
                    "filename": part.get_filename(),
                    "mime_type": content_type,
                    "content_bytes": part.get_payload(decode=True) or b"",
                }
            )
            continue

        if content_type == "text/plain" and text_body is None:
            text_body = part.get_content()
        elif content_type == "text/html" and html_body is None:
            html_body = part.get_content()

    return {
        "headers": headers,
        "subject": headers.get("subject", ""),
        "from": headers.get("from", ""),
        "to": headers.get("to", ""),
        "cc": headers.get("cc", ""),
        "bcc": headers.get("bcc", ""),
        "date": headers.get("date", ""),
        "message_id": headers.get("message-id", ""),
        "text": text_body,
        "html": html_body,
        "attachments": attachments,
    }


def extract_body_from_payload(payload: dict[str, Any]) -> str:
    """Walk a Gmail format='full' payload tree and return the first text/plain body found."""
    mime_type = payload.get("mimeType", "")
    if mime_type == "text/plain":
        data = (payload.get("body") or {}).get("data")
        if data:
            return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")

    for part in payload.get("parts") or []:
        body = extract_body_from_payload(part)
        if body:
            return body

    # Fall back to text/html if no plain text exists.
    if mime_type == "text/html":
        data = (payload.get("body") or {}).get("data")
        if data:
            return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")

    return ""


def extract_headers_from_payload(payload: dict[str, Any], names: list[str]) -> dict[str, str]:
    """Pull specific headers from a payload's headers list (case-insensitive match)."""
    wanted = {n.lower(): n for n in names}
    out: dict[str, str] = {}
    for h in payload.get("headers") or []:
        key = (h.get("name") or "").lower()
        if key in wanted:
            out[wanted[key]] = h.get("value", "")
    return out


async def fetch_headers_and_thread(client: Any, message_id: str) -> dict[str, Any]:
    """Fetch just the headers + threadId of a message (used by reply-style actions)."""
    def _do() -> Any:
        return (
            client.users()
            .messages()
            .get(
                userId="me",
                id=message_id,
                format="metadata",
                metadataHeaders=[
                    "Subject", "From", "To", "Cc", "Reply-To",
                    "Message-ID", "References", "Date",
                ],
            )
            .execute()
        )

    response = await run_blocking(_do)
    headers_list = (response.get("payload") or {}).get("headers") or []
    header_map = {h["name"].lower(): h["value"] for h in headers_list if h.get("name")}
    return {"thread_id": response.get("threadId"), "headers": header_map}


async def get_user_email(client: Any) -> str:
    """Authenticated user's primary email address."""
    profile = await run_blocking(lambda: client.users().getProfile(userId="me").execute())
    return profile.get("emailAddress", "")


async def build_reply_recipients(
    client: Any,
    headers: dict[str, str],
    reply_type: str,
) -> tuple[list[str], list[str]]:
    """Pick (to, cc) for a reply based on original headers and reply_type."""
    to_list: list[str] = []
    cc_list: list[str] = []

    primary_sender = headers.get("reply-to") or headers.get("from", "")
    if primary_sender:
        to_list.append(primary_sender)

    if reply_type == "reply_all":
        me = await get_user_email(client)
        to_list.extend(addr for addr in ensure_list(headers.get("to")) if me not in addr)
        cc_list.extend(addr for addr in ensure_list(headers.get("cc")) if me not in addr)

    return to_list, cc_list


def reply_subject(original: str) -> str:
    return original if original.lower().startswith("re:") else f"Re: {original}"


def build_references(original_message_id: str, original_references: str) -> str:
    return f"{original_references} {original_message_id}".strip() if original_references else original_message_id


# System label IDs (where id == name). Anything else is either Label_* (user) or a name.
SYSTEM_LABEL_IDS = {
    "INBOX", "SENT", "DRAFT", "SPAM", "TRASH",
    "UNREAD", "STARRED", "IMPORTANT", "CHAT",
    "CATEGORY_PERSONAL", "CATEGORY_SOCIAL", "CATEGORY_PROMOTIONS",
    "CATEGORY_UPDATES", "CATEGORY_FORUMS",
}


def _looks_like_label_id(value: str) -> bool:
    return value in SYSTEM_LABEL_IDS or value.startswith("Label_")


async def resolve_label_ids(client: Any, names_or_ids: list[str]) -> list[str]:
    """Convert label names → IDs. Values already shaped like an ID pass through."""
    if not names_or_ids:
        return []

    # Fast path: skip the API call when everything is already an ID.
    if all(_looks_like_label_id(v) for v in names_or_ids):
        return list(names_or_ids)

    response = await run_blocking(
        lambda: client.users().labels().list(userId="me").execute()
    )
    # Lowercased name → real id, so lookups are case-insensitive ("early-leaves" matches "Early-leaves").
    name_to_id = {lbl["name"].lower(): lbl["id"] for lbl in response.get("labels") or []}

    resolved: list[str] = []
    for v in names_or_ids:
        if _looks_like_label_id(v):
            resolved.append(v)
        elif (real_id := name_to_id.get(v.lower())) is not None:
            resolved.append(real_id)
        else:
            raise ValueError(
                f"No label found with name or id '{v}'. "
                f"Run list_labels to see available labels."
            )
    return resolved
