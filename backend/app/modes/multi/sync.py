"""Synchronisation du mode multijoueur.

PRINCIPE DE LA REFONTE (architecture "l'hôte pilote") :
- L'avancement de la partie (résolution d'une manche, passage à la question
  suivante, fin de partie) est déclenché EXCLUSIVEMENT par l'hôte, via
  l'endpoint /tick. Un seul écrivain pour la logique de jeu = plus aucune
  condition de course entre plusieurs joueurs qui interrogeaient l'état en même
  temps (c'était la cause racine des plantages : chaque appareil pouvait faire
  avancer la partie via /state, d'où des écritures concurrentes et des verrous).
- /state est désormais en LECTURE SEULE : il ne modifie jamais la base. Tous les
  joueurs (hôte compris) l'interrogent pour afficher l'état, sans risque.
- Les joueurs ne font qu'écrire LEUR propre réponse (/answer), ce qui n'entre
  jamais en conflit (chaque ligne est distincte).
- Si l'hôte quitte, la partie s'arrête pour tout le monde (/leave par l'hôte
  passe le statut à 'finished').
"""
import json
from datetime import datetime, timezone

from app.core.db import get_connection
from app.questions import service as questions_service
from app.profile.xp import xp_for_difficulty, award_xp_by_pseudo
from app.modes.admin.service import get_settings

BASE_POINTS = 5
SPEED_BONUS_MAX = 5


def time_per_question() -> int:
    return int(get_settings()["multi_time_per_question"])


def reveal_seconds() -> int:
    return int(get_settings()["multi_reveal_seconds"])


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Démarrage
# ---------------------------------------------------------------------------

def start_game(code: str):
    conn = get_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        room = conn.execute("SELECT * FROM multi_rooms WHERE code = ?", (code,)).fetchone()
        if not room:
            conn.rollback()
            return None
        themes = json.loads(room["themes"]) or None
        candidates = questions_service.fetch_questions(
            themes=themes, difficulte_max=room["difficulte"], limit=room["nb_questions"],
            hide_answer=False, allow_repeat=True,
        )
        question_ids = [q["id"] for q in candidates]
        players = json.loads(room["players"])

        conn.execute(
            "UPDATE multi_rooms SET status='playing', phase='answering', question_ids=?, "
            "questions_data=?, current_index=0, question_started_at=? WHERE code=?",
            (json.dumps(question_ids), json.dumps(candidates), _now_iso(), code),
        )
        for p in players:
            conn.execute(
                "INSERT INTO multi_scores (room_code, player_name, score) VALUES (?,?,0) "
                "ON CONFLICT(room_code, player_name) DO UPDATE SET score = 0",
                (code, p),
            )
        conn.commit()
        return question_ids
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Réponse d'un joueur (écrit uniquement SA ligne — jamais de conflit)
# ---------------------------------------------------------------------------

def submit_answer(code: str, question_index: int, player_name: str, choice: int):
    conn = get_connection()
    try:
        conn.execute(
            "INSERT OR IGNORE INTO multi_answers (room_code, question_index, player_name, choice, answered_at) "
            "VALUES (?,?,?,?,?)",
            (code, question_index, player_name, choice, _now_iso()),
        )
        conn.commit()
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Lecture de l'état — STRICTEMENT en lecture seule (aucune écriture)
# ---------------------------------------------------------------------------

def get_state(code: str):
    conn = get_connection()
    try:
        room_row = conn.execute("SELECT * FROM multi_rooms WHERE code = ?", (code,)).fetchone()
        if not room_row:
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

        scores_rows = conn.execute("SELECT player_name, score FROM multi_scores WHERE room_code = ?", (code,)).fetchall()
        scores = {r["player_name"]: r["score"] for r in scores_rows}
    finally:
        conn.close()

    current_question = None
    if room["status"] in ("playing", "finished") and question_ids and room["current_index"] < len(question_ids):
        all_questions = json.loads(room["questions_data"]) if room.get("questions_data") else []
        if room["current_index"] < len(all_questions):
            current_question = dict(all_questions[room["current_index"]])
            # En phase de réponse, on masque la bonne réponse ; en phase reveal on la montre.
            if room["phase"] == "answering":
                current_question = {k: v for k, v in current_question.items() if k not in ("bonne_reponse", "explication")}

    return {
        "room": room,
        "current_question": current_question,
        "answers": answers,
        "scores": scores,
        "time_per_question": time_per_question(),
        "reveal_seconds": reveal_seconds(),
        "server_now": _now_iso(),
    }


# ---------------------------------------------------------------------------
# Avancement — RÉSERVÉ À L'HÔTE (/tick). Un seul écrivain pour la logique.
# ---------------------------------------------------------------------------

def tick(code: str):
    """Fait avancer la partie si c'est le moment. Appelé uniquement par l'hôte.
    Renvoie l'état à jour (comme get_state). Toute la logique d'écriture de jeu
    passe par ici, donc en série, sans concurrence."""
    conn = get_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        room = conn.execute("SELECT * FROM multi_rooms WHERE code = ?", (code,)).fetchone()
        if not room:
            conn.rollback()
            return None
        room = dict(room)
        if room["status"] != "playing":
            conn.rollback()
            return get_state(code)

        players = json.loads(room["players"])
        question_ids = json.loads(room["question_ids"]) if room["question_ids"] else []
        all_questions = json.loads(room["questions_data"]) if room.get("questions_data") else []
        idx = room["current_index"]
        now = datetime.now(timezone.utc)

        if room["phase"] == "answering" and room["question_started_at"] and idx < len(all_questions):
            answers_rows = conn.execute(
                "SELECT player_name, choice, answered_at FROM multi_answers WHERE room_code = ? AND question_index = ?",
                (code, idx),
            ).fetchall()
            answers = {r["player_name"]: {"choice": r["choice"], "answered_at": r["answered_at"]} for r in answers_rows}

            started = datetime.fromisoformat(room["question_started_at"])
            elapsed = (now - started).total_seconds()
            all_answered = len(players) > 0 and all(p in answers for p in players)

            if elapsed >= time_per_question() or all_answered:
                # Résoudre la manche : attribuer les points, passer en phase reveal.
                question = all_questions[idx]
                for player in players:
                    a = answers.get(player)
                    points = 0
                    if a and a["choice"] == question["bonne_reponse"] - 1:
                        answered_at = datetime.fromisoformat(a["answered_at"])
                        tpq = time_per_question()
                        el = max(0, min(tpq, (answered_at - started).total_seconds()))
                        points = round(BASE_POINTS + SPEED_BONUS_MAX * (1 - el / tpq))
                        award_xp_by_pseudo(player, xp_for_difficulty(question["difficulte"]))
                    conn.execute(
                        "UPDATE multi_scores SET score = score + ? WHERE room_code = ? AND player_name = ?",
                        (points, code, player),
                    )
                conn.execute(
                    "UPDATE multi_rooms SET phase='reveal', reveal_started_at=? WHERE code=?",
                    (_now_iso(), code),
                )

        elif room["phase"] == "reveal" and room["reveal_started_at"]:
            started = datetime.fromisoformat(room["reveal_started_at"])
            if (now - started).total_seconds() >= reveal_seconds():
                next_index = idx + 1
                if next_index >= len(question_ids):
                    conn.execute("UPDATE multi_rooms SET status='finished' WHERE code=?", (code,))
                else:
                    conn.execute(
                        "UPDATE multi_rooms SET current_index=?, phase='answering', question_started_at=? WHERE code=?",
                        (next_index, _now_iso(), code),
                    )

        conn.commit()
    except Exception:
        conn.rollback()
        # On ne relève pas : un tick raté sera retenté au prochain appel de l'hôte.
    finally:
        conn.close()

    return get_state(code)


# ---------------------------------------------------------------------------
# Départ de l'hôte → fin de partie pour tout le monde
# ---------------------------------------------------------------------------

def end_game(code: str):
    """Passe la partie en 'finished'. Utilisé quand l'hôte quitte : la partie
    s'arrête pour tous les joueurs (ils le voient au prochain /state)."""
    conn = get_connection()
    try:
        conn.execute("UPDATE multi_rooms SET status='finished' WHERE code=?", (code,))
        conn.commit()
    finally:
        conn.close()
