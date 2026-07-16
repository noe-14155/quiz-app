from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth.router import get_current_user_optional
from app.questions import service as questions_service
from app.profile.xp import xp_for_difficulty, award_xp

router = APIRouter(prefix="/api/chill", tags=["chill"])


@router.get("/questions")
def get_chill_questions(themes: str, difficulte_max: int, nb: int = 10):
    theme_list = themes.split(",")
    questions = questions_service.fetch_questions(
        themes=theme_list, difficulte_max=difficulte_max, limit=nb, hide_answer=True, allow_repeat=True,
    )
    return {"questions": questions}


class ChillAnswerPayload(BaseModel):
    question_id: int
    choice: int


@router.post("/answer")
def submit_chill_answer(payload: ChillAnswerPayload, user=Depends(get_current_user_optional)):
    question = questions_service.get_question_by_id(payload.question_id)
    if not question:
        return {"correct": False, "explication": None}
    correct = payload.choice == question["bonne_reponse"] - 1

    # Le mode chill compte pour l'XP (si connecté), mais PAS pour les stats
    # de thème du profil — seul le mode classé alimente ces stats-là.
    if user and correct:
        award_xp(user["id"], xp_for_difficulty(question["difficulte"]))

    return {"correct": correct, "explication": question["explication"], "bonne_reponse": question["bonne_reponse"]}
