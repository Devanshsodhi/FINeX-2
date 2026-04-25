"""Gmail action — remove labels from a message. Accepts label names or IDs."""

from __future__ import annotations

from typing import Any

from app.services.tools.context import Context

from ._utils import ensure_list, resolve_label_ids, run_blocking


async def remove_labels_from_email(
    ctx: Context,
    client: Any,
    args: dict[str, Any],
) -> dict[str, Any]:
    message_id = args["message_id"]
    labels = ensure_list(args.get("labels"))
    if not labels:
        raise ValueError("remove_labels_from_email requires at least one label name or id")

    label_ids = await resolve_label_ids(client, labels)

    result = await run_blocking(
        lambda: client.users()
        .messages()
        .modify(userId="me", id=message_id, body={"removeLabelIds": label_ids})
        .execute()
    )
    return {
        "message_id": result.get("id"),
        "thread_id": result.get("threadId"),
        "label_ids": result.get("labelIds", []),
    }
