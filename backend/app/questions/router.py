from typing import Optional

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.auth.router import get_current_user_optional
from app.auth import rate_limit
from app.core.db import get_connection
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


class ReportPayload(BaseModel):
    question_id: int
    reason: str
    comment: str | None = None


REPORT_REASONS = {
    "reponse_fausse": "La bonne réponse est fausse",
    "explication": "L'explication est incorrecte",
    "ambigue": "Plusieurs réponses possibles",
    "faute": "Faute d'orthographe ou de formulation",
    "autre": "Autre",
}


@router.post("/report")
def report_question(payload: ReportPayload, request: Request, user=Depends(get_current_user_optional)):
    """Signale une question douteuse. Ouvert aux invités (le pseudo est alors
    nul), mais limité pour éviter le spam."""
    rate_limit.check(request, "report", maximum=10, fenetre=300)
    if payload.reason not in REPORT_REASONS:
        raise HTTPException(status_code=422, detail="Motif inconnu")

    conn = get_connection()
    conn.execute(
        "INSERT INTO question_reports (question_id, pseudo, reason, comment, status, created_at) "
        "VALUES (?,?,?,?,'ouvert',?)",
        (payload.question_id, user["pseudo"] if user else None, payload.reason,
         (payload.comment or "")[:300], datetime.now(timezone.utc).isoformat()),
    )
    conn.commit()
    conn.close()
    return {"ok": True}


@router.get("/report/reasons")
def report_reasons():
    """Motifs proposés au joueur."""
    return {"reasons": [{"code": k, "label": v} for k, v in REPORT_REASONS.items()]}
