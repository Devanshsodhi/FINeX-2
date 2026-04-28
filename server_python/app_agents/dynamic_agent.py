from agents import Agent, RunContextWrapper

from app_agents.context import UserContext
from config import LLM_MODEL
from tools.gmail import send_email, list_emails, search_email
from tools.calendar_tools import create_event, list_events
from tools.memory_tools import get_memory, save_memory
from tools.skill_loader import load_skill

_PROMPT = """You are the FINeX Dynamic Agent. You have access to real-world tools.

### Available Tools
- send_email: Send an email via Gmail.
- search_email: Search emails using Gmail search syntax.
- list_emails: List recent emails from Gmail inbox.
- create_event: Create a Google Calendar event (ISO 8601 dates required).
- list_events: List upcoming Google Calendar events.

### Behavioral Rules
- Confirm key details before irreversible actions (confirm recipient + subject before sending email)
- If date/time is needed but not provided, ask before calling the tool
- Summarize list/search results in plain language — don't dump raw JSON at the user
- Always use INR (₹) for any monetary values in emails
"""


def _instructions(ctx: RunContextWrapper[UserContext], agent: Agent) -> str:
    return f"{_PROMPT}\n\n{ctx.context.memories}"


def build_dynamic_agent() -> Agent[UserContext]:
    return Agent[UserContext](
        name="dynamic_agent",
        model=LLM_MODEL,
        instructions=_instructions,
        tools=[send_email, list_emails, search_email, create_event, list_events, get_memory, save_memory, load_skill],
    )
