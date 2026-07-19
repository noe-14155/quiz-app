import json
from datetime import datetime, timezone

from app.core.config import ADMIN_BOOTSTRAP_SECRET
from app.core.db import get_connection
from app.profile.activity import EVENTS as EVENT_LABELS

DEFAULT_SETTINGS = {
    # Barème du mode classé : bornes de la courbe (le code interpole entre le
    # bas et le haut du classement). Voir rank_config.py.
    "ranked_gain_low": "25",       # gain d'une bonne réponse au rang le plus bas (Fer)
    "ranked_gain_high": "6",       # gain au rang le plus haut (Légende I) ; plancher en Unreal
    "ranked_loss_low": "6",        # malus d'une mauvaise réponse au plus bas
    "ranked_loss_high": "22",      # malus au plus haut (Légende I) ; augmente encore en Unreal
    "ranked_loss_pass": "3",       # coût d'un « passer » (uniquement sous Diamant, où c'est permis)
    "ranked_points_per_tier": "200",  # points par palier (III→II→I)
    "ranked_daily_decay": "50",    # perte quotidienne à partir de Diamant III
    "ranked_time_per_question": "15",
    "multi_time_per_question": "15",
    "multi_reveal_seconds": "5",
    "mode_chill_enabled": "1",
    "mode_ranked_enabled": "1",
    "mode_local_enabled": "1",
    "mode_multi_enabled": "1",
    "mode_daily_enabled": "1",
}

MODE_KEYS = ["mode_chill_enabled", "mode_ranked_enabled", "mode_local_enabled", "mode_multi_enabled", "mode_daily_enabled"]


# Cache mémoire des réglages : is_mode_enabled() est appelé sur CHAQUE requête
# de chaque mode, et ouvrait donc une connexion SQLite à chaque fois juste pour
# lire 4 lignes qui changent une fois par mois. Le cache est vidé dès qu'un
# admin modifie un réglage (voir update_settings), donc jamais périmé.
_settings_cache = None


def _invalidate_settings_cache():
    global _settings_cache
    _settings_cache = None


def is_mode_enabled(mode_key: str) -> bool:
    """Utilisée par chaque mode pour vérifier s'il a été désactivé par un admin
    (en plus du frontend qui grise les cartes, pour une vraie protection côté serveur)."""
    settings = get_settings()
    return settings.get(mode_key, "1") == "1"


def get_modes_status():
    settings = get_settings()
    return {key: settings.get(key, "1") == "1" for key in MODE_KEYS}


def bootstrap_admin(pseudo: str, secret: str):
    if secret != ADMIN_BOOTSTRAP_SECRET:
        return "bad_secret"
    conn = get_connection()
    user = conn.execute("SELECT id FROM users WHERE pseudo = ?", (pseudo,)).fetchone()
    if not user:
        conn.close()
        return "user_not_found"
    conn.execute("UPDATE users SET is_admin = 1 WHERE id = ?", (user["id"],))
    conn.commit()
    conn.close()
    return "ok"


def list_users(limit: int = 100, offset: int = 0):
    conn = get_connection()
    rows = conn.execute(
        "SELECT id, pseudo, xp_total, rank_tier, rank_points, is_admin, created_at FROM users "
        "ORDER BY created_at DESC LIMIT ? OFFSET ?",
        (limit, offset),
    ).fetchall()
    total = conn.execute("SELECT COUNT(*) as c FROM users").fetchone()["c"]
    conn.close()
    return {"users": [dict(r) for r in rows], "total": total}


def reset_user(user_id: int):
    conn = get_connection()
    conn.execute("UPDATE users SET xp_total = 0, rank_tier = 0, rank_points = 0 WHERE id = ?", (user_id,))
    conn.execute("DELETE FROM question_results WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()


def delete_user(user_id: int):
    conn = get_connection()
    conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
    conn.execute("DELETE FROM question_results WHERE user_id = ?", (user_id,))
    conn.execute("DELETE FROM parties WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()


def get_settings():
    global _settings_cache
    if _settings_cache is not None:
        return _settings_cache
    conn = get_connection()
    rows = conn.execute("SELECT key, value FROM app_settings").fetchall()
    conn.close()
    saved = {r["key"]: r["value"] for r in rows}
    _settings_cache = {**DEFAULT_SETTINGS, **saved}
    return _settings_cache


def update_settings(patch: dict):
    conn = get_connection()
    for key, value in patch.items():
        if key not in DEFAULT_SETTINGS:
            continue
        conn.execute(
            "INSERT INTO app_settings (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, str(value)),
        )
    conn.commit()
    conn.close()
    _invalidate_settings_cache()
    return get_settings()


def get_stats():
    conn = get_connection()
    nb_users = conn.execute("SELECT COUNT(*) as c FROM users").fetchone()["c"]
    nb_parties = conn.execute("SELECT COUNT(*) as c FROM parties").fetchone()["c"]
    nb_rooms = conn.execute("SELECT COUNT(*) as c FROM multi_rooms").fetchone()["c"]
    conn.close()
    return {"nb_comptes": nb_users, "nb_parties_classees": nb_parties, "nb_parties_multi": nb_rooms}


# ---------------------------------------------------------------------------
# Suivi des connexions et des flux
# ---------------------------------------------------------------------------

def get_activity(days: int = 14, feed_limit: int = 40):
    """Alimente la page de suivi de l'administration.

    Note : les connexions historiques viennent de `sessions` (chaque login y
    crée une ligne, et rien ne les supprime), ce qui donne un historique
    complet même antérieur à l'ajout d'activity_log.
    """
    conn = get_connection()

    # Joueurs uniques ayant JOUÉ par jour (source : activity_log, événements de
    # partie). On compte les pseudos distincts par jour — un joueur qui enchaîne
    # plusieurs parties dans la journée ne compte qu'une fois.
    joueurs_par_jour = conn.execute(
        "SELECT substr(created_at, 1, 10) AS jour, COUNT(DISTINCT pseudo) AS n FROM activity_log "
        "WHERE (event LIKE '%\\_start' ESCAPE '\\' OR event = 'multi_create') "
        "AND pseudo IS NOT NULL AND created_at >= date('now', ?) GROUP BY jour ORDER BY jour",
        (f"-{days} days",),
    ).fetchall()

    # Parties jouées par jour (source : activity_log, tous événements de partie).
    parties_par_jour = conn.execute(
        "SELECT substr(created_at, 1, 10) AS jour, COUNT(*) AS n FROM activity_log "
        "WHERE (event LIKE '%\\_start' ESCAPE '\\' OR event = 'multi_create') "
        "AND created_at >= date('now', ?) GROUP BY jour ORDER BY jour",
        (f"-{days} days",),
    ).fetchall()

    # Répartition par mode (source : activity_log)
    par_mode = conn.execute(
        "SELECT event, COUNT(*) AS n FROM activity_log "
        "WHERE event LIKE '%_start' OR event = 'multi_create' GROUP BY event ORDER BY n DESC"
    ).fetchall()

    # Derniers événements
    feed = conn.execute(
        "SELECT event, pseudo, created_at FROM activity_log ORDER BY id DESC LIMIT ?",
        (feed_limit,),
    ).fetchall()

    # Joueurs : dernière connexion + nombre de connexions
    joueurs = conn.execute(
        "SELECT u.pseudo, "
        "  (SELECT COUNT(*) FROM activity_log a WHERE a.pseudo = u.pseudo AND (a.event LIKE '%\\_start' ESCAPE '\\' OR a.event = 'multi_create')) AS nb_parties, "
        "  (SELECT MAX(a.created_at) FROM activity_log a WHERE a.pseudo = u.pseudo AND (a.event LIKE '%\\_start' ESCAPE '\\' OR a.event = 'multi_create')) AS derniere_partie "
        "FROM users u ORDER BY derniere_partie DESC NULLS LAST"
    ).fetchall()

    totaux = {
        "connexions_total": conn.execute("SELECT COUNT(*) c FROM sessions").fetchone()["c"],
        "connexions_7j": conn.execute(
            "SELECT COUNT(*) c FROM sessions WHERE created_at >= date('now', '-7 days')"
        ).fetchone()["c"],
        "joueurs_actifs_7j": conn.execute(
            "SELECT COUNT(DISTINCT user_id) c FROM sessions WHERE created_at >= date('now', '-7 days')"
        ).fetchone()["c"],
        "evenements_total": conn.execute("SELECT COUNT(*) c FROM activity_log").fetchone()["c"],
        "parties_total": conn.execute(
            "SELECT COUNT(*) c FROM activity_log WHERE event LIKE '%\\_start' ESCAPE '\\' OR event = 'multi_create'"
        ).fetchone()["c"],
    }
    conn.close()

    return {
        "totaux": totaux,
        "joueurs_par_jour": [dict(r) for r in joueurs_par_jour],
        "parties_par_jour": [dict(r) for r in parties_par_jour],
        "par_mode": [{"event": r["event"], "label": EVENT_LABELS.get(r["event"], r["event"]), "n": r["n"]} for r in par_mode],
        "feed": [{"event": r["event"], "label": EVENT_LABELS.get(r["event"], r["event"]), "pseudo": r["pseudo"], "created_at": r["created_at"]} for r in feed],
        "joueurs": [dict(r) for r in joueurs],
    }
