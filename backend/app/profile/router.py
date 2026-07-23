from fastapi import APIRouter, Depends, HTTPException

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
    }


@router.get("/me")
def my_profile(user=Depends(get_current_user)):
    # Applique la perte quotidienne du mode classé (à partir de Génie III)
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
