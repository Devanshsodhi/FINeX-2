"""Gmail action — list all labels (system + user). Needed to map label names → ids."""

from __future__ import annotations

from typing import Any

from app.services.tools.context import Context

from ._utils import run_blocking


async def list_labels(
    ctx: Context,
    client: Any,
    args: dict[str, Any],
) -> dict[str, Any]:
    response = await run_blocking(
        lambda: client.users().labels().list(userId="me").execute()
    )

    labels = response.get("labels") or []
    return {
        "count": len(labels),
        "labels": [
            {
                "id": lbl.get("id"),
                "name": lbl.get("name"),
                "type": lbl.get("type"),  # "system" or "user"
            }
            for lbl in labels
        ],
    }
