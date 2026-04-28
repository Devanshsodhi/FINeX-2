from __future__ import annotations
from typing import Literal

from agents import RunContextWrapper, function_tool

from db import crud


@function_tool
async def save_memory(
    ctx: RunContextWrapper,
    type: Literal["user_fact", "onboarding_data", "emotional_signal", "decision", "contradiction", "follow_up"],
    content: str,
    session_id: str,
) -> dict:
    """Persist a memory about the user for future conversations."""
    user_ctx = ctx.context
    await crud.save_memory(user_ctx.db, user_ctx.user_id, type, content, session_id)
    return {"success": True}


@function_tool
async def get_memory(ctx: RunContextWrapper) -> list[dict]:
    """Retrieve all stored memories for the current user."""
    user_ctx = ctx.context
    memories = await crud.get_memories(user_ctx.db, user_ctx.user_id)
    return [
        {
            "id": m.id,
            "type": m.type,
            "content": m.content,
            "session_id": m.session_id,
            "created_at": m.created_at.isoformat(),
        }
        for m in memories
    ]
