from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Chat, Memory, Portfolio, User

MAX_MEMORIES = 100
EVICTION_ORDER = ["user_fact", "emotional_signal", "decision"]


# ── Users ─────────────────────────────────────────────────────────────────────

async def get_user(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def create_user(db: AsyncSession, email: str, name: str, password: str) -> User:
    user = User(email=email, name=name, password=password)
    db.add(user)
    await db.commit()
    return user


# ── Memory ────────────────────────────────────────────────────────────────────

async def get_memories(db: AsyncSession, user_id: str) -> list[Memory]:
    result = await db.execute(
        select(Memory)
        .where(Memory.user_id == user_id)
        .order_by(Memory.created_at.asc())
    )
    return list(result.scalars().all())


async def save_memory(
    db: AsyncSession,
    user_id: str,
    type: str,
    content: str,
    session_id: str,
) -> Memory:
    existing = await get_memories(db, user_id)

    if type == "onboarding_data":
        for m in existing:
            if m.type == "onboarding_data" and m.session_id == session_id:
                m.content = content
                await db.commit()
                return m

    if type == "user_fact":
        if any(m.content.lower() == content.lower() for m in existing):
            return existing[0]

    if len(existing) >= MAX_MEMORIES:
        await _evict_oldest(db, user_id, existing)

    entry = Memory(
        id=str(uuid.uuid4()),
        user_id=user_id,
        type=type,
        content=content,
        session_id=session_id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(entry)
    await db.commit()
    return entry


async def _evict_oldest(db: AsyncSession, user_id: str, existing: list[Memory]) -> None:
    for evict_type in EVICTION_ORDER:
        candidates = [m for m in existing if m.type == evict_type]
        if candidates:
            oldest = min(candidates, key=lambda m: m.created_at)
            await db.delete(oldest)
            await db.commit()
            return
    oldest = min(existing, key=lambda m: m.created_at)
    await db.delete(oldest)
    await db.commit()


async def delete_memory(db: AsyncSession, user_id: str, memory_id: str) -> bool:
    result = await db.execute(
        select(Memory).where(Memory.id == memory_id, Memory.user_id == user_id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        return False
    await db.delete(entry)
    await db.commit()
    return True


async def clear_memories(db: AsyncSession, user_id: str) -> None:
    await db.execute(delete(Memory).where(Memory.user_id == user_id))
    await db.commit()


# ── Portfolio ─────────────────────────────────────────────────────────────────

async def get_portfolio(db: AsyncSession, user_id: str) -> dict | None:
    result = await db.execute(select(Portfolio).where(Portfolio.user_id == user_id))
    row = result.scalar_one_or_none()
    return row.data if row else None


async def upsert_portfolio(db: AsyncSession, user_id: str, data: dict) -> None:
    result = await db.execute(select(Portfolio).where(Portfolio.user_id == user_id))
    row = result.scalar_one_or_none()
    if row:
        row.data = data
        row.updated_at = datetime.now(timezone.utc)
    else:
        db.add(Portfolio(user_id=user_id, data=data))
    await db.commit()
