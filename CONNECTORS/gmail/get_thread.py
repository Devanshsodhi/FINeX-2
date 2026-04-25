"""Gmail action — fetch a whole thread by its id."""

from __future__ import annotations

from typing import Any

from app.services.tools.context import Context

from ._utils import run_blocking


VALID_FORMATS = {"minimal", "full", "raw", "metadata"}


async def get_thread(
    ctx: Context,
    client: Any,
    args: dict[str, Any],
) -> dict[str, Any]:
    thread_id = args["thread_id"]
    fmt = args.get("format", "full")

    if fmt not in VALID_FORMATS:
        raise ValueError(f"Invalid format '{fmt}'. Must be one of: {sorted(VALID_FORMATS)}")

    response = await run_blocking(
        lambda: client.users()
        .threads()
        .get(userId="me", id=thread_id, format=fmt)
        .execute()
    )

    return {
        "id": response.get("id"),
        "history_id": response.get("historyId"),
        "messages": response.get("messages", []),
    }
