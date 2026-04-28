from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db import crud
from tools.portfolio import compute_summary

router = APIRouter()


@router.get("/api/portfolio")
async def get_portfolio(user_id: str, db: AsyncSession = Depends(get_db)):
    p = await crud.get_portfolio(db, user_id)
    if not p:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return p


@router.get("/api/portfolio/summary")
async def get_portfolio_summary(user_id: str, db: AsyncSession = Depends(get_db)):
    p = await crud.get_portfolio(db, user_id)
    if not p:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return compute_summary(p)
