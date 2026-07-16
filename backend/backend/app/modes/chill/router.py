from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth.router import get_current_user_optional
from app.questions import service as questions_service
from app.profile.xp import xp_for_difficulty, award_xp
from app.modes.admin.service import is_mode_enabled

router = APIRouter(prefix="/api/chill", tags=["chill"])


@router.get("/questions")
def get_chill_questions(themes: str, difficulte_max: int, nb: int = 10):
    if not is_mode_enabled("mode_chill_enabled"):
        raise HTTPException(status_code=403, detail="Le mode chill est temporairement désactivé")
    theme_list = themes.split(",")
    questions = questions_service.fetch_questions(
        themes=theme_list, difficulte_max=difficulte_max, limit=nb, hide_answer=True, allow_repeat=True,
    )
    return {"questions": questions}


class ChillAnswerPayload(BaseModel):
    question_id: int
    choice: int
    choix: List[str]  # le tableau de réponses EXACTEMENT tel qu'affiché au joueur


@router.post("/answer")
def submit_chill_answer(payload: ChillAnswerPayload, user=Depends(get_current_user_optional)):
    question = questions_service.get_question_by_id(payload.question_id)
    if not question:
        return {"correct": False, "explication": None}

    # /questions et /answer mélangent chacun indépendamment les réponses, donc
    # la position vue par le joueur ne correspond pas à celle relue ici. On
    # retrouve la bonne réponse par son TEXTE, puis on renvoie son index tel
    # qu'il apparaît dans le tableau du CLIENT (payload.choix) — jamais dans
    # un tableau recalculé côté serveur — pour garantir que l'affichage colore
    # exactement le bon bouton, sans recherche approximative côté navigateur.
    correct_text = question["choix"][question["bonne_reponse"] - 1]
    correct = payload.choix[payload.choice] == correct_text
    correct_index_in_client_array = payload.choix.index(correct_text) if correct_text in payload.choix else None

    if user and correct:
        award_xp(user["id"], xp_for_difficulty(question["difficulte"]))

    return {
        "correct": correct,
        "explication": question["explication"],
        "correct_index": correct_index_in_client_array,
    }
