from agents import Agent
from app_agents.context import UserContext
from app_agents.market_sentiment import build_market_sentiment
from app_agents.investment_monitor import build_investment_monitor
from app_agents.dynamic_agent import build_dynamic_agent
from app_agents.main_agent import build_main_agent

market_sentiment: Agent[UserContext] = build_market_sentiment()
investment_monitor: Agent[UserContext] = build_investment_monitor(market_sentiment)
dynamic_agent: Agent[UserContext] = build_dynamic_agent()
main_agent: Agent[UserContext] = build_main_agent(investment_monitor, market_sentiment, dynamic_agent)

AGENT_MAP: dict[str, Agent[UserContext]] = {
    "main_agent": main_agent,
    "investment_monitor": investment_monitor,
    "market_sentiment": market_sentiment,
    "dynamic_agent": dynamic_agent,
}


def get_agent(agent_id: str) -> Agent[UserContext] | None:
    return AGENT_MAP.get(agent_id)
