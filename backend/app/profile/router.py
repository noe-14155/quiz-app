from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth.router import get_current_user
from app.core.db import get_connection
from app.modes.ranked import rank_config
from app.modes.admin.service import get_settings
from app.modes.ranked.decay import apply_daily_decay
from app.profile import stats
from app.profile import achievements

router = APIRouter(prefix="/api/profile", tags=["profile"])


def _build_profile(user: dict):
    cfg = get_settings()
    tier_info = rank_config.tier_info(user["rank_points"], cfg)
    return {
        "pseudo": user["pseudo"],
        "xp_total": user["xp_total"],
        "level": stats.compute_level(user["xp_total"]),
        "rank_points": user["rank_points"],  # cumul total, ex: 550 — sert aussi à comparer deux joueurs
        "rank_tier": tier_info["tier"],
        "rank_name": tier_info["rank"],
        "rank_palier": tier_info["palier"],
        "rank_progress": rank_config.progress_in_tier(user["rank_points"], cfg),
        "stats_by_theme": stats.compute_theme_stats(user["id"]),
        # L'avatar suit le joueur partout : profil, classement, podium.
        "avatar_face": user["avatar_face"] if "avatar_face" in user.keys() else 0,
        "avatar_color": user["avatar_color"] if "avatar_color" in user.keys() else "#7C4DFF",
    }


NB_VISAGES = 8
COULEURS_AVATAR = [
    "#7C4DFF", "#FF4D9D", "#FF8A3D", "#12B981",
    "#38BDF8", "#F43F5E", "#FFC94D", "#8A93A5",
]


class AvatarPayload(BaseModel):
    face: int
    color: str


@router.patch("/me/avatar")
def set_avatar(payload: AvatarPayload, user=Depends(get_current_user)):
    """Choix de l'avatar : une expression parmi NB_VISAGES, une couleur parmi la
    palette. On valide côté serveur pour qu'aucune valeur fantaisiste ne se
    retrouve en base."""
    if not (0 <= payload.face < NB_VISAGES):
        raise HTTPException(status_code=422, detail="Visage inconnu")
    if payload.color not in COULEURS_AVATAR:
        raise HTTPException(status_code=422, detail="Couleur inconnue")
    conn = get_connection()
    conn.execute(
        "UPDATE users SET avatar_face = ?, avatar_color = ? WHERE id = ?",
        (payload.face, payload.color, user["id"]),
    )
    conn.commit()
    conn.close()
    return {"avatar_face": payload.face, "avatar_color": payload.color}


@router.get("/avatars")
def avatars():
    """Choix disponibles, pour que le client n'ait rien à deviner."""
    return {"faces": NB_VISAGES, "colors": COULEURS_AVATAR}


@router.get("/me")
def my_profile(user=Depends(get_current_user)):
    # Applique la perte quotidienne du mode classé (à partir de Champion III)
    # avant d'afficher le profil. Modèle rattrapage : pas de tâche planifiée.
    updated_points = apply_daily_decay(user["id"], user["rank_points"], user["last_decay_date"] if "last_decay_date" in user.keys() else None)
    user = dict(user)
    user["rank_points"] = updated_points
    # Relevé quotidien, pour pouvoir tracer la progression dans le temps.
    stats.releve_du_jour(user["id"], updated_points)
    # Les succès sont aussi réévalués ICI, et pas seulement en fin de partie :
    # l'XP et les séries progressent via des modes qui ne déclenchaient aucune
    # évaluation (survie, duel, énigme), et un succès atteint restait alors
    # invisible jusqu'à la partie classée suivante.
    achievements.evaluer(user["id"], user["pseudo"])
    return {
        **_build_profile(user),
        "is_admin": bool(user["is_admin"]),
        "achievements": achievements.lister(user["id"]),
    }


@router.get("/{pseudo}/public")
def public_profile(pseudo: str):
    """Profil complet d'un joueur, consultable depuis le classement :
    progression, palmarès des saisons passées et succès obtenus."""
    conn = get_connection()
    u = conn.execute(
        "SELECT id, pseudo, xp_total, rank_tier, rank_points, peak_points, best_tier_ever, "
        "       created_at, avatar_face, avatar_color FROM users WHERE pseudo = ?",
        (pseudo,),
    ).fetchone()
    conn.close()
    if not u:
        raise HTTPException(status_code=404, detail="Joueur introuvable")

    from app.modes.ranked import season, rank_config
    tous = achievements.lister(u["id"])
    # Meilleur rang jamais atteint : on croise l'archive des saisons passées
    # avec le sommet de la saison EN COURS, sinon un joueur qui a culminé ce
    # mois-ci puis redescendu paraîtrait n'avoir jamais brillé.
    sommet_saison = rank_config.tier_from_points(max(u["peak_points"] or 0, u["rank_points"] or 0))
    return {
        **_build_profile(u),
        # Le meilleur rang jamais atteint : au minimum le rang actuel, sinon un
        # joueur qui vient de basculer de saison semblerait n'avoir rien fait.
        "best_tier_ever": max(u["best_tier_ever"] or 0, sommet_saison),
        "palmares": season.palmares(u["id"]),
        "achievements": [a for a in tous if a["unlocked"]],
        "nb_achievements": len(tous),
        "membre_depuis": u["created_at"],
    }


@router.get("/me/stats")
def my_stats(user=Depends(get_current_user)):
    """Statistiques détaillées : progression, régularité, thèmes forts/faibles."""
    tf = stats.points_forts_faibles(user["id"])
    return {
        "historique_points": stats.historique_points(user["id"]),
        "parties_par_jour": stats.parties_par_jour(user["id"]),
        **tf,
    }


@router.get("/{pseudo}")
def public_profile(pseudo: str):
    """Profil public, consultable depuis le classement en cliquant sur un joueur."""
    conn = get_connection()
    row = conn.execute("SELECT * FROM users WHERE pseudo = ?", (pseudo,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Joueur introuvable")
    return _build_profile(dict(row))
