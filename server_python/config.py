import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

OPENROUTER_API_KEY: str = os.environ["OPENROUTER_API_KEY"]
SITE_URL: str = os.getenv("SITE_URL", "http://localhost:5000")
LLM_MODEL: str = os.getenv("LLM_MODEL", "openai/gpt-oss-120b")
LLM_MAX_TOKENS: int = int(os.getenv("LLM_MAX_TOKENS", "4000"))
LLM_TEMPERATURE: float = float(os.getenv("LLM_TEMPERATURE", "0.4"))

NEWSAPI_KEY: str = os.getenv("NEWSAPI_KEY", "")

GMAIL_CLIENT_ID: str = os.getenv("GMAIL_CLIENT_ID", "")
GMAIL_CLIENT_SECRET: str = os.getenv("GMAIL_CLIENT_SECRET", "")
GMAIL_REFRESH_TOKEN: str = os.getenv("GMAIL_REFRESH_TOKEN", "")
GMAIL_USER_EMAIL: str = os.getenv("GMAIL_USER_EMAIL", "")

GOOGLE_CALENDAR_CLIENT_ID: str = os.getenv("GOOGLE_CALENDAR_CLIENT_ID", GMAIL_CLIENT_ID)
GOOGLE_CALENDAR_CLIENT_SECRET: str = os.getenv("GOOGLE_CALENDAR_CLIENT_SECRET", GMAIL_CLIENT_SECRET)
GOOGLE_CALENDAR_REFRESH_TOKEN: str = os.getenv("GOOGLE_CALENDAR_REFRESH_TOKEN", GMAIL_REFRESH_TOKEN)

PORT: int = int(os.getenv("PORT", "5000"))
DEV_MODE: bool = os.getenv("RAILWAY_ENVIRONMENT") is None

BASE_DIR = Path(__file__).parent.parent
SKILLS_DIR = BASE_DIR / "SKILLS"
AGENTS_DIR = BASE_DIR / "AGENTS"
CONNECTORS_DIR = BASE_DIR / "CONNECTORS"
TOOLS_DIR = BASE_DIR / "TOOLS"
FRONTEND_DIST = BASE_DIR / "frontend" / "dist"
DB_PATH = Path(__file__).parent / "db" / "finex.db"
