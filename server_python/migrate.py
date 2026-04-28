"""
Migrate existing JSON data → SQLite.

Run once from server_python/:
    python migrate.py
"""
import asyncio
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
USERS_FILE    = BASE_DIR / "server" / "db" / "users.json"
PORTFOLIO_FILE = BASE_DIR / "server" / "db" / "portfolio.json"
MEMORY_DIR    = BASE_DIR / "server" / "db" / "memory"


async def migrate():
    from db.database import init_db, SessionLocal
    from db.models import User, Portfolio, Memory

    await init_db()

    async with SessionLocal() as db:
        # ── Users ────────────────────────────────────────────────────────────
        if USERS_FILE.exists():
            users = json.loads(USERS_FILE.read_text())
            for u in users:
                existing = await db.get(User, u["email"])
                if not existing:
                    db.add(User(email=u["email"], name=u["name"], password=u.get("password", "")))
            await db.commit()
            print(f"Migrated {len(users)} user(s).")

        # ── Portfolio ────────────────────────────────────────────────────────
        if PORTFOLIO_FILE.exists():
            data = json.loads(PORTFOLIO_FILE.read_text())
            # Portfolio JSON has a user_id field; default to first user if missing
            user_id = data.get("user_id", "1")
            # Map numeric id → email if possible
            if USERS_FILE.exists():
                users_data = json.loads(USERS_FILE.read_text())
                matched = next((u["email"] for u in users_data if str(u.get("id")) == str(user_id)), None)
                if matched:
                    user_id = matched

            existing = await db.get(Portfolio, user_id)
            if not existing:
                db.add(Portfolio(user_id=user_id, data=data))
                await db.commit()
                print(f"Migrated portfolio for user '{user_id}'.")
            else:
                print(f"Portfolio for '{user_id}' already exists — skipping.")

        # ── Memory ───────────────────────────────────────────────────────────
        migrated_memories = 0
        if MEMORY_DIR.exists():
            for mem_file in MEMORY_DIR.glob("*.json"):
                user_id = mem_file.stem  # filename is the email
                try:
                    entries = json.loads(mem_file.read_text())
                    if not isinstance(entries, list):
                        entries = [entries]
                    for e in entries:
                        db.add(Memory(
                            id=e.get("id", str(uuid.uuid4())),
                            user_id=user_id,
                            type=e.get("type", "user_fact"),
                            content=e.get("content", ""),
                            session_id=e.get("sessionId", e.get("session_id", "")),
                            created_at=datetime.fromisoformat(e["createdAt"].replace("Z", "+00:00"))
                            if e.get("createdAt") else datetime.now(timezone.utc),
                        ))
                        migrated_memories += 1
                    await db.commit()
                except Exception as exc:
                    print(f"Warning: could not migrate {mem_file.name}: {exc}")
        print(f"Migrated {migrated_memories} memory entries.")

    print("Migration complete.")


if __name__ == "__main__":
    asyncio.run(migrate())
