"""Gmail action — search with structured filters, return slim parsed matches."""

from __future__ import annotations

from typing import Any

from app.services.tools.context import Context

from ._utils import extract_body_from_payload, extract_headers_from_payload, run_blocking


def _build_query(args: dict[str, Any]) -> str:
    parts: list[str] = []

    if (v := args.get("from")) and v.strip():
        parts.append(f"from:({v.strip()})")
    if (v := args.get("to")) and v.strip():
        parts.append(f"to:({v.strip()})")
    if (v := args.get("subject")) and v.strip():
        parts.append(f"subject:({v.strip()})")
    if (v := args.get("content")) and v.strip():
        parts.append(f'"{v.strip()}"')

    if args.get("has_attachment"):
        parts.append("has:attachment")
    if (v := args.get("attachment_name")) and v.strip():
        parts.append(f"filename:({v.strip()})")

    if (v := args.get("label")) and str(v).strip():
        parts.append(f"label:{str(v).strip()}")
    if (v := args.get("category")) and v.strip():
        parts.append(f"category:{v.strip()}")

    if v := args.get("after_date"):
        parts.append(f"after:{_to_gmail_date(v)}")
    if v := args.get("before_date"):
        parts.append(f"before:{_to_gmail_date(v)}")

    return " ".join(parts)


def _to_gmail_date(raw: str) -> str:
    # Gmail expects YYYY/MM/DD; accept YYYY-MM-DD or ISO-8601.
    return raw[:10].replace("-", "/")


async def search_email(
    ctx: Context,
    client: Any,
    args: dict[str, Any],
) -> dict[str, Any]:
    query = _build_query(args)
    if not query.strip():
        raise ValueError("search_email requires at least one filter argument")

    max_results = max(1, min(int(args.get("max_results", 10) or 10), 500))
    include_spam = bool(args.get("include_spam_trash"))

    list_response = await run_blocking(
        lambda: client.users()
        .messages()
        .list(
            userId="me",
            q=query,
            maxResults=max_results,
            includeSpamTrash=include_spam,
        )
        .execute()
    )

    messages = list_response.get("messages") or []
    if not messages:
        return {"found": False, "count": 0, "messages": []}

    # Serial fetch — googleapiclient's service object is not thread-safe.
    # format='full' (vs 'raw') skips downloading attachment bytes — much faster on big messages.
    detailed: list[dict[str, Any]] = []
    for msg in messages:
        msg_id = msg["id"]
        try:
            full_resp = await run_blocking(
                lambda mid=msg_id: client.users()
                .messages()
                .get(userId="me", id=mid, format="full")
                .execute()
            )
            payload = full_resp.get("payload") or {}
            headers = extract_headers_from_payload(
                payload, ["Subject", "From", "To", "Cc", "Date"]
            )
            detailed.append(
                {
                    "id": msg_id,
                    "thread_id": full_resp.get("threadId"),
                    "subject": headers.get("Subject", ""),
                    "from": headers.get("From", ""),
                    "to": headers.get("To", ""),
                    "cc": headers.get("Cc", ""),
                    "date": headers.get("Date", ""),
                    "body": extract_body_from_payload(payload),
                }
            )
        except Exception as exc:
            detailed.append(
                {
                    "id": msg_id,
                    "thread_id": msg.get("threadId"),
                    "error": f"Failed to retrieve message details: {exc}",
                }
            )

    return {"found": True, "count": len(detailed), "messages": detailed}
