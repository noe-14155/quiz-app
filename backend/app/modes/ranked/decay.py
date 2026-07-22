"""Perte quotidienne du mode classé (à partir de Génie III).

Appelée à la lecture du profil : calcule les jours écoulés depuis le dernier
calcul et retire N points par jour (réglable), avec plancher au début de
Génie III. Modèle "rattrapage" : pas de tâche planifiée.
"""
from datetime import date

from app.core.db import get_connection
from app.modes.ranked import rank_config
from app.modes.admin.service import get_settings


def apply_daily_decay(user_id: int, rank_points: int, last_decay_date: str):
    """Retourne le rank_points à jour après application de la perte quotidienne.
    Met à jour la base si nécessaire (points + date du jour)."""
    cfg = get_settings()
    today = date.today().isoformat()
    floor = rank_config.diamant_floor_points(cfg)

    # En dessous de Génie III : rien à faire, mais on garde la date à jour pour
    # ne pas accumuler un retard qui frapperait d'un coup en arrivant à Génie.
    if rank_points < floor:
        if last_decay_date != today:
            conn = get_connection()
            conn.execute("UPDATE users SET last_decay_date = ? WHERE id = ?", (today, user_id))
            conn.commit()
            conn.close()
        return rank_points

    # Première fois pour ce joueur : on initialise la date, sans perte.
    if not last_decay_date:
        conn = get_connection()
        conn.execute("UPDATE users SET last_decay_date = ? WHERE id = ?", (today, user_id))
        conn.commit()
        conn.close()
        return rank_points

    days = (date.fromisoformat(today) - date.fromisoformat(last_decay_date)).days
    if days <= 0:
        return rank_points

    new_points = rank_config.daily_decay(rank_points, days, cfg)
    if new_points != rank_points or last_decay_date != today:
        new_tier = rank_config.tier_from_points(new_points, cfg)
        conn = get_connection()
        conn.execute(
            "UPDATE users SET rank_points = ?, rank_tier = ?, last_decay_date = ? WHERE id = ?",
            (new_points, new_tier, today, user_id),
        )
        conn.commit()
        conn.close()
    return new_points
