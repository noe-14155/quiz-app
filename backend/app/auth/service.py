import secrets
from datetime import datetime, timezone

import bcrypt

from app.core.db import get_connection


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_user(pseudo: str, password: str):
    conn = get_connection()
    cur = conn.cursor()
    existing = cur.execute("SELECT id FROM users WHERE pseudo = ?", (pseudo,)).fetchone()
    if existing:
        conn.close()
        return None
    cur.execute(
        "INSERT INTO users (pseudo, password_hash, xp_total, rank_tier, rank_points, created_at) VALUES (?,?,?,?,?,?)",
        (pseudo, hash_password(password), 0, 0, 0, datetime.now(timezone.utc).isoformat()),
    )
    conn.commit()
    user_id = cur.lastrowid
    conn.close()
    return user_id


def verify_login(pseudo: str, password: str):
    conn = get_connection()
    row = conn.execute("SELECT * FROM users WHERE pseudo = ?", (pseudo,)).fetchone()
    conn.close()
    if not row or not verify_password(password, row["password_hash"]):
        return None
    return dict(row)


def create_session(user_id: int) -> str:
    token = secrets.token_hex(24)
    conn = get_connection()
    conn.execute(
        "INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)",
        (token, user_id, datetime.now(timezone.utc).isoformat()),
    )
    conn.commit()
    conn.close()
    return token


def get_user_from_token(token: str):
    conn = get_connection()
    row = conn.execute(
        "SELECT users.* FROM sessions JOIN users ON sessions.user_id = users.id WHERE sessions.token = ?",
        (token,),
    ).fetchone()
    conn.close()
    return dict(row) if row else None
