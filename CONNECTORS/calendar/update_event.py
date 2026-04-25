"""Google Calendar action — patch an existing event (only sends fields you provide)."""

from __future__ import annotations

from typing import Any

from app.services.tools.context import Context

from ._utils import ensure_datetime, run_blocking


async def update_event(
    ctx: Context,
    client: Any,
    args: dict[str, Any],
) -> dict[str, Any]:
    calendar_id = args.get("calendar_id") or "primary"
    event_id = args["event_id"]
    all_day = args.get("all_day", False)
    timezone = args.get("timezone") or "UTC"

    body: dict[str, Any] = {}
    if summary := args.get("summary"):
        body["summary"] = summary
    if description := args.get("description"):
        body["description"] = description
    if location := args.get("location"):
        body["location"] = location
    if color_id := args.get("color_id"):
        body["colorId"] = color_id
    if attendees := args.get("attendees"):
        body["attendees"] = [{"email": e} for e in attendees]
    if start := args.get("start"):
        body["start"] = {"date": start} if all_day else {"dateTime": ensure_datetime(start), "timeZone": timezone}
    if end := args.get("end"):
        body["end"] = {"date": end} if all_day else {"dateTime": ensure_datetime(end), "timeZone": timezone}

    result = await run_blocking(
        lambda: client.events().patch(calendarId=calendar_id, eventId=event_id, body=body).execute()
    )

    return {
        "event_id": result["id"],
        "calendar_id": calendar_id,
        "summary": result.get("summary"),
        "status": result.get("status"),
        "html_link": result.get("htmlLink"),
        "start": result.get("start"),
        "end": result.get("end"),
        "updated": result.get("updated"),
    }
