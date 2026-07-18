import json
from datetime import datetime, timezone

from app.core.db import get_connection
from app.questions import service as questions_service
from app.profile.xp import xp_for_difficulty, award_xp_by_pseudo
from app.modes.admin.service import get_settings

BASE_POINTS = 5
SPEED_BONUS_MAX = 5


# Ces durées étaient des constantes figées : les modifier depuis la page
# d'administration n'avait donc aucun effet. Elles sont désormais lues à
# chaque usage depuis les réglages (get_settings est mis en cache mémoire,
# donc ça ne coûte pas une requête SQL à chaque appel).
def time_per_question() -> int:
    return int(get_settings()["multi_time_per_question"])


def reveal_seconds() -> int:
    return int(get_settings()["multi_reveal_seconds"])


def start_game(code: str):
    conn = get_connection()
    room = conn.execute("SELECT * FROM multi_rooms WHERE code = ?", (code,)).fetchone()
    if not room:
        conn.close()
        return None

    themes = json.loads(room["themes"]) or None
    candidates = questions_service.fetch_questions(
        themes=themes, difficulte_max=room["difficulte"], limit=room["nb_questions"],
        hide_answer=False, allow_repeat=True,
    )
    question_ids = [q["id"] for q in candidates]
    players = json.loads(room["players"])

    conn.execute(
        "UPDATE multi_rooms SET status='playing', phase='answering', question_ids=?, questions_data=?, current_index=0, question_started_at=? WHERE code=?",
        (json.dumps(question_ids), json.dumps(candidates), datetime.now(timezone.utc).isoformat(), code),
    )
    for p in players:
        conn.execute(
            "INSERT INTO multi_scores (room_code, player_name, score) VALUES (?,?,0) "
            "ON CONFLICT(room_code, player_name) DO UPDATE SET score = 0",
            (code, p),
        )
    conn.commit()
    conn.close()
    return question_ids


def submit_answer(code: str, question_index: int, player_name: str, choice: int):
    """INSERT OR IGNORE : chaque joueur n'écrit que sa propre ligne, jamais
    celle d'un autre. Deux joueurs qui répondent au même instant ne peuvent
    plus s'écraser mutuellement, contrairement au prototype JSX."""
    conn = get_connection()
    conn.execute(
        "INSERT OR IGNORE INTO multi_answers (room_code, question_index, player_name, choice, answered_at) VALUES (?,?,?,?,?)",
        (code, question_index, player_name, choice, datetime.now(timezone.utc).isoformat()),
    )
    conn.commit()
    conn.close()


def get_state(code: str):
    """Renvoie l'état courant ET fait avancer la partie si besoin. N'importe
    quel appareil qui interroge cet endpoint peut déclencher l'avancement :
    pas besoin qu'un hôte unique soit responsable de la synchronisation."""
    conn = get_connection()
    room_row = conn.execute("SELECT * FROM multi_rooms WHERE code = ?", (code,)).fetchone()
    if not room_row:
        conn.close()
        return None
    room = dict(room_row)
    room["players"] = json.loads(room["players"])
    room["themes"] = json.loads(room["themes"])
    question_ids = json.loads(room["question_ids"]) if room["question_ids"] else []

    answers_rows = conn.execute(
        "SELECT player_name, choice, answered_at FROM multi_answers WHERE room_code = ? AND question_index = ?",
        (code, room["current_index"]),
    ).fetchall()
    answers = {r["player_name"]: {"choice": r["choice"], "answered_at": r["answered_at"]} for r in answers_rows}
    conn.close()

    if room["status"] == "playing":
        _maybe_advance(code, room, answers, question_ids)
        # relit l'état après un éventuel avancement
        conn = get_connection()
        room_row = conn.execute("SELECT * FROM multi_rooms WHERE code = ?", (code,)).fetchone()
        room = dict(room_row)
        room["players"] = json.loads(room["players"])
        room["themes"] = json.loads(room["themes"])
        answers_rows = conn.execute(
            "SELECT player_name, choice, answered_at FROM multi_answers WHERE room_code = ? AND question_index = ?",
            (code, room["current_index"]),
        ).fetchall()
        answers = {r["player_name"]: {"choice": r["choice"], "answered_at": r["answered_at"]} for r in answers_rows}
        conn.close()

    current_question = None
    if room["status"] in ("playing", "finished") and question_ids and room["current_index"] < len(question_ids):
        all_questions = json.loads(room["questions_data"]) if room.get("questions_data") else []
        current_question = all_questions[room["current_index"]] if room["current_index"] < len(all_questions) else None
        if current_question and room["phase"] == "answering":
            current_question = {k: v for k, v in current_question.items() if k not in ("bonne_reponse", "explication")}

    conn = get_connection()
    scores_rows = conn.execute("SELECT player_name, score FROM multi_scores WHERE room_code = ?", (code,)).fetchall()
    scores = {r["player_name"]: r["score"] for r in scores_rows}
    conn.close()

    return {
        "room": room,
        "current_question": current_question,
        "answers": answers,
        "scores": scores,
        # Durées transmises au client : sans ça, sa barre de temps utilisait ses
        # propres constantes figées et se désynchronisait dès qu'un admin
        # changeait les réglages.
        "time_per_question": time_per_question(),
        "reveal_seconds": reveal_seconds(),
    }


def _maybe_advance(code, room, answers, question_ids):
    now = datetime.now(timezone.utc)
    if room["phase"] == "answering" and room["question_started_at"]:
        started = datetime.fromisoformat(room["question_started_at"])
        elapsed = (now - started).total_seconds()
        all_answered = len(room["players"]) > 0 and all(p in answers for p in room["players"])
        if elapsed >= time_per_question() or all_answered:
            _resolve_round(code, room, answers, question_ids)
    elif room["phase"] == "reveal" and room["reveal_started_at"]:
        started = datetime.fromisoformat(room["reveal_started_at"])
        elapsed = (now - started).total_seconds()
        if elapsed >= reveal_seconds():
            _advance_question(code, room, question_ids)


def _resolve_round(code, room, answers, question_ids):
    conn = get_connection()
    all_questions = json.loads(room["questions_data"]) if room.get("questions_data") else []
    question = all_questions[room["current_index"]]
    started = datetime.fromisoformat(room["question_started_at"])

    for player in room["players"]:
        a = answers.get(player)
        points = 0
        if a and a["choice"] == question["bonne_reponse"] - 1:
            answered_at = datetime.fromisoformat(a["answered_at"])
            tpq = time_per_question()
            elapsed = max(0, min(tpq, (answered_at - started).total_seconds()))
            bonus = SPEED_BONUS_MAX * (1 - elapsed / tpq)
            points = round(BASE_POINTS + bonus)
            # Attribue de l'XP si ce nom de joueur correspond à un vrai compte
            # (le multi n'exige pas d'être connecté, donc ce n'est pas toujours le cas).
            award_xp_by_pseudo(player, xp_for_difficulty(question["difficulte"]))
        conn.execute(
            "UPDATE multi_scores SET score = score + ? WHERE room_code = ? AND player_name = ?",
            (points, code, player),
        )
    conn.execute(
        "UPDATE multi_rooms SET phase='reveal', reveal_started_at=? WHERE code=?",
        (datetime.now(timezone.utc).isoformat(), code),
    )
    conn.commit()
    conn.close()


def _advance_question(code, room, question_ids):
    conn = get_connection()
    next_index = room["current_index"] + 1
    if next_index >= len(question_ids):
        conn.execute("UPDATE multi_rooms SET status='finished' WHERE code=?", (code,))
    else:
        conn.execute(
            "UPDATE multi_rooms SET current_index=?, phase='answering', question_started_at=? WHERE code=?",
            (next_index, datetime.now(timezone.utc).isoformat(), code),
        )
    conn.commit()
    conn.close()
