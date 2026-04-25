"""Google Calendar action — fetch a single event by ID."""

from __future__ import annotations

from typing import Any

from app.services.tools.context import Context

from ._utils import run_blocking


async def get_event(
    ctx: Context,
    client: Any,
    args: dict[str, Any],
) -> dict[str, Any]:
    calendar_id = args.get("calendar_id") or "primary"
    event_id = args["event_id"]

    result = await run_blocking(
        lambda: client.events().get(calendarId=calendar_id, eventId=event_id).execute()
    )

    return {
        "event_id": result["id"],
        "calendar_id": calendar_id,
        "summary": result.get("summary"),
        "description": result.get("description"),
        "location": result.get("location"),
        "status": result.get("status"),
        "html_link": result.get("htmlLink"),
        "start": result.get("start"),
        "end": result.get("end"),
        "attendees": result.get("attendees"),
        "organizer": result.get("organizer"),
        "created": result.get("created"),
        "updated": result.get("updated"),
    }
