from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app_agents.context import UserContext
from app_agents.registry import get_agent, AGENT_MAP
from db.database import get_db
from services.memory_context import build_memory_context
from services.streaming_bridge import stream_agent

router = APIRouter()


class AgentRequest(BaseModel):
    messages: list[dict]
    user_id: str = ""
    user_name: str = "User"
    session_id: str = ""


_MEMORY_AGENT_SYSTEM = "Deprecated — memory agent prompt is now built client-side."


@router.get("/api/connectors")
async def list_connectors():
    from config import CONNECTORS_DIR
    import json
    connectors = []
    for d in CONNECTORS_DIR.iterdir():
        data_file = d / "_data.json"
        if d.is_dir() and data_file.exists():
            try:
                connectors.append(json.loads(data_file.read_text()))
            except Exception:
                pass
    return connectors


@router.get("/api/agents/memory_agent/system")
async def memory_agent_system():
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse(_MEMORY_AGENT_SYSTEM)


@router.get("/api/agents")
async def list_agents():
    from config import AGENTS_DIR
    import json
    agents = []
    for d in AGENTS_DIR.iterdir():
        data_file = d / "_data.json"
        if d.is_dir() and data_file.exists():
            try:
                agents.append(json.loads(data_file.read_text()))
            except Exception:
                pass
    return agents


@router.post("/api/agents/{agent_id}/message")
async def agent_message(
    agent_id: str,
    req: AgentRequest,
    db: AsyncSession = Depends(get_db),
):
    agent = get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")

    memories = await build_memory_context(req.user_id, db)
    ctx = UserContext(
        user_id=req.user_id,
        user_name=req.user_name,
        session_id=req.session_id,
        memories=memories,
        db=db,
    )
    return StreamingResponse(
        stream_agent(agent, req.messages, ctx),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
