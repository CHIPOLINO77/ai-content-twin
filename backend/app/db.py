import sqlite3
from pathlib import Path
from typing import Any

DB_PATH = Path(__file__).resolve().parents[2] / "data" / "content_twin.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with connect() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS videos (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            path TEXT NOT NULL,
            size INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'uploaded',
            transcript TEXT DEFAULT '',
            error TEXT DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS analyses (
            video_id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            FOREIGN KEY(video_id) REFERENCES videos(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS profiles (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            data TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        """)
        db.commit()

def insert_video(video_id: str, filename: str, path: str, size: int):
    with connect() as db:
        db.execute("INSERT INTO videos(id,filename,path,size) VALUES(?,?,?,?)", (video_id, filename, path, size))
        db.commit()

def get_video(video_id: str):
    with connect() as db:
        row = db.execute("SELECT * FROM videos WHERE id=?", (video_id,)).fetchone()
        return dict(row) if row else None

def list_videos():
    with connect() as db:
        return [dict(r) for r in db.execute("SELECT id,filename,size,status,error,created_at FROM videos ORDER BY created_at DESC").fetchall()]

def update_video(video_id: str, **fields: Any):
    allowed = {"status", "transcript", "error"}
    fields = {k:v for k,v in fields.items() if k in allowed}
    if not fields: return
    sql = ", ".join(f"{k}=?" for k in fields)
    with connect() as db:
        db.execute(f"UPDATE videos SET {sql} WHERE id=?", (*fields.values(), video_id))
        db.commit()

def save_analysis(video_id: str, data: str):
    with connect() as db:
        db.execute("INSERT OR REPLACE INTO analyses(video_id,data) VALUES(?,?)", (video_id, data))
        db.commit()

def get_analyses():
    with connect() as db:
        return [{"video_id": r["video_id"], "data": r["data"]} for r in db.execute("SELECT video_id,data FROM analyses").fetchall()]

def save_profile(data: str):
    with connect() as db:
        db.execute("INSERT OR REPLACE INTO profiles(id,data,updated_at) VALUES(1,?,CURRENT_TIMESTAMP)", (data,))
        db.commit()

def get_profile():
    with connect() as db:
        row = db.execute("SELECT data,updated_at FROM profiles WHERE id=1").fetchone()
        return dict(row) if row else None
