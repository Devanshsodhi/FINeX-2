"""Gmail action — list messages (IDs + threadIds). Use get_email for content of a specific one."""

from __future__ import annotations

from typing import Any

from app.services.tools.context import Context

from ._utils import ensure_list, resolve_label_ids, run_blocking


async def list_emails(
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
    if labels := ensure_list(args.get("labels")):
        list_kwargs["labelIds"] = await resolve_label_ids(client, labels)
    if query := args.get("query"):
        list_kwargs["q"] = query
    if page_token := args.get("page_token"):
        list_kwargs["pageToken"] = page_token

    response = await run_blocking(
        lambda: client.users().messages().list(**list_kwargs).execute()
    )

    messages = response.get("messages") or []
    return {
        "count": len(messages),
        "messages": [{"id": m["id"], "thread_id": m.get("threadId")} for m in messages],
        "next_page_token": response.get("nextPageToken"),
        "result_size_estimate": response.get("resultSizeEstimate"),
    }
