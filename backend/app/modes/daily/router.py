from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth.router import get_current_user_optional
from app.questions import service as questions_service
from app.modes.daily import service as daily_service
from app.modes.admin.service import is_mode_enabled
from app.profile.xp import xp_for_difficulty, award_xp
from app.profile.activity import log_event

router = APIRouter(prefix="/api/daily", tags=["daily"])


def _require_enabled():
    if not is_mode_enabled("mode_daily_enabled"):
        raise HTTPException(status_code=403, detail="Le défi du jour est temporairement désactivé")


@router.get("/today")
def today(user=Depends(get_current_user_optional)):
    """État du défi du jour pour ce joueur : questions à jouer, ou son score
    s'il a déjà joué, plus le classement du jour."""
    _require_enabled()
    pseudo = user["pseudo"] if user else None
    already = daily_service.has_played(pseudo) if pseudo else None
    return {
        "date": daily_service.today_str(),
        "already_played": already,  # {score, total} ou None
        "questions": None if already else daily_service.get_daily_questions(hide_answer=True),
        "leaderboard": daily_service.leaderboard(),
    }


class DailySubmit(BaseModel):
    answers: List[Optional[int]]  # index choisi pour chaque question (ou None)


@router.post("/submit")
def submit(payload: DailySubmit, user=Depends(get_current_user_optional)):
    """Corrige la série du jour côté serveur (empêche la triche) et enregistre
    le score. Une seule tentative comptée par jour et par compte."""
    _require_enabled()
    full = daily_service.get_daily_questions(hide_answer=False)
    score = 0
    details = []
    for i, q in enumerate(full):
        correct_idx = q["bonne_reponse"] - 1
        given = payload.answers[i] if i < len(payload.answers) else None
        ok = given == correct_idx
        if ok:
            score += 1
        details.append({
            "correct_index": correct_idx,
            "given": given,
            "correct": ok,
            "explication": q["explication"],
        })

    pseudo = user["pseudo"] if user else None
    already = daily_service.has_played(pseudo) if pseudo else None

    # On n'enregistre (et ne donne l'XP) que si connecté ET pas déjà joué.
    if pseudo and not already:
        daily_service.record_attempt(pseudo, user["id"], score, len(full))
        # XP proportionnelle aux bonnes réponses (mêmes règles que les autres modes).
        for i, q in enumerate(full):
            if details[i]["correct"]:
                award_xp(user["id"], xp_for_difficulty(q["difficulte"]))

    log_event("daily_start", user_id=user["id"] if user else None, pseudo=pseudo)

    return {
        "score": score,
        "total": len(full),
        "details": details,
        "recorded": bool(pseudo and not already),
        "leaderboard": daily_service.leaderboard(),
    }
