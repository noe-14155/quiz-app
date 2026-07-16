from typing import Optional

from fastapi import APIRouter, HTTPException

from app.modes.local.games import mise, questions_mode
from app.modes.local.registry import LOCAL_GAMES
from app.modes.admin.service import is_mode_enabled

router = APIRouter(prefix="/api/local", tags=["local"])


def _parse_exclude(exclude_ids: Optional[str]):
    return [int(x) for x in exclude_ids.split(",")] if exclude_ids else []


@router.get("/games")
def list_games():
    return {"games": LOCAL_GAMES}


@router.get("/mise/question")
def mise_question(theme: str, bid: int, exclude_ids: Optional[str] = None):
    if not is_mode_enabled("mode_local_enabled"):
        raise HTTPException(status_code=403, detail="Le mode local est temporairement désactivé")
    q = mise.draw_question(theme, bid, exclude_ids=_parse_exclude(exclude_ids))
    return {"question": q}


@router.get("/questions-mode/question")
def questions_mode_question(themes: str, difficulte_max: int, exclude_ids: Optional[str] = None):
    if not is_mode_enabled("mode_local_enabled"):
        raise HTTPException(status_code=403, detail="Le mode local est temporairement désactivé")
    q = questions_mode.draw_question(themes.split(","), difficulte_max, exclude_ids=_parse_exclude(exclude_ids))
    return {"question": q}
