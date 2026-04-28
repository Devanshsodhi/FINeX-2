from __future__ import annotations
import re

from sqlalchemy.ext.asyncio import AsyncSession

from db import crud


async def build_memory_context(user_id: str, db: AsyncSession) -> str:
    memories = await crud.get_memories(db, user_id)
    if not memories:
        return f"## Your user ID: {user_id}"

    completion_pattern = re.compile(r"onboarding session \d+ complete", re.IGNORECASE)

    completion_facts = [m for m in memories if completion_pattern.search(m.content)]
    recent = sorted(memories, key=lambda m: m.created_at, reverse=True)[:20]
    recent_ids = {m.id for m in recent}
    pinned = [m for m in completion_facts if m.id not in recent_ids]

    all_shown = pinned + recent
    lines = "\n".join(f"- {m.content}" for m in all_shown)
    return f"## What I remember about you:\n{lines}\n\n## Your user ID: {user_id}"
