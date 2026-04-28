from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Literal

from db.database import get_db
from db import crud

router = APIRouter()


class SaveMemoryRequest(BaseModel):
    type: Literal["user_fact", "onboarding_data", "emotional_signal", "decision", "contradiction", "follow_up"]
    content: str
    session_id: str = ""


@router.get("/api/memory/{user_id}")
async def get_memory(user_id: str, db: AsyncSession = Depends(get_db)):
    memories = await crud.get_memories(db, user_id)
    return [
        {"id": m.id, "type": m.type, "content": m.content,
         "session_id": m.session_id, "created_at": m.created_at.isoformat()}
        for m in memories
    ]


@router.post("/api/memory/{user_id}")
async def save_memory(user_id: str, req: SaveMemoryRequest, db: AsyncSession = Depends(get_db)):
    m = await crud.save_memory(db, user_id, req.type, req.content, req.session_id)
    return {"success": True, "id": m.id}


@router.delete("/api/memory/{user_id}/{memory_id}")
async def delete_memory(user_id: str, memory_id: str, db: AsyncSession = Depends(get_db)):
    deleted = await crud.delete_memory(db, user_id, memory_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"success": True}


@router.delete("/api/memory/{user_id}")
async def clear_memory(user_id: str, db: AsyncSession = Depends(get_db)):
    await crud.clear_memories(db, user_id)
    return {"success": True}
