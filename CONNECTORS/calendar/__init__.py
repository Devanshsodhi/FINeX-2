"""GoogleCalendarConnector — wires Calendar action files into the connector framework."""

from __future__ import annotations

from typing import Any

from app.services.tools.auth.schema import AuthOption, OAuthServerAuth
from app.services.tools.connectors.base import BaseConnector, ConnectorMetadata
from app.services.tools.context import Context
from app.services.tools.models import ToolServerConfig

from .create_event import create_event
from .delete_event import delete_event
from .get_calendar import get_calendar
from .get_event import get_event
from .list_events import list_events
from .update_event import update_event


class GoogleCalendarConnector(BaseConnector):
    name = "google_calendar"
    metadata = ConnectorMetadata(
        display_name="Google Calendar",
        description="Create, read, update, and delete events on Google Calendar",
        logo_url="https://ssl.gstatic.com/calendar/images/dynamiclogo_2020q4/calendar_31_2x.jpg",
        categories=["Calendar", "Productivity"],
        provider="Google LLC",
    )

    auth_options = [
        AuthOption(
            auth_schema=OAuthServerAuth(
                token_url="https://oauth2.googleapis.com/token",
                authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
                scope="https://www.googleapis.com/auth/calendar",
                grant_type="authorization_code",
                client_id="",
                client_secret="",
            ),
        ),
    ]

    @classmethod
    async def create_client(cls, ctx: Context, server: ToolServerConfig) -> Any:
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build

        creds = server.credentials or {}
        google_creds = Credentials(
            token=creds["token"],
            refresh_token=creds["refresh_token"],
            client_id=creds["client_id"],
            client_secret=creds["client_secret"],
            token_uri=creds["token_uri"],
            scopes=creds.get("scopes"),
        )
        return build("calendar", "v3", credentials=google_creds, cache_discovery=False)


GoogleCalendarConnector.register_action(create_event)
GoogleCalendarConnector.register_action(get_event)
GoogleCalendarConnector.register_action(update_event)
GoogleCalendarConnector.register_action(delete_event)
GoogleCalendarConnector.register_action(list_events)
GoogleCalendarConnector.register_action(get_calendar)


__all__ = ["GoogleCalendarConnector"]
