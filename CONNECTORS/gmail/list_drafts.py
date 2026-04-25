"""Gmail action — list drafts (IDs + threadIds). Use get_email with the draft's message id for content."""

from __future__ import annotations

from typing import Any

from app.services.tools.context import Context

from ._utils import run_blocking


async def list_drafts(
    ctx: Context,
    client: Any,
    args: dict[str, Any],
) -> dict[str, Any]:
    max_results = max(1, min(int(args.get("max_results", 10) or 10), 500))

    list_kwargs: dict[str, Any] = {
        "userId": "me",
        "maxResults": max_results,
        "includeSpamTrash": bool(args.get("include_spam_trash")),
    }
    if query := args.get("query"):
        list_kwargs["q"] = query
    if page_token := args.get("page_token"):
        list_kwargs["pageToken"] = page_token

    response = await run_blocking(
        lambda: client.users().drafts().list(**list_kwargs).execute()
    )

    drafts = response.get("drafts") or []
    return {
        "count": len(drafts),
        # Each draft has its own id plus a nested message with id + threadId.
        "drafts": [
            {
                "id": d["id"],
                "message_id": (d.get("message") or {}).get("id"),
                "thread_id": (d.get("message") or {}).get("threadId"),
            }
            for d in drafts
        ],
        "next_page_token": response.get("nextPageToken"),
        "result_size_estimate": response.get("resultSizeEstimate"),
    }
