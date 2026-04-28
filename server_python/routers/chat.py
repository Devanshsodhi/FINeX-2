from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app_agents.context import UserContext
from app_agents.registry import main_agent
from config import OPENROUTER_API_KEY, LLM_MODEL, SITE_URL
from db.database import get_db
from services.memory_context import build_memory_context
from services.streaming_bridge import stream_agent

router = APIRouter()

_openrouter = AsyncOpenAI(
    api_key=OPENROUTER_API_KEY,
    base_url="https://openrouter.ai/api/v1",
    default_headers={"HTTP-Referer": SITE_URL},
)


class ChatRequest(BaseModel):
    messages: list[dict]
    user_id: str = ""
    user_name: str = "User"
    session_id: str = ""


class SimpleChatRequest(BaseModel):
    messages: list[dict]
    maxTokens: int = 1500
    temperature: float = 0.2


@router.get("/api/chats")
async def list_chats():
    return [
        {"id": 1, "title": "Investment strategies 2025"},
        {"id": 2, "title": "Tax saving under new regime"},
        {"id": 3, "title": "SIP vs lump sum analysis"},
        {"id": 4, "title": "Emergency fund planning"},
        {"id": 5, "title": "Portfolio rebalancing"},
    ]


@router.post("/api/llm/chat")
async def chat_completion(req: SimpleChatRequest):
    resp = await _openrouter.chat.completions.create(
        model=LLM_MODEL,
        messages=req.messages,
        max_tokens=req.maxTokens,
        temperature=req.temperature,
    )
    return resp.model_dump()


@router.post("/api/llm/stream")
async def chat_stream(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    memories = await build_memory_context(req.user_id, db)
    ctx = UserContext(
        user_id=req.user_id,
        user_name=req.user_name,
        session_id=req.session_id,
        memories=memories,
        db=db,
    )
    return StreamingResponse(
        stream_agent(main_agent, req.messages, ctx),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
