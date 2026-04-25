"""Shared helpers for Google Calendar actions."""

from __future__ import annotations

from app.services.tools.connectors._google_utils import run_blocking


def ensure_datetime(dt: str) -> str:
    """If dt is a date-only string (YYYY-MM-DD), append T00:00:00 so the Calendar API accepts it as a dateTime."""
    return dt if "T" in dt else f"{dt}T00:00:00"


__all__ = ["run_blocking", "ensure_datetime"]
