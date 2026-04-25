"""GmailConnector — wires Gmail action files into the connector framework."""

from __future__ import annotations

from typing import Any

from app.services.tools.auth.schema import AuthOption, OAuthServerAuth
from app.services.tools.connectors.base import BaseConnector, ConnectorMetadata
from app.services.tools.context import Context
from app.services.tools.models import ToolServerConfig

from .add_labels_to_email import add_labels_to_email
from .create_draft_reply import create_draft_reply
from .get_email import get_email
from .get_thread import get_thread
from .list_drafts import list_drafts
from .list_emails import list_emails
from .list_labels import list_labels
from .remove_labels_from_email import remove_labels_from_email
from .reply_to_email import reply_to_email
from .search_email import search_email
from .send_email import send_email


class GmailConnector(BaseConnector):
    name = "gmail"
    metadata = ConnectorMetadata(
        display_name="Gmail",
        description="Send, read, and manage email via Google's Gmail API",
        logo_url="https://ssl.gstatic.com/images/branding/product/1x/gmail_2020q4_48dp.png",
        categories=["Communication", "Email"],
        provider="Google LLC",
    )

    auth_options = [
        AuthOption(
            auth_schema=OAuthServerAuth(
                token_url="https://oauth2.googleapis.com/token",
                authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
                scope="https://www.googleapis.com/auth/gmail.modify",
                grant_type="authorization_code",
                client_id="",
                client_secret="",
            ),
            # form=None → uses OAuthServerAuth.default_form (client_id, client_secret).
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
        return build("gmail", "v1", credentials=google_creds, cache_discovery=False)


GmailConnector.register_action(send_email)
GmailConnector.register_action(reply_to_email)
GmailConnector.register_action(create_draft_reply)
GmailConnector.register_action(get_email)
GmailConnector.register_action(search_email)
GmailConnector.register_action(get_thread)
GmailConnector.register_action(add_labels_to_email)
GmailConnector.register_action(remove_labels_from_email)
GmailConnector.register_action(list_emails)
GmailConnector.register_action(list_drafts)
GmailConnector.register_action(list_labels)


__all__ = ["GmailConnector"]
