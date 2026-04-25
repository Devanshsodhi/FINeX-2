"""Gmail action — create a draft reply (same threading logic as reply_to_email)."""

from __future__ import annotations

import re
from typing import Any

from app.services.tools.context import Context

from ._utils import (
    build_mime_message,
    build_references,
    build_reply_recipients,
    encode_raw,
    fetch_headers_and_thread,
    parse_raw_message,
    reply_subject,
    run_blocking,
)


_TAG_RE = re.compile(r"<[^>]*>")
_ENTITY_REPLACEMENTS = {
    "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"',
}


def _html_to_text(html: str) -> str:
    text = _TAG_RE.sub("", html)
    for entity, replacement in _ENTITY_REPLACEMENTS.items():
        text = text.replace(entity, replacement)
    return text


async def create_draft_reply(
    ctx: Context,
    client: Any,
    args: dict[str, Any],
) -> dict[str, Any]:
    message_id = args["message_id"]
    reply_type = args.get("reply_type", "reply")
    body_type = args.get("body_type", "plain_text")
    include_original = args.get("include_original_message", True)
    draft_body = args.get("body", "") or ""

    original = await fetch_headers_and_thread(client, message_id)
    headers = original["headers"]
    thread_id = original["thread_id"]

    # Optionally pull the original body to quote below the new reply.
    quoted_original = ""
    if include_original:
        try:
            raw_resp = await run_blocking(
                lambda: client.users()
                .messages()
                .get(userId="me", id=message_id, format="raw")
                .execute()
            )
            parsed = parse_raw_message(raw_resp["raw"])
            source_text = parsed.get("text") or (
                _html_to_text(parsed.get("html")) if parsed.get("html") else ""
            )
            if source_text:
                quoted_lines = [f"> {line.strip()}" for line in source_text.split("\n")]
                quoted_original = f"On {headers.get('date', '')}, {headers.get('from', '')} wrote:\n" + "\n".join(quoted_lines)
        except Exception:
            quoted_original = (
                f"On {headers.get('date', '')}, {headers.get('from', '')} wrote:\n"
                f"> [Original message content could not be parsed]"
            )

    to_list, cc_list = await build_reply_recipients(client, headers, reply_type)

    if include_original and quoted_original:
        if body_type == "html":
            separator = "<br><br>--- Original Message ---<br>"
            quoted_for_body = quoted_original.replace("\n", "<br>")
        else:
            separator = "\n\n--- Original Message ---\n"
            quoted_for_body = quoted_original
        draft_body = f"{draft_body}{separator}{quoted_for_body}" if draft_body else quoted_for_body

    mime_msg = build_mime_message(
        {
            "to": to_list,
            "cc": cc_list,
            "subject": reply_subject(headers.get("subject", "")),
            "body": draft_body,
            "body_type": body_type,
            "sender_name": args.get("sender_name"),
            "attachments": args.get("attachments"),
            "extra_headers": {
                "In-Reply-To": headers.get("message-id", ""),
                "References": build_references(
                    headers.get("message-id", ""),
                    headers.get("references", ""),
                ),
            },
        }
    )
    raw = encode_raw(mime_msg)

    draft_msg: dict[str, Any] = {"raw": raw}
    if thread_id:
        draft_msg["threadId"] = thread_id

    result = await run_blocking(
        lambda: client.users()
        .drafts()
        .create(userId="me", body={"message": draft_msg})
        .execute()
    )

    return {
        "draft_id": result.get("id"),
        "message_id": (result.get("message") or {}).get("id"),
        "thread_id": thread_id,
        "replied_to": message_id,
        "reply_type": reply_type,
        "recipients": {"to": to_list, "cc": cc_list},
    }
