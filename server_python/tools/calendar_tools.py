from __future__ import annotations
import asyncio
from functools import partial

from agents import function_tool
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build


def _get_calendar():
    from config import GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, GOOGLE_CALENDAR_REFRESH_TOKEN
    creds = Credentials(
        token=None,
        refresh_token=GOOGLE_CALENDAR_REFRESH_TOKEN,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=GOOGLE_CALENDAR_CLIENT_ID,
        client_secret=GOOGLE_CALENDAR_CLIENT_SECRET,
    )
    return build("calendar", "v3", credentials=creds, cache_discovery=False)


async def _run(fn, *args, **kwargs):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, partial(fn, *args, **kwargs))


def _ensure_dt(dt: str) -> str:
    return dt if "T" in dt else f"{dt}T00:00:00"


@function_tool
async def create_event(
    summary: str,
    start: str,
    end: str,
    description: str = "",
    location: str = "",
    attendees: list[str] = [],
) -> dict:
    """Create a Google Calendar event. Start and end must be ISO 8601 format."""
    cal = _get_calendar()
    body = {
        "summary": summary,
        "start": {"dateTime": _ensure_dt(start), "timeZone": "Asia/Kolkata"},
        "end":   {"dateTime": _ensure_dt(end),   "timeZone": "Asia/Kolkata"},
    }
    if description: body["description"] = description
    if location:    body["location"] = location
    if attendees:   body["attendees"] = [{"email": e} for e in attendees]
    result = await _run(lambda: cal.events().insert(calendarId="primary", body=body).execute())
    return {"event_id": result.get("id"), "html_link": result.get("htmlLink"), "status": result.get("status")}


@function_tool
async def list_events(max_results: int = 10) -> dict:
    """List upcoming Google Calendar events."""
    from datetime import datetime, timezone
    cal = _get_calendar()
    now = datetime.now(timezone.utc).isoformat()
    result = await _run(
        lambda: cal.events().list(calendarId="primary", timeMin=now, maxResults=max_results,
                                   singleEvents=True, orderBy="startTime").execute()
    )
    return result
