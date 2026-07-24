import json
import random
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.auth.router import get_current_user, get_current_user_optional
from app.core.db import get_connection
from app.questions import service as questions_service
from app.modes.ranked import rank_config
from app.modes.ranked import season
from app.profile.xp import xp_for_difficulty, award_xp
from app.profile.activity import log_event
from app.profile import achievements
from app.modes.admin.service import is_mode_enabled, get_settings

router = APIRouter(prefix="/api/ranked", tags=["ranked"])


def _pick_weighted_questions(tier: int, nb: int, cfg, user_id=None):
    weights = rank_config.weights_for_tier(tier, cfg)
    # shuffle=False : on ne mélange que les 10 questions retenues (plus bas),
    # pas les 1114 candidates dont 1104 seront jetées.
    # On tire la difficulté visée pour chacune des `nb` questions, puis on va
    # chercher UNE question de ce niveau en base. Autrefois la banque entière
    # était chargée en mémoire à chaque partie : tenable avec 1 500 questions,
    # beaucoup moins avec 3 000, et surtout impossible d'exploiter l'historique
    # du joueur. Ici la rotation est faite par le SQL (voir fetch_questions).
    picked, used_ids = [], []
    for _ in range(nb):
        total = sum(weights) or 1
        target, acc, target_diff = random.uniform(0, total), 0, 1
        for i, w in enumerate(weights):
            acc += w
            if target < acc:
                target_diff = i + 1
                break
        lot = questions_service.fetch_questions(
            difficulte=target_diff, exclude_ids=used_ids, limit=1,
            hide_answer=False, allow_repeat=False, shuffle=False, user_id=user_id,
        )
        if not lot:
            # Plus rien à ce niveau : on prend n'importe quelle question inédite.
            lot = questions_service.fetch_questions(
                exclude_ids=used_ids, limit=1,
                hide_answer=False, allow_repeat=False, shuffle=False, user_id=user_id,
            )
        if not lot:
            break
        q = lot[0]
        used_ids.append(q["id"])
        picked.append(questions_service.shuffle_choices(q))
    return picked


@router.get("/rules")
def get_rules(user=Depends(get_current_user)):
    """Les règles réellement appliquées, lues des réglages d'administration.
    Le frontend les affiche au lieu de valeurs codées en dur, qui se
    désynchronisaient dès qu'un admin changeait le barème."""
    settings = get_settings()
    cfg = settings
    tier = rank_config.tier_from_points(user["rank_points"], cfg)
    return {
        "gain_if_correct": rank_config.gain_for_tier(tier, cfg),
        "loss_if_wrong": rank_config.loss_for_tier(tier, cfg),
        "loss_if_pass": rank_config.loss_for_pass(tier, cfg),
        "can_pass": rank_config.can_pass(user["rank_points"], cfg),
        "time_per_question": int(settings["ranked_time_per_question"]),
        "nb_questions": rank_config.NB_QUESTIONS_PER_PARTY,
        # Tableau complet du barème par rang, pour l'affichage informatif au joueur.
        "scale": rank_config.full_scale(cfg),
        "bareme": rank_config.bareme_joueur(user["rank_points"], cfg),
        "current_rank": rank_config.tier_info(user["rank_points"], cfg)["rank"],
        "daily_decay": int(cfg.get("ranked_daily_decay", rank_config.DEFAULTS["daily_decay"])),
        "decay_floor": rank_config.diamant_floor_points(cfg),
        "decay_rank": rank_config.RANKS[rank_config.LOCK_RANK_INDEX],
    }


@router.post("/start")
def start_party(user=Depends(get_current_user)):
    # Si le mois a changé depuis la dernière partie, la saison bascule ici : le
    # serveur peut tourner des semaines sans redémarrer.
    season.verifier_et_reinitialiser()
    if not is_mode_enabled("mode_ranked_enabled"):
        raise HTTPException(status_code=403, detail="Le mode classé est temporairement désactivé")
    settings = get_settings()
    cfg = settings
    tier = rank_config.tier_from_points(user["rank_points"], cfg)
    picked = _pick_weighted_questions(tier, rank_config.NB_QUESTIONS_PER_PARTY, cfg, user_id=user["id"])

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO parties (user_id, mode, score, questions_data, created_at) VALUES (?,?,?,?,?)",
        (user["id"], "ranked", 0, json.dumps(picked), datetime.now(timezone.utc).isoformat()),
    )
    party_id = cur.lastrowid
    conn.commit()
    conn.close()

    log_event("ranked_start", user_id=user["id"], pseudo=user["pseudo"])

    public_questions = [{k: v for k, v in q.items() if k not in ("bonne_reponse", "explication")} for q in picked]
    return {
        "party_id": party_id,
        "questions": public_questions,
        "gain_if_correct": rank_config.gain_for_tier(tier, cfg),
        "loss_if_wrong": rank_config.loss_for_tier(tier, cfg),
        "loss_if_pass": rank_config.loss_for_pass(tier, cfg),
        "can_pass": rank_config.can_pass(user["rank_points"], cfg),
        "time_per_question": int(settings["ranked_time_per_question"]),
    }


class AnswerPayload(BaseModel):
    party_id: int
    question_id: int
    choice: Optional[int] = None  # None = le joueur a passé la question


@router.post("/answer")
def submit_answer(payload: AnswerPayload, user=Depends(get_current_user)):
    conn = get_connection()
    party = conn.execute(
        "SELECT * FROM parties WHERE id = ? AND user_id = ?", (payload.party_id, user["id"])
    ).fetchone()
    if not party:
        conn.close()
        raise HTTPException(status_code=404, detail="Partie introuvable")

    questions_data = json.loads(party["questions_data"])
    question = next((q for q in questions_data if q["id"] == payload.question_id), None)
    if not question:
        conn.close()
        raise HTTPException(status_code=404, detail="Question introuvable dans cette partie")

    settings = get_settings()
    cfg = settings
    tier = rank_config.tier_from_points(user["rank_points"], cfg)
    if payload.choice is None:
        # Passer est interdit à partir de Champion : on refuse la requête plutôt
        # que de l'accepter silencieusement (le frontend masque déjà le bouton).
        if not rank_config.can_pass(user["rank_points"], cfg):
            conn.close()
            raise HTTPException(status_code=403, detail="Passer une question n'est plus autorisé à partir de Champion")
        delta, result, correct = -rank_config.loss_for_pass(tier, cfg), "passee", False
    else:
        correct = payload.choice == question["bonne_reponse"] - 1
        # Barème adaptatif : le gain dépend de l'écart entre le niveau du joueur
        # et celui de la question (difficulté déclarée, corrigée par le taux de
        # réussite réel). Voir rank_config.delta_for.
        st = conn.execute(
            "SELECT vues, reussies FROM question_stats WHERE question_id = ?", (question["id"],)
        ).fetchone()
        delta = rank_config.delta_for(
            user["rank_points"], question["difficulte"], correct, cfg,
            vues=st["vues"] if st else 0, reussies=st["reussies"] if st else 0,
        )
        # Alimente la calibration pour les prochains joueurs.
        conn.execute(
            "INSERT INTO question_stats (question_id, vues, reussies) VALUES (?,1,?) "
            "ON CONFLICT(question_id) DO UPDATE SET vues = vues + 1, reussies = reussies + ?",
            (question["id"], 1 if correct else 0, 1 if correct else 0),
        )
        result = "bonne" if correct else "mauvaise"

    new_rank_points = rank_config.apply_delta(user["rank_points"], delta)
    # Le score ne descend jamais sous zéro : la perte réelle peut donc être plus
    # faible que le malus théorique. C'est cette variation-là qu'on renvoie,
    # sinon le bilan de fin de partie ne correspondrait pas au score affiché.
    delta = new_rank_points - user["rank_points"]
    new_tier = rank_config.tier_from_points(new_rank_points, cfg)
    now = datetime.now(timezone.utc).isoformat()

    # Sommet de la saison : sert au palmarès une fois le mois terminé.
    conn.execute(
        "UPDATE users SET rank_tier = ?, rank_points = ?, peak_points = MAX(peak_points, ?) WHERE id = ?",
        (new_tier, new_rank_points, new_rank_points, user["id"]),
    )
    conn.execute(
        "INSERT INTO question_results (user_id, question_id, result, updated_at) VALUES (?,?,?,?) "
        "ON CONFLICT(user_id, question_id) DO UPDATE SET result = excluded.result, updated_at = excluded.updated_at",
        (user["id"], payload.question_id, result, now),
    )
    conn.commit()
    conn.close()

    if correct:
        award_xp(user["id"], xp_for_difficulty(question["difficulte"]))

    return {
        "correct": correct,
        "delta_points": delta,
        "question_difficulte": question["difficulte"],
        "bonne_reponse": question["bonne_reponse"],
        "explication": question["explication"],
        "new_tier": new_tier,
        "new_rank_points": new_rank_points,
        "new_progress": rank_config.progress_in_tier(new_rank_points, cfg),
    }


class FinishPayload(BaseModel):
    party_id: int
    correct: int
    total: int


@router.post("/finish")
def finish(payload: FinishPayload, user=Depends(get_current_user)):
    """Fin d'une partie classée : enregistre le score et évalue les succès.
    Séparé de /answer pour n'évaluer qu'une fois par partie plutôt qu'à chaque
    question."""
    conn = get_connection()
    conn.execute(
        "UPDATE parties SET score = ? WHERE id = ? AND user_id = ?",
        (payload.correct, payload.party_id, user["id"]),
    )
    conn.commit()
    conn.close()
    nouveaux = achievements.evaluer(
        user["id"], user["pseudo"],
        contexte={"ranked_sans_faute": payload.total > 0 and payload.correct == payload.total},
    )
    return {"achievements": nouveaux}


@router.get("/ladder")
def get_ladder(user=Depends(get_current_user)):
    """L'échelle des rangs, avec pour chacun son état vis-à-vis du joueur
    (dépassé / actuel / pas encore atteint). Alimente l'écran « L'échelle »."""
    cfg = get_settings()
    pts = user["rank_points"]
    # Position dans le classement, pour le « top X % » de la carte.
    conn = get_connection()
    total = conn.execute("SELECT COUNT(*) c FROM users").fetchone()["c"] or 1
    better = conn.execute("SELECT COUNT(*) c FROM users WHERE rank_points > ?", (pts,)).fetchone()["c"]
    conn.close()
    return {
        "ladder": rank_config.ladder(pts, cfg),
        "rank_points": pts,
        "current": rank_config.tier_info(pts, cfg),
        "next": rank_config.next_rank(pts, cfg),
        "rank_progress": rank_config.rank_progress(pts, cfg),
        "top_percent": max(1, round((better + 1) / total * 100)),
    }


@router.get("/leaderboard")
def leaderboard(limit: int = 10, user=Depends(get_current_user_optional)):
    """Le tri se fait directement sur le cumul de points — un seul critère,
    sans ambiguïté de palier entre deux joueurs proches."""
    cfg = get_settings()
    conn = get_connection()
    rows = conn.execute(
        "SELECT pseudo, rank_points, avatar_face, avatar_color FROM users ORDER BY rank_points DESC LIMIT ?",
        (limit,),
    ).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["rank_tier"] = rank_config.tier_from_points(d["rank_points"], cfg)
        result.append(d)

    # Position du joueur, même s'il est hors du haut du tableau : sans ça, un
    # joueur en milieu de classement ne voit jamais où il se situe.
    moi = None
    if user:
        conn2 = get_connection()
        devant = conn2.execute(
            "SELECT COUNT(*) c FROM users WHERE rank_points > ?", (user["rank_points"],)
        ).fetchone()["c"]
        total = conn2.execute("SELECT COUNT(*) c FROM users").fetchone()["c"]
        conn2.close()
        moi = {
            "pseudo": user["pseudo"],
            "avatar_face": user["avatar_face"],
            "avatar_color": user["avatar_color"],
            "rank_points": user["rank_points"],
            "rank_tier": rank_config.tier_from_points(user["rank_points"], cfg),
            "position": devant + 1,
            "total": total,
            "dans_le_haut": (devant + 1) <= limit,
        }
    return {"leaderboard": result, "moi": moi, "saison": season.info()}
