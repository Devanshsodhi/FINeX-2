from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from openai import AsyncOpenAI
from agents import set_default_openai_client, set_default_openai_api, set_tracing_disabled

import config
from db.database import init_db
from routers import auth, chat, agents, memory, portfolio, skills


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Configure SDK to use OpenRouter
    openrouter_client = AsyncOpenAI(
        api_key=config.OPENROUTER_API_KEY,
        base_url="https://openrouter.ai/api/v1",
        default_headers={"HTTP-Referer": config.SITE_URL},
    )
    set_default_openai_client(openrouter_client)
    set_default_openai_api("chat_completions")
    set_tracing_disabled(True)

    await init_db()
    yield


app = FastAPI(title="FINeX API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(agents.router)
app.include_router(memory.router)
app.include_router(portfolio.router)
app.include_router(skills.router)

# Serve frontend in production
if config.FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(config.FRONTEND_DIST), html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=config.PORT, reload=config.DEV_MODE)
