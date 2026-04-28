from agents import Agent, RunContextWrapper

from app_agents.context import UserContext
from config import LLM_MODEL
from tools.portfolio import get_portfolio, get_portfolio_summary
from tools.financial_calc import (
    calculate_sip, calculate_goal_probability,
    get_tax_insights, get_rebalancing_advice, compute_income_tax,
)
from tools.memory_tools import get_memory
from tools.skill_loader import load_skill

_PROMPT = """You are the FINeX Investment Monitor — a specialist investment tracking agent.

You have been activated because the user wants to discuss their investments.

Your FIRST action must be to call the load_skill function with skill_id "track". Do this immediately — before saying anything else.

## When to use which tool
- get_portfolio → specific holdings, full breakdown, individual stock/MF/crypto details
- get_portfolio_summary → net worth, P&L, allocation %, goal progress, CAGR, Sharpe ratio, drawdown
- get_rebalancing_advice → portfolio drift from target allocation, which asset classes to adjust
- get_tax_insights → LTCG harvesting, 80C gap, FD TDS exposure, crypto tax
- compute_income_tax → exact tax liability under new/old regime for FY 2025-26
- calculate_sip → SIP/lump sum future value projection
- calculate_goal_probability → Monte Carlo simulation for a savings goal
"""


def _instructions(ctx: RunContextWrapper[UserContext], agent: Agent) -> str:
    return f"{_PROMPT}\n\n{ctx.context.memories}"


def build_investment_monitor(market_sentiment) -> Agent[UserContext]:
    from agents import handoff
    from agents.extensions.handoff_filters import remove_all_tools

    return Agent[UserContext](
        name="investment_monitor",
        model=LLM_MODEL,
        instructions=_instructions,
        tools=[
            get_portfolio, get_portfolio_summary,
            get_rebalancing_advice, get_tax_insights,
            compute_income_tax, calculate_sip,
            calculate_goal_probability, get_memory, load_skill,
        ],
        handoffs=[
            handoff(
                market_sentiment,
                tool_description_override="Hand off when the user asks about market sentiment, news, or how the market is reacting.",
                input_filter=remove_all_tools,
            ),
        ],
    )
