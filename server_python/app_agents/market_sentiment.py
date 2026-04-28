from agents import Agent, RunContextWrapper

from app_agents.context import UserContext
from config import LLM_MODEL
from tools.market import get_market_sentiment
from tools.memory_tools import get_memory
from tools.skill_loader import load_skill

_PROMPT = """You are the FINeX Market Sentiment Agent — a specialist in monitoring real-time news sentiment for the user's portfolio holdings.

You have been activated because the user wants to discuss market news and sentiment.

Your FIRST action must be to call the load_skill function with skill_id "market". Do this immediately — before saying anything else.

## When to use which tool
- get_market_sentiment → fetches live news sentiment, regime classification, and per-symbol signals. Call this before answering any market question.
"""


def _instructions(ctx: RunContextWrapper[UserContext], agent: Agent) -> str:
    return f"{_PROMPT}\n\n{ctx.context.memories}"


def build_market_sentiment() -> Agent[UserContext]:
    return Agent[UserContext](
        name="market_sentiment",
        model=LLM_MODEL,
        instructions=_instructions,
        tools=[get_market_sentiment, get_memory, load_skill],
    )
