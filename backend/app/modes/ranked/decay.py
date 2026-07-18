"""Perte quotidienne du mode classé (à partir de Diamant III).

Appelée à la lecture du profil : on calcule combien de jours entiers se sont
écoulés depuis le dernier calcul, et on retire 50 points par jour (plancher au
début de Diamant III). Modèle "rattrapage" : pas besoin de tâche planifiée, la
perte s'applique quand le joueur (ou quelqu'un) consulte son profil.
"""
from datetime import date

from app.core.db import get_connection
from app.modes.ranked import rank_config


def apply_daily_decay(user_id: int, rank_points: int, last_decay_date: str):
    """Retourne le rank_points à jour après application de la perte quotidienne.
    Met à jour la base si nécessaire (points + date du jour)."""
    today = date.today().isoformat()

    # En dessous de Diamant III : rien à faire, mais on garde la date à jour
    # pour ne pas accumuler un "retard" qui frapperait d'un coup en arrivant à Diamant.
    if rank_points < rank_config.DIAMANT_FLOOR_POINTS:
        if last_decay_date != today:
            conn = get_connection()
            conn.execute("UPDATE users SET last_decay_date = ? WHERE id = ?", (today, user_id))
            conn.commit()
            conn.close()
        return rank_points

    # Première fois qu'on calcule pour ce joueur : on initialise la date, sans perte.
    if not last_decay_date:
        conn = get_connection()
        conn.execute("UPDATE users SET last_decay_date = ? WHERE id = ?", (today, user_id))
        conn.commit()
        conn.close()
        return rank_points

    days = (date.fromisoformat(today) - date.fromisoformat(last_decay_date)).days
    if days <= 0:
        return rank_points

    new_points = rank_config.daily_decay(rank_points, days)
    if new_points != rank_points or last_decay_date != today:
        new_tier = rank_config.tier_from_points(new_points)
        conn = get_connection()
        conn.execute(
            "UPDATE users SET rank_points = ?, rank_tier = ?, last_decay_date = ? WHERE id = ?",
            (new_points, new_tier, today, user_id),
        )
        conn.commit()
        conn.close()
    return new_points
