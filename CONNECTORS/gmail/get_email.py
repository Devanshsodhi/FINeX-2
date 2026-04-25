"""Gmail action — fetch one email by ID, returned as a slim parsed dict."""

from __future__ import annotations

from typing import Any

from app.services.tools.context import Context

from ._utils import extract_body_from_payload, extract_headers_from_payload, run_blocking


async def get_email(
    ctx: Context,
    client: Any,
    args: dict[str, Any],
) -> dict[str, Any]:
    message_id = args["message_id"]

    # format='full' returns Gmail's parsed payload tree without attachment bytes — much smaller than 'raw'.
    response = await run_blocking(
        lambda: client.users()
        .messages()
        .get(userId="me", id=message_id, format="full")
        .execute()
    )

    payload = response.get("payload") or {}
    headers = extract_headers_from_payload(
        payload, ["Subject", "From", "To", "Cc", "Date"]
    )

    return {
        "id": message_id,
        "thread_id": response.get("threadId"),
        "subject": headers.get("Subject", ""),
        "from": headers.get("From", ""),
        "to": headers.get("To", ""),
        "cc": headers.get("Cc", ""),
        "date": headers.get("Date", ""),
        "body": extract_body_from_payload(payload),
    }
