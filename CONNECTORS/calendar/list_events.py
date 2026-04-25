"""Google Calendar action — list or search events in a calendar."""

from __future__ import annotations

from typing import Any

from app.services.tools.context import Context

from ._utils import run_blocking


async def list_events(
    ctx: Context,
    client: Any,
    args: dict[str, Any],
) -> dict[str, Any]:
    calendar_id = args.get("calendar_id") or "primary"

    params: dict[str, Any] = {"calendarId": calendar_id}
    if q := args.get("query"):
        params["q"] = q
    if time_min := args.get("time_min"):
        params["timeMin"] = time_min
    if time_max := args.get("time_max"):
        params["timeMax"] = time_max
    if max_results := args.get("max_results"):
        params["maxResults"] = max_results
    if order_by := args.get("order_by"):
        params["orderBy"] = order_by
    if args.get("single_events") is not None:
        params["singleEvents"] = args["single_events"]
    if page_token := args.get("page_token"):
        params["pageToken"] = page_token

    result = await run_blocking(
        lambda: client.events().list(**params).execute()
    )

    return {
        "calendar_id": calendar_id,
        "items": result.get("items", []),
        "next_page_token": result.get("nextPageToken"),
        "next_sync_token": result.get("nextSyncToken"),
        "time_zone": result.get("timeZone"),
    }
