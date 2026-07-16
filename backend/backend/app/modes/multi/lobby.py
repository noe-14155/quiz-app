import json
import random
from datetime import datetime, timezone

from app.core.db import get_connection

CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ"  # sans O/0 ni I/1, pour éviter les confusions


def generate_code():
    return "".join(random.choice(CODE_CHARS) for _ in range(5))


def create_room(host_name: str):
    code = generate_code()
    conn = get_connection()
    conn.execute(
        "INSERT INTO multi_rooms (code, host_name, players, themes, difficulte, nb_questions, game_mode, status, created_at) "
        "VALUES (?,?,?,?,?,?,?,?,?)",
        (code, host_name, json.dumps([host_name]), json.dumps([]), 3, 10, "classique", "lobby", datetime.now(timezone.utc).isoformat()),
    )
    conn.commit()
    conn.close()
    return code


def get_room(code: str):
    conn = get_connection()
    row = conn.execute("SELECT * FROM multi_rooms WHERE code = ?", (code,)).fetchone()
    conn.close()
    if not row:
        return None
    room = dict(row)
    room["players"] = json.loads(room["players"])
    room["themes"] = json.loads(room["themes"])
    return room


def join_room(code: str, player_name: str):
    conn = get_connection()
    row = conn.execute("SELECT players, status FROM multi_rooms WHERE code = ?", (code,)).fetchone()
    if not row:
        conn.close()
        return None
    if row["status"] != "lobby":
        conn.close()
        return "started"
    players = json.loads(row["players"])
    if player_name not in players:
        players.append(player_name)
        conn.execute("UPDATE multi_rooms SET players = ? WHERE code = ?", (json.dumps(players), code))
        conn.commit()
    conn.close()
    return "ok"


def update_options(code: str, themes=None, difficulte=None, nb_questions=None):
    conn = get_connection()
    if themes is not None:
        conn.execute("UPDATE multi_rooms SET themes = ? WHERE code = ?", (json.dumps(themes), code))
    if difficulte is not None:
        conn.execute("UPDATE multi_rooms SET difficulte = ? WHERE code = ?", (difficulte, code))
    if nb_questions is not None:
        conn.execute("UPDATE multi_rooms SET nb_questions = ? WHERE code = ?", (nb_questions, code))
    conn.commit()
    conn.close()
