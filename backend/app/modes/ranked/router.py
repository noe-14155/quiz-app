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
from app.profile.xp import xp_for_difficulty, award_xp
from app.profile.activity import log_event
from app.modes.admin.service import is_mode_enabled, get_settings

router = APIRouter(prefix="/api/ranked", tags=["ranked"])


def _pick_weighted_questions(tier: int, nb: int):
    weights = rank_config.weights_for_tier(tier)
    # shuffle=False : on ne mélange que les 10 questions retenues (plus bas),
    # pas les 1114 candidates dont 1104 seront jetées.
    all_questions = questions_service.fetch_questions(
        limit=100000, hide_answer=False, allow_repeat=False, shuffle=False
    )
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


@router.get("/rules")
def get_rules(user=Depends(get_current_user)):
    """Les règles réellement appliquées, lues des réglages d'administration.
    Le frontend les affiche au lieu de valeurs codées en dur, qui se
    désynchronisaient dès qu'un admin changeait le barème."""
    settings = get_settings()
    tier = rank_config.tier_from_points(user["rank_points"])
    return {
        "gain_if_correct": rank_config.gain_for_tier(tier),
        "loss_if_wrong": rank_config.loss_for_tier(tier),
        "loss_if_pass": rank_config.loss_for_pass(tier),
        "can_pass": rank_config.can_pass(user["rank_points"]),
        "time_per_question": int(settings["ranked_time_per_question"]),
        "nb_questions": rank_config.NB_QUESTIONS_PER_PARTY,
    }


@router.post("/start")
def start_party(user=Depends(get_current_user)):
    if not is_mode_enabled("mode_ranked_enabled"):
        raise HTTPException(status_code=403, detail="Le mode classé est temporairement désactivé")
    settings = get_settings()
    gain_correct = int(settings["ranked_gain_correct"])
    loss_pass = int(settings["ranked_loss_pass"])
    tier = rank_config.tier_from_points(user["rank_points"])
    picked = _pick_weighted_questions(tier, rank_config.NB_QUESTIONS_PER_PARTY)

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO parties (user_id, mode, score, questions_data, created_at) VALUES (?,?,?,?,?)",
        (user["id"], "ranked", 0, json.dumps(picked), datetime.now(timezone.utc).isoformat()),
    )
    party_id = cur.lastrowid
    conn.commit()
    conn.close()

    log_event("ranked_start", user_id=user["id"], pseudo=user["pseudo"])

    public_questions = [{k: v for k, v in q.items() if k not in ("bonne_reponse", "explication")} for q in picked]
    return {
        "party_id": party_id,
        "questions": public_questions,
        "gain_if_correct": rank_config.gain_for_tier(tier),
        "loss_if_wrong": rank_config.loss_for_tier(tier),
        "loss_if_pass": rank_config.loss_for_pass(tier),
        "can_pass": rank_config.can_pass(user["rank_points"]),
        "time_per_question": int(settings["ranked_time_per_question"]),
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

    settings = get_settings()
    tier = rank_config.tier_from_points(user["rank_points"])
    if payload.choice is None:
        # Passer est interdit à partir de Diamant : on refuse la requête plutôt
        # que de l'accepter silencieusement (le frontend masque déjà le bouton).
        if not rank_config.can_pass(user["rank_points"]):
            conn.close()
            raise HTTPException(status_code=403, detail="Passer une question n'est plus autorisé à partir de Diamant")
        delta, result, correct = -rank_config.loss_for_pass(tier), "passee", False
    else:
        correct = payload.choice == question["bonne_reponse"] - 1
        # Gain dégressif avec le rang, malus croissant avec le rang.
        delta = rank_config.gain_for_tier(tier) if correct else -rank_config.loss_for_tier(tier)
        result = "bonne" if correct else "mauvaise"

    new_rank_points = rank_config.apply_delta(user["rank_points"], delta)
    new_tier = rank_config.tier_from_points(new_rank_points)
    now = datetime.now(timezone.utc).isoformat()

    conn.execute("UPDATE users SET rank_tier = ?, rank_points = ? WHERE id = ?", (new_tier, new_rank_points, user["id"]))
    conn.execute(
        "INSERT INTO question_results (user_id, question_id, result, updated_at) VALUES (?,?,?,?) "
        "ON CONFLICT(user_id, question_id) DO UPDATE SET result = excluded.result, updated_at = excluded.updated_at",
        (user["id"], payload.question_id, result, now),
    )
    conn.commit()
    conn.close()

    if correct:
        award_xp(user["id"], xp_for_difficulty(question["difficulte"]))

    return {
        "correct": correct,
        "delta_points": delta,
        "bonne_reponse": question["bonne_reponse"],
        "explication": question["explication"],
        "new_tier": new_tier,
        "new_rank_points": new_rank_points,
        "new_progress": rank_config.progress_in_tier(new_rank_points),
    }


@router.get("/leaderboard")
def leaderboard(limit: int = 20):
    """Le tri se fait directement sur le cumul de points — un seul critère,
    sans ambiguïté de palier entre deux joueurs proches."""
    conn = get_connection()
    rows = conn.execute(
        "SELECT pseudo, rank_points FROM users ORDER BY rank_points DESC LIMIT ?",
        (limit,),
    ).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["rank_tier"] = rank_config.tier_from_points(d["rank_points"])
        result.append(d)
    return {"leaderboard": result}
