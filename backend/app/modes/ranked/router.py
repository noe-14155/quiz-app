import json
import random
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.auth.router import get_current_user
from app.core.db import get_connection
from app.questions import service as questions_service
from app.modes.ranked import rank_config

router = APIRouter(prefix="/api/ranked", tags=["ranked"])


def _pick_weighted_questions(tier: int, nb: int):
    weights = rank_config.weights_for_tier(tier)
    all_questions = questions_service.fetch_questions(limit=100000, hide_answer=False, allow_repeat=False)
    by_difficulty = {d: [q for q in all_questions if q["difficulte"] == d] for d in range(1, 6)}

    picked, used_ids = [], set()
    for _ in range(nb):
        total = sum(weights) or 1
        target, acc, target_diff = random.uniform(0, total), 0, 1
        for i, w in enumerate(weights):
            acc += w
            if target < acc:
                target_diff = i + 1
                break
        pool = [q for q in by_difficulty.get(target_diff, []) if q["id"] not in used_ids]
        if not pool:
            pool = [q for q in all_questions if q["id"] not in used_ids]
        if not pool:
            break
        q = random.choice(pool)
        used_ids.add(q["id"])
        picked.append(questions_service.shuffle_choices(q))
    return picked


@router.post("/start")
def start_party(user=Depends(get_current_user)):
    picked = _pick_weighted_questions(user["rank_tier"], rank_config.NB_QUESTIONS_PER_PARTY)

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO parties (user_id, mode, score, questions_data, created_at) VALUES (?,?,?,?,?)",
        (user["id"], "ranked", 0, json.dumps(picked), datetime.now(timezone.utc).isoformat()),
    )
    party_id = cur.lastrowid
    conn.commit()
    conn.close()

    public_questions = [{k: v for k, v in q.items() if k not in ("bonne_reponse", "explication")} for q in picked]
    return {
        "party_id": party_id,
        "questions": public_questions,
        "gain_if_correct": rank_config.GAIN_CORRECT,
        "loss_if_wrong": rank_config.loss_for_tier(user["rank_tier"]),
        "loss_if_pass": rank_config.LOSS_PASS,
    }


class AnswerPayload(BaseModel):
    party_id: int
    question_id: int
    choice: Optional[int] = None  # None = le joueur a passé la question


@router.post("/answer")
def submit_answer(payload: AnswerPayload, user=Depends(get_current_user)):
    conn = get_connection()
    party = conn.execute(
        "SELECT * FROM parties WHERE id = ? AND user_id = ?", (payload.party_id, user["id"])
    ).fetchone()
    if not party:
        conn.close()
        raise HTTPException(status_code=404, detail="Partie introuvable")

    questions_data = json.loads(party["questions_data"])
    question = next((q for q in questions_data if q["id"] == payload.question_id), None)
    if not question:
        conn.close()
        raise HTTPException(status_code=404, detail="Question introuvable dans cette partie")

    tier = user["rank_tier"]
    if payload.choice is None:
        delta, result, correct = -rank_config.LOSS_PASS, "passee", False
    else:
        correct = payload.choice == question["bonne_reponse"] - 1
        delta = rank_config.GAIN_CORRECT if correct else -rank_config.loss_for_tier(tier)
        result = "bonne" if correct else "mauvaise"

    new_tier, new_points = rank_config.apply_delta(tier, user["rank_points"], delta)
    now = datetime.now(timezone.utc).isoformat()

    conn.execute("UPDATE users SET rank_tier = ?, rank_points = ? WHERE id = ?", (new_tier, new_points, user["id"]))
    conn.execute(
        "INSERT INTO question_results (user_id, question_id, result, updated_at) VALUES (?,?,?,?) "
        "ON CONFLICT(user_id, question_id) DO UPDATE SET result = excluded.result, updated_at = excluded.updated_at",
        (user["id"], payload.question_id, result, now),
    )
    conn.commit()
    conn.close()

    return {
        "correct": correct,
        "delta_points": delta,
        "bonne_reponse": question["bonne_reponse"],
        "explication": question["explication"],
        "new_tier": new_tier,
        "new_points": new_points,
    }


@router.get("/leaderboard")
def leaderboard(limit: int = 20):
    conn = get_connection()
    rows = conn.execute(
        "SELECT pseudo, rank_tier, rank_points FROM users ORDER BY rank_tier DESC, rank_points DESC LIMIT ?",
        (limit,),
    ).fetchall()
    conn.close()
    return {"leaderboard": [dict(r) for r in rows]}
