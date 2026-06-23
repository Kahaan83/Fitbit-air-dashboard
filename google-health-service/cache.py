import sqlite3
import json
import os
from pathlib import Path

DB_PATH = Path(os.getenv("CACHE_DB_PATH", "cache.db"))
_db: sqlite3.Connection | None = None

def _conn() -> sqlite3.Connection:
    global _db
    if _db is None:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        _db = sqlite3.connect(DB_PATH, check_same_thread=False)
        _db.execute("PRAGMA journal_mode=WAL")
        _db.execute("""
            CREATE TABLE IF NOT EXISTS day_cache (
                date TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                cached_at TEXT NOT NULL
            )
        """)
        _db.commit()
    return _db

def get_day(date: str) -> dict | None:
    row = _conn().execute(
        "SELECT data FROM day_cache WHERE date = ?", (date,)
    ).fetchone()
    return json.loads(row[0]) if row else None

def set_day(date: str, data: dict):
    con = _conn()
    con.execute(
        "INSERT OR REPLACE INTO day_cache (date, data, cached_at) VALUES (?,?,datetime('now'))",
        (date, json.dumps(data, default=str))
    )
    con.commit()

def get_days(dates: list[str]) -> dict[str, dict]:
    if not dates:
        return {}
    placeholders = ",".join("?" * len(dates))
    rows = _conn().execute(
        f"SELECT date, data FROM day_cache WHERE date IN ({placeholders})",
        dates
    ).fetchall()
    return {r[0]: json.loads(r[1]) for r in rows}

def evict_before(cutoff_date: str):
    """Remove days older than cutoff to prevent unbounded growth."""
    con = _conn()
    con.execute("DELETE FROM day_cache WHERE date < ?", (cutoff_date,))
    con.commit()
