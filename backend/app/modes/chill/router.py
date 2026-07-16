from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth.router import get_current_user_optional
from app.core.db import get_connection
from app.questions import service as questions_service

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

    # Le mode chill est jouable sans compte : on n'enregistre les stats que si connecté.
    if user:
        conn = get_connection()
        conn.execute(
            "INSERT INTO question_results (user_id, question_id, result, updated_at) VALUES (?,?,?,?) "
            "ON CONFLICT(user_id, question_id) DO UPDATE SET result = excluded.result, updated_at = excluded.updated_at",
            (user["id"], payload.question_id, "bonne" if correct else "mauvaise", datetime.now(timezone.utc).isoformat()),
        )
        conn.commit()
        conn.close()

    return {"correct": correct, "explication": question["explication"], "bonne_reponse": question["bonne_reponse"]}
