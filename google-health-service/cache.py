import sqlite3
import json
import os
from pathlib import Path

DB_PATH = Path(os.getenv("CACHE_DB_PATH", "cache.db"))

def _conn():
    # Ensure parent directory exists if specified
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.execute("""
        CREATE TABLE IF NOT EXISTS day_cache (
            date TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            cached_at TEXT NOT NULL
        )
    """)
    con.commit()
    return con

def get_day(date: str) -> dict | None:
    with _conn() as con:
        row = con.execute(
            "SELECT data FROM day_cache WHERE date = ?", (date,)
        ).fetchone()
    return json.loads(row[0]) if row else None

def set_day(date: str, data: dict):
    with _conn() as con:
        con.execute(
            "INSERT OR REPLACE INTO day_cache (date, data, cached_at) VALUES (?,?,datetime('now'))",
            (date, json.dumps(data, default=str))
        )

def get_days(dates: list[str]) -> dict[str, dict]:
    if not dates:
        return {}
    placeholders = ",".join("?" * len(dates))
    with _conn() as con:
        rows = con.execute(
            f"SELECT date, data FROM day_cache WHERE date IN ({placeholders})",
            dates
        ).fetchall()
    return {r[0]: json.loads(r[1]) for r in rows}

def evict_before(cutoff_date: str):
    """Remove days older than cutoff to prevent unbounded growth."""
    with _conn() as con:
        con.execute("DELETE FROM day_cache WHERE date < ?", (cutoff_date,))
