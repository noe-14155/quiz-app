"""Duel asynchrone.

Tu défies quelqu'un avec un code ; vous jouez les MÊMES questions, mais chacun
quand il veut. Le résultat s'affiche quand les deux ont terminé.

C'est le remplaçant du mode multi temps réel, qui a été retiré. La différence
est architecturale, pas cosmétique : il n'y a plus rien à synchroniser. Chaque
joueur écrit uniquement sa propre ligne, il n'y a ni horloge partagée, ni
sondage, ni écriture concurrente — donc aucune des pannes qui affectaient le
multi. Et c'est mieux adapté à l'usage réel : les amis ne sont pas connectés au
même moment.
"""
import json
import random
import string
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth.router import get_current_user
from app.core.db import get_connection
from app.modes.admin.service import is_mode_enabled
from app.questions import service as questions_service
from app.profile.activity import log_event
from app.profile.xp import xp_for_difficulty, award_xp

router = APIRouter(prefix="/api/duel", tags=["duel"])

NB_QUESTIONS = 10
ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # sans I, L, O, 0, 1 : illisibles


def _require_enabled():
    if not is_mode_enabled("mode_duel_enabled"):
        raise HTTPException(status_code=403, detail="Les duels sont temporairement désactivés")


def _code():
    return "".join(random.choice(ALPHABET) for _ in range(5))


def _now():
    return datetime.now(timezone.utc).isoformat()


def _duel(conn, code):
    return conn.execute("SELECT * FROM duels WHERE code = ?", (code.upper(),)).fetchone()


def _joueurs(conn, code):
    return conn.execute(
        "SELECT pseudo, score, played_at FROM duel_players WHERE code = ? ORDER BY played_at", (code.upper(),)
    ).fetchall()


@router.post("/create")
def create(user=Depends(get_current_user)):
    """Crée un duel et renvoie son code, à partager avec l'adversaire."""
    _require_enabled()
    questions = questions_service.fetch_questions(
        themes=None, difficulte_max=5, limit=NB_QUESTIONS, hide_answer=False, allow_repeat=True,
    )
    conn = get_connection()
    for _ in range(12):  # quasi impossible d'échouer, mais on borne la boucle
        code = _code()
        if not _duel(conn, code):
            break
    conn.execute(
        "INSERT INTO duels (code, host_pseudo, questions_data, created_at) VALUES (?,?,?,?)",
        (code, user["pseudo"], json.dumps(questions), _now()),
    )
    conn.commit()
    conn.close()
    log_event("duel_start", user_id=user["id"], pseudo=user["pseudo"])
    return {"code": code}


@router.get("/{code}")
def state(code: str, user=Depends(get_current_user)):
    """État du duel : qui a joué, et le résultat si les deux ont terminé."""
    _require_enabled()
    conn = get_connection()
    d = _duel(conn, code)
    if not d:
        conn.close()
        raise HTTPException(status_code=404, detail="Duel introuvable")
    joueurs = [dict(j) for j in _joueurs(conn, code)]
    conn.close()

    moi = next((j for j in joueurs if j["pseudo"] == user["pseudo"]), None)
    termine = len(joueurs) >= 2

    # Les scores ne sont dévoilés qu'une fois les deux passages faits : sinon
    # le second joueur connaîtrait la barre à franchir, ce qui fausse le duel.
    return {
        "code": code.upper(),
        "host": d["host_pseudo"],
        "joue": moi is not None,
        "mon_score": moi["score"] if moi else None,
        "en_attente": len(joueurs) < 2,
        "termine": termine,
        "resultats": joueurs if termine else None,
        "nb_questions": NB_QUESTIONS,
    }


@router.get("/{code}/questions")
def questions(code: str, user=Depends(get_current_user)):
    """Les questions du duel (bonnes réponses masquées)."""
    _require_enabled()
    conn = get_connection()
    d = _duel(conn, code)
    if not d:
        conn.close()
        raise HTTPException(status_code=404, detail="Duel introuvable")
    deja = conn.execute(
        "SELECT 1 FROM duel_players WHERE code = ? AND pseudo = ?", (code.upper(), user["pseudo"])
    ).fetchone()
    nb = conn.execute("SELECT COUNT(*) c FROM duel_players WHERE code = ?", (code.upper(),)).fetchone()["c"]
    conn.close()

    if deja:
        raise HTTPException(status_code=409, detail="Tu as déjà joué ce duel")
    if nb >= 2:
        raise HTTPException(status_code=409, detail="Ce duel est complet")

    full = json.loads(d["questions_data"])
    return {"questions": [{k: v for k, v in q.items() if k not in ("bonne_reponse", "explication")} for q in full]}


class DuelSubmit(BaseModel):
    answers: List[Optional[int]]


@router.post("/{code}/submit")
def submit(code: str, payload: DuelSubmit, user=Depends(get_current_user)):
    """Corrige côté serveur et enregistre le passage."""
    _require_enabled()
    conn = get_connection()
    d = _duel(conn, code)
    if not d:
        conn.close()
        raise HTTPException(status_code=404, detail="Duel introuvable")

    full = json.loads(d["questions_data"])
    score = 0
    details = []
    for i, q in enumerate(full):
        bonne = q["bonne_reponse"] - 1
        donnee = payload.answers[i] if i < len(payload.answers) else None
        ok = donnee == bonne
        if ok:
            score += 1
        details.append({
            "question_id": q["id"], "question": q["question"], "choix": q["choix"],
            "correct_index": bonne, "given": donnee, "correct": ok, "explication": q["explication"],
        })

    conn.execute(
        "INSERT OR IGNORE INTO duel_players (code, pseudo, user_id, score, answers, played_at) VALUES (?,?,?,?,?,?)",
        (code.upper(), user["pseudo"], user["id"], score, json.dumps(payload.answers), _now()),
    )
    conn.commit()
    joueurs = [dict(j) for j in _joueurs(conn, code)]
    conn.close()

    for i, q in enumerate(full):
        if details[i]["correct"]:
            award_xp(user["id"], xp_for_difficulty(q["difficulte"]))

    termine = len(joueurs) >= 2
    return {
        "score": score, "total": len(full), "details": details,
        "termine": termine, "resultats": joueurs if termine else None,
    }


@router.get("")
def mes_duels(user=Depends(get_current_user)):
    """Mes duels : ceux que j'ai créés et ceux auxquels j'ai participé."""
    _require_enabled()
    conn = get_connection()
    rows = conn.execute(
        "SELECT DISTINCT d.code, d.host_pseudo, d.created_at FROM duels d "
        "LEFT JOIN duel_players p ON p.code = d.code "
        "WHERE d.host_pseudo = ? OR p.pseudo = ? "
        "ORDER BY d.created_at DESC LIMIT 20",
        (user["pseudo"], user["pseudo"]),
    ).fetchall()
    out = []
    for r in rows:
        joueurs = [dict(j) for j in _joueurs(conn, r["code"])]
        moi = next((j for j in joueurs if j["pseudo"] == user["pseudo"]), None)
        adversaire = next((j for j in joueurs if j["pseudo"] != user["pseudo"]), None)
        out.append({
            "code": r["code"], "host": r["host_pseudo"],
            "joue": moi is not None,
            "mon_score": moi["score"] if moi else None,
            "adversaire": adversaire["pseudo"] if adversaire else None,
            "score_adversaire": adversaire["score"] if adversaire and moi else None,
            "termine": len(joueurs) >= 2,
        })
    conn.close()
    return {"duels": out}
