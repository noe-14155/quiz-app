from fastapi import APIRouter, Depends, HTTPException

from app.auth.router import get_current_user
from app.core.db import get_connection
from app.profile import stats

router = APIRouter(prefix="/api/profile", tags=["profile"])


def _build_profile(user: dict):
    return {
        "pseudo": user["pseudo"],
        "xp_total": user["xp_total"],
        "level": stats.compute_level(user["xp_total"]),
        "rank_tier": user["rank_tier"],
        "rank_points": user["rank_points"],
        "stats_by_theme": stats.compute_theme_stats(user["id"]),
    }


@router.get("/me")
def my_profile(user=Depends(get_current_user)):
    return _build_profile(user)


@router.get("/{pseudo}")
def public_profile(pseudo: str):
    """Profil public, consultable depuis le classement en cliquant sur un joueur."""
    conn = get_connection()
    row = conn.execute("SELECT * FROM users WHERE pseudo = ?", (pseudo,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Joueur introuvable")
    return _build_profile(dict(row))
