from __future__ import annotations
from dataclasses import dataclass, field
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass
class UserContext:
    user_id: str
    user_name: str
    session_id: str
    memories: str
    db: AsyncSession = field(repr=False)
