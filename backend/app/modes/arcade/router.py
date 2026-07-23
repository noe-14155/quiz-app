"""Modes courts : Survie et Contre-la-montre.

Deux formats pensés pour une partie de deux minutes, à l'inverse du classé.
Ils partagent la même mécanique : on sert un lot de questions d'avance (pour
éviter un aller-retour réseau à chaque question, fatal au chronomètre), le
client joue, puis renvoie son score.

Le score n'est pas vérifié côté serveur : ces modes n'influencent ni le rang ni
le classement général, seulement un record personnel. Le compromis est assumé,
comme pour le mode chill.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth.router import get_current_user_optional
from app.core.db import get_connection
from app.modes.admin.service import is_mode_enabled
from app.questions import service as questions_service
from app.profile.activity import log_event
from app.profile.xp import xp_for_difficulty, award_xp

router = APIRouter(prefix="/api/arcade", tags=["arcade"])

MODES = {"survie": "Survie", "chrono": "Contre-la-montre"}
CHRONO_SECONDES = 60


def _require_enabled():
    if not is_mode_enabled("mode_arcade_enabled"):
        raise HTTPException(status_code=403, detail="Ces modes sont temporairement désactivés")


@router.get("/survie/questions")
def survie_questions(palier: int = 0, user=Depends(get_current_user_optional)):
    """Lot de 10 questions pour le mode Survie.

    `palier` est le nombre de questions déjà réussies : il pilote la montée en
    difficulté. On commence très facile et on atteint le niveau expert vers la
    25e bonne réponse — assez long pour que la tension monte, assez court pour
    que la partie reste courte.
    """
    _require_enabled()
    if palier == 0:
        log_event("survie_start", user_id=user["id"] if user else None,
                  pseudo=user["pseudo"] if user else None)

    lot = []
    for i in range(10):
        n = palier + i
        if n < 3:
            diff = 1
        elif n < 8:
            diff = 2
        elif n < 15:
            diff = 3
        elif n < 25:
            diff = 4
        else:
            diff = 5
        q = questions_service.fetch_questions(
            themes=None, difficulte=diff, limit=1, hide_answer=False, allow_repeat=True,
        )
        if q:
            lot.append(q[0])
    return {"questions": lot, "palier": palier}


@router.get("/chrono/questions")
def chrono_questions(user=Depends(get_current_user_optional)):
    """Lot unique pour le contre-la-montre : 45 questions plutôt faciles, pour
    que le rythme prime sur la réflexion."""
    _require_enabled()
    log_event("chrono_start", user_id=user["id"] if user else None,
              pseudo=user["pseudo"] if user else None)
    questions = questions_service.fetch_questions(
        themes=None, difficulte_max=3, limit=45, hide_answer=False, allow_repeat=True,
    )
    return {"questions": questions, "duree": CHRONO_SECONDES}


class ArcadeResult(BaseModel):
    mode: str
    score: int
    difficulte_max: Optional[int] = None


@router.post("/finish")
def finish(payload: ArcadeResult, user=Depends(get_current_user_optional)):
    """Enregistre le score et renvoie le record personnel mis à jour."""
    _require_enabled()
    if payload.mode not in MODES:
        raise HTTPException(status_code=422, detail="Mode inconnu")
    if not user:
        return {"record": None, "nouveau_record": False, "score": payload.score}

    conn = get_connection()
    ligne = conn.execute(
        "SELECT score FROM arcade_records WHERE user_id = ? AND mode = ?",
        (user["id"], payload.mode),
    ).fetchone()
    ancien = ligne["score"] if ligne else 0
    nouveau = payload.score > ancien
    if nouveau:
        conn.execute(
            "INSERT INTO arcade_records (user_id, pseudo, mode, score, created_at) VALUES (?,?,?,?,datetime('now')) "
            "ON CONFLICT(user_id, mode) DO UPDATE SET score = excluded.score, created_at = excluded.created_at",
            (user["id"], user["pseudo"], payload.mode, payload.score),
        )
        conn.commit()
    conn.close()

    # XP proportionnelle à la performance, plafonnée pour rester secondaire
    # face au classé.
    if payload.score > 0:
        award_xp(user["id"], min(60, payload.score * 3))

    return {"record": max(ancien, payload.score), "nouveau_record": nouveau, "score": payload.score}


@router.get("/records")
def records(user=Depends(get_current_user_optional)):
    """Meilleurs scores : les siens et le top général, pour chaque mode."""
    conn = get_connection()
    out = {}
    for code in MODES:
        top = conn.execute(
            "SELECT pseudo, score FROM arcade_records WHERE mode = ? ORDER BY score DESC LIMIT 5",
            (code,),
        ).fetchall()
        perso = None
        if user:
            r = conn.execute(
                "SELECT score FROM arcade_records WHERE user_id = ? AND mode = ?",
                (user["id"], code),
            ).fetchone()
            perso = r["score"] if r else 0
        out[code] = {"top": [dict(t) for t in top], "perso": perso}
    conn.close()
    return out
