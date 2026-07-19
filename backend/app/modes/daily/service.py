"""Défi quotidien : 10 questions identiques pour tous, renouvelées chaque jour.

Principe : la sélection est DÉTERMINISTE à partir de la date. La même date
redonne exactement la même série, sans qu'on ait besoin de la stocker — une
seed dérivée de la date suffit. Difficulté croissante sur les 10 questions
(facile -> dur).
"""
import hashlib
import json
from datetime import datetime, timezone

from app.core.db import get_connection
from app.questions import service as questions_service

NB_QUESTIONS = 10
# Profil de difficulté sur les 10 questions : commence facile, finit dur.
DIFFICULTY_CURVE = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]


def today_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _seed_for(date_str: str, salt: str) -> int:
    """Entier déterministe dérivé de la date (et d'un sel, pour varier le
    tirage d'une position à l'autre sans re-piocher les mêmes questions)."""
    h = hashlib.sha256(f"{date_str}:{salt}".encode()).hexdigest()
    return int(h[:12], 16)


def get_daily_questions(date_str: str = None, hide_answer: bool = True):
    """Construit la série du jour, déterministe. Une question par cran de la
    courbe de difficulté, choisie de façon reproductible dans le pool de cette
    difficulté."""
    date_str = date_str or today_str()
    conn = get_connection()
    picked = []
    used_ids = set()
    for pos, diff in enumerate(DIFFICULTY_CURVE):
        rows = conn.execute(
            "SELECT * FROM questions WHERE difficulte = ? ORDER BY id", (diff,)
        ).fetchall()
        pool = [r for r in rows if r["id"] not in used_ids]
        if not pool:
            # Repli : si un cran de difficulté est épuisé, on prend n'importe
            # quelle question encore non utilisée (déterministe aussi).
            allrows = conn.execute("SELECT * FROM questions ORDER BY id").fetchall()
            pool = [r for r in allrows if r["id"] not in used_ids]
        if not pool:
            break
        idx = _seed_for(date_str, f"{pos}") % len(pool)
        row = pool[idx]
        used_ids.add(row["id"])
        q = questions_service._row_to_dict(row)
        # Mélange déterministe des réponses (même ordre pour tous les joueurs).
        q = questions_service.shuffle_choices(q, seed=_seed_for(date_str, f"shuffle-{pos}"))
        picked.append(q)
    conn.close()

    if hide_answer:
        for q in picked:
            q.pop("bonne_reponse", None)
            q.pop("explication", None)
    return picked


def has_played(pseudo: str, date_str: str = None) -> dict:
    date_str = date_str or today_str()
    conn = get_connection()
    row = conn.execute(
        "SELECT score, total, answers FROM daily_attempts WHERE date = ? AND pseudo = ?",
        (date_str, pseudo),
    ).fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    # answers est stocké en JSON ; on le décode pour l'appelant.
    d["answers"] = json.loads(d["answers"]) if d.get("answers") else None
    return d


def record_attempt(pseudo: str, user_id, score: int, total: int, answers=None, date_str: str = None):
    date_str = date_str or today_str()
    conn = get_connection()
    # INSERT OR IGNORE : une seule tentative par jour, la première fait foi.
    conn.execute(
        "INSERT OR IGNORE INTO daily_attempts (date, pseudo, user_id, score, total, answers, created_at) "
        "VALUES (?,?,?,?,?,?,?)",
        (date_str, pseudo, user_id, score, total, json.dumps(answers) if answers is not None else None,
         datetime.now(timezone.utc).isoformat()),
    )
    conn.commit()
    conn.close()


def leaderboard(date_str: str = None, limit: int = 20):
    date_str = date_str or today_str()
    conn = get_connection()
    rows = conn.execute(
        "SELECT pseudo, score, total, created_at FROM daily_attempts "
        "WHERE date = ? ORDER BY score DESC, created_at ASC LIMIT ?",
        (date_str, limit),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
