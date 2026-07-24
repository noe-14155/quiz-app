from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth.router import get_current_user_optional
from app.profile.xp import xp_for_difficulty, award_xp

from app.modes.local.games import mise, questions_mode
from app.modes.local.registry import LOCAL_GAMES
from app.modes.admin.service import is_mode_enabled
from app.profile.activity import log_event

router = APIRouter(prefix="/api/local", tags=["local"])


def _parse_exclude(exclude_ids: Optional[str]):
    """Liste d'identifiants à exclure, tolérante aux valeurs vides ou mal
    formées : un paramètre d'URL bricolé renvoyait une erreur 500 alors qu'il
    suffit de l'ignorer."""
    if not exclude_ids:
        return []
    out = []
    for morceau in exclude_ids.split(","):
        morceau = morceau.strip()
        if morceau.isdigit():
            out.append(int(morceau))
    return out


@router.get("/games")
def list_games():
    log_event("local_start")
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


class LocalXp(BaseModel):
    player_name: str
    difficultes: list[int]


@router.post("/xp")
def local_xp(payload: LocalXp, user=Depends(get_current_user_optional)):
    """XP du mode local.

    Le mode se joue à plusieurs sur un seul appareil : impossible de savoir qui
    est qui. Règle retenue, la seule sans ambiguïté : l'XP n'est attribuée que
    si le nom du joueur correspond EXACTEMENT au compte connecté. Les autres
    participants jouent sans compte, donc sans XP — ce qui est cohérent, ils ne
    se sont pas identifiés.
    """
    if not user or payload.player_name.strip().lower() != user["pseudo"].lower():
        return {"xp_gagnee": 0, "raison": "nom différent du compte connecté"}
    total = sum(xp_for_difficulty(d) for d in payload.difficultes[:50])
    if total:
        award_xp(user["id"], total)
    return {"xp_gagnee": total}
