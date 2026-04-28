from __future__ import annotations
import asyncio
import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr
from functools import partial
from typing import Literal

from agents import function_tool
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build


def _get_gmail():
    from config import GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
    creds = Credentials(
        token=None,
        refresh_token=GMAIL_REFRESH_TOKEN,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=GMAIL_CLIENT_ID,
        client_secret=GMAIL_CLIENT_SECRET,
    )
    return build("gmail", "v1", credentials=creds, cache_discovery=False)


async def _run(fn, *args, **kwargs):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, partial(fn, *args, **kwargs))


def _build_raw(to: str | list, subject: str, body: str, body_type: str = "plain",
               cc: str | None = None, bcc: str | None = None, sender_name: str | None = None) -> str:
    from config import GMAIL_USER_EMAIL
    from_addr = formataddr((sender_name, GMAIL_USER_EMAIL)) if sender_name else GMAIL_USER_EMAIL
    to_str = ", ".join(to) if isinstance(to, list) else to

    if body_type == "html":
        msg: MIMEMultipart | MIMEText = MIMEMultipart("alternative")
        msg.attach(MIMEText(body, "html", "utf-8"))
    else:
        msg = MIMEText(body, "plain", "utf-8")

    msg["From"] = from_addr
    msg["To"] = to_str
    msg["Subject"] = subject
    if cc:  msg["Cc"] = cc if isinstance(cc, str) else ", ".join(cc)
    if bcc: msg["Bcc"] = bcc if isinstance(bcc, str) else ", ".join(bcc)
    return base64.urlsafe_b64encode(msg.as_bytes()).decode("ascii")


_DEFAULT_SUBJECT = "FINeX : Your trusted Financial partner"


@function_tool
async def send_email(
    to: str,
    body: str,
    body_type: Literal["plain", "html"] = "plain",
    cc: str = "",
    bcc: str = "",
    sender_name: str = "",
) -> dict:
    """Send an email via Gmail. Never ask the user for a subject — it is always set automatically."""
    gmail = _get_gmail()
    raw = _build_raw(to, _DEFAULT_SUBJECT, body, body_type, cc or None, bcc or None, sender_name or None)
    result = await _run(lambda: gmail.users().messages().send(userId="me", body={"raw": raw}).execute())
    return {"message_id": result.get("id"), "thread_id": result.get("threadId"), "status": "sent"}


@function_tool
async def list_emails(max_results: int = 10) -> dict:
    """List recent emails from Gmail inbox."""
    gmail = _get_gmail()
    result = await _run(lambda: gmail.users().messages().list(userId="me", maxResults=max_results).execute())
    return result


@function_tool
async def search_email(query: str, max_results: int = 10) -> dict:
    """Search emails in Gmail using Gmail search syntax."""
    gmail = _get_gmail()
    result = await _run(lambda: gmail.users().messages().list(userId="me", q=query, maxResults=max_results).execute())
    return result
