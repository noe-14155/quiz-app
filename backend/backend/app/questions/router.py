from typing import Optional

from fastapi import APIRouter

from app.questions import service

router = APIRouter(prefix="/api", tags=["questions"])


@router.get("/themes")
def get_themes():
    return {"themes": service.get_themes()}


@router.get("/questions")
def get_questions(theme: Optional[str] = None, difficulte_max: Optional[int] = None, limit: int = 10):
    """Utilisé notamment par le mode chill : thème(s), difficulté maximum, nombre de questions."""
    themes = theme.split(",") if theme else None
    questions = service.fetch_questions(themes=themes, difficulte_max=difficulte_max, limit=limit, hide_answer=True)
    return {"questions": questions}
