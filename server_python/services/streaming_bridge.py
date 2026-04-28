from __future__ import annotations
import json
from typing import AsyncIterator

from agents import Runner, Agent

from app_agents.context import UserContext


async def stream_agent(
    agent: Agent[UserContext],
    messages: list[dict],
    context: UserContext,
) -> AsyncIterator[str]:
    """Run agent and yield SSE-formatted chunks."""
    result = Runner.run_streamed(
        starting_agent=agent,
        input=messages,
        context=context,
        max_turns=10,
    )

    async for event in result.stream_events():
        event_type = getattr(event, "type", None)

        if event_type == "raw_response_event":
            data = event.data
            inner_type = getattr(data, "type", None)

            # Responses API format (SDK default with OpenRouter)
            if inner_type == "response.output_text.delta":
                text = getattr(data, "delta", None)
                if text:
                    yield f"data: {text}\n\n"
            else:
                # Chat Completions fallback
                choices = getattr(data, "choices", None) or []
                if choices:
                    delta = getattr(choices[0], "delta", None)
                    text = getattr(delta, "content", None) if delta else None
                    if text:
                        yield f"data: {text}\n\n"

        elif event_type == "agent_updated_stream_event":
            agent_name = getattr(event.new_agent, "name", "unknown")
            payload = json.dumps({"type": "handoff", "agent": agent_name})
            yield f"data: {payload}\n\n"

    yield "data: [DONE]\n\n"
