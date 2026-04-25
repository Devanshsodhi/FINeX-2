"""Google Calendar action — create a calendar event."""

from __future__ import annotations

from typing import Any

from app.services.tools.context import Context

from ._utils import ensure_datetime, run_blocking


async def create_event(
    ctx: Context,
    client: Any,
    args: dict[str, Any],
) -> dict[str, Any]:
    calendar_id = args.get("calendar_id") or "primary"
    all_day = args.get("all_day", False)
    timezone = args.get("timezone") or "UTC"

    if all_day:
        start = {"date": args["start"]}
        end = {"date": args["end"]}
    else:
        start = {"dateTime": ensure_datetime(args["start"]), "timeZone": timezone}
        end = {"dateTime": ensure_datetime(args["end"]), "timeZone": timezone}

    body: dict[str, Any] = {
        "summary": args["summary"],
        "start": start,
        "end": end,
    }
    if description := args.get("description"):
        body["description"] = description
    if location := args.get("location"):
        body["location"] = location
    if attendees := args.get("attendees"):
        body["attendees"] = [{"email": e} for e in attendees]
    if color_id := args.get("color_id"):
        body["colorId"] = color_id

    result = await run_blocking(
        lambda: client.events().insert(calendarId=calendar_id, body=body).execute()
    )

    return {
        "event_id": result["id"],
        "calendar_id": calendar_id,
        "summary": result.get("summary"),
        "status": result.get("status"),
        "html_link": result.get("htmlLink"),
        "start": result.get("start"),
        "end": result.get("end"),
        "created": result.get("created"),
    }
