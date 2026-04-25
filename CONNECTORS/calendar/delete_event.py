"""Google Calendar action — delete an event by ID."""

from __future__ import annotations

from typing import Any

from app.services.tools.context import Context

from ._utils import run_blocking


async def delete_event(
    ctx: Context,
    client: Any,
    args: dict[str, Any],
) -> dict[str, Any]:
    calendar_id = args.get("calendar_id") or "primary"
    event_id = args["event_id"]

    await run_blocking(
        lambda: client.events().delete(calendarId=calendar_id, eventId=event_id).execute()
    )

    return {"event_id": event_id, "calendar_id": calendar_id, "deleted": True}
