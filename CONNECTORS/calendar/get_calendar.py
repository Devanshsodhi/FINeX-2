"""Google Calendar action — fetch a calendar's metadata."""

from __future__ import annotations

from typing import Any

from app.services.tools.context import Context

from ._utils import run_blocking


async def get_calendar(
    ctx: Context,
    client: Any,
    args: dict[str, Any],
) -> dict[str, Any]:
    calendar_id = args.get("calendar_id") or "primary"

    result = await run_blocking(
        lambda: client.calendars().get(calendarId=calendar_id).execute()
    )

    return {
        "calendar_id": result["id"],
        "summary": result.get("summary"),
        "description": result.get("description"),
        "location": result.get("location"),
        "time_zone": result.get("timeZone"),
        "kind": result.get("kind"),
    }
