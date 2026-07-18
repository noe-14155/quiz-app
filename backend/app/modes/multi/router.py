from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.modes.multi import lobby, sync
from app.modes.admin.service import is_mode_enabled
from app.profile.activity import log_event

router = APIRouter(prefix="/api/multi", tags=["multi"])


class CreateRoomPayload(BaseModel):
    host_name: str


class JoinRoomPayload(BaseModel):
    player_name: str


class OptionsPayload(BaseModel):
    themes: Optional[List[str]] = None
    difficulte: Optional[int] = None
    nb_questions: Optional[int] = None


class AnswerPayload(BaseModel):
    player_name: str
    choice: int


@router.post("/create")
def create_room(payload: CreateRoomPayload):
    if not is_mode_enabled("mode_multi_enabled"):
        raise HTTPException(status_code=403, detail="Le mode multi est temporairement désactivé")
    code = lobby.create_room(payload.host_name)
    log_event("multi_create", pseudo=payload.host_name)
    return {"code": code}


@router.get("/{code}")
def get_room(code: str):
    room = lobby.get_room(code)
    if not room:
        raise HTTPException(status_code=404, detail="Partie introuvable")
    return room


@router.post("/{code}/join")
def join_room(code: str, payload: JoinRoomPayload):
    result = lobby.join_room(code, payload.player_name)
    if result is None:
        raise HTTPException(status_code=404, detail="Partie introuvable")
    if result == "started":
        raise HTTPException(status_code=409, detail="Cette partie a déjà commencé")
    return {"ok": True}


@router.patch("/{code}/options")
def update_options(code: str, payload: OptionsPayload):
    lobby.update_options(code, themes=payload.themes, difficulte=payload.difficulte, nb_questions=payload.nb_questions)
    return {"ok": True}


@router.post("/{code}/start")
def start_game(code: str):
    question_ids = sync.start_game(code)
    if question_ids is None:
        raise HTTPException(status_code=404, detail="Partie introuvable")
    return {"ok": True}


@router.get("/{code}/state")
def get_state(code: str):
    state = sync.get_state(code)
    if state is None:
        raise HTTPException(status_code=404, detail="Partie introuvable")
    return state


@router.post("/{code}/answer")
def answer(code: str, question_index: int, payload: AnswerPayload):
    sync.submit_answer(code, question_index, payload.player_name, payload.choice)
    return {"ok": True}
