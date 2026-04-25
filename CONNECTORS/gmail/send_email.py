"""Gmail action — send an email (or create a draft with `draft=True`)."""

from __future__ import annotations

from typing import Any

from app.services.tools.context import Context

from ._utils import build_mime_message, encode_raw, run_blocking


async def send_email(
    ctx: Context,
    client: Any,
    args: dict[str, Any],
) -> dict[str, Any]:
    thread_id: str | None = None
    extra_headers: dict[str, str] = {}

    # Threading: look up the original thread by RFC 822 Message-ID so Gmail groups the reply.
    if in_reply_to := args.get("in_reply_to"):
        lookup = await run_blocking(
            lambda: client.users()
            .messages()
            .list(userId="me", q=f"Rfc822msgid:{in_reply_to}")
            .execute()
        )
        messages = lookup.get("messages") or []
        if messages:
            thread_id = messages[0].get("threadId")
        extra_headers = {"In-Reply-To": in_reply_to, "References": in_reply_to}

    mime_msg = build_mime_message({**args, "extra_headers": extra_headers})
    raw = encode_raw(mime_msg)

    if args.get("draft"):
        body: dict[str, Any] = {"message": {"raw": raw}}
        if thread_id:
            body["message"]["threadId"] = thread_id
        result = await run_blocking(
            lambda: client.users().drafts().create(userId="me", body=body).execute()
        )
        return {"draft": result}

    send_body: dict[str, Any] = {"raw": raw}
    if thread_id:
        send_body["threadId"] = thread_id
    result = await run_blocking(
        lambda: client.users().messages().send(userId="me", body=send_body).execute()
    )
    return {
        "message_id": result.get("id"),
        "thread_id": result.get("threadId"),
        "label_ids": result.get("labelIds", []),
    }
