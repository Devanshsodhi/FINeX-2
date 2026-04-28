from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db import crud

router = APIRouter()


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/api/login")
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await crud.get_user(db, req.email)
    if not user or user.password != req.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"success": True, "user": {"id": user.email, "name": user.name, "email": user.email}}
