"""Gmail action — reply to an existing email with correct threading headers."""

from __future__ import annotations

from typing import Any

from app.services.tools.context import Context

from ._utils import (
    build_mime_message,
    build_references,
    build_reply_recipients,
    encode_raw,
    fetch_headers_and_thread,
    reply_subject,
    run_blocking,
)


async def reply_to_email(
    ctx: Context,
    client: Any,
    args: dict[str, Any],
) -> dict[str, Any]:
    message_id = args["message_id"]
    reply_type = args.get("reply_type", "reply")

    original = await fetch_headers_and_thread(client, message_id)
    headers = original["headers"]
    thread_id = original["thread_id"]

    to_list, cc_list = await build_reply_recipients(client, headers, reply_type)

    mime_msg = build_mime_message(
        {
            "to": to_list,
            "cc": cc_list,
            "subject": reply_subject(headers.get("subject", "")),
            "body": args["body"],
            "body_type": args.get("body_type", "plain_text"),
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

    send_body: dict[str, Any] = {"raw": raw}
    if thread_id:
        send_body["threadId"] = thread_id

    result = await run_blocking(
        lambda: client.users().messages().send(userId="me", body=send_body).execute()
    )
    return {
        "message_id": result.get("id"),
        "thread_id": result.get("threadId"),
        "replied_to": message_id,
        "reply_type": reply_type,
    }
