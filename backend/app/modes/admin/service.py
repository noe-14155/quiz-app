from app.core.config import ADMIN_BOOTSTRAP_SECRET
from app.core.db import get_connection
from app.profile.activity import EVENTS as EVENT_LABELS

DEFAULT_SETTINGS = {
    # Barème du mode classé : bornes de la courbe (le code interpole entre le
    # bas et le haut du classement). Voir rank_config.py.
    "ranked_amplitude": "60",      # échelle générale des variations de points
    "ranked_daily_decay": "50",    # perte quotidienne à partir de Champion III
    "ranked_time_per_question": "15",
    "mode_chill_enabled": "1",
    "mode_ranked_enabled": "1",
    "mode_local_enabled": "1",
    "mode_daily_enabled": "1",
    "mode_arcade_enabled": "1",
    "mode_multi_enabled": "1",
    "mode_enigme_enabled": "1",
}

MODE_KEYS = ["mode_chill_enabled", "mode_ranked_enabled", "mode_local_enabled",
             "mode_daily_enabled", "mode_arcade_enabled", "mode_multi_enabled",
             "mode_enigme_enabled"]


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
    # Le rang est RECALCULÉ depuis les points, jamais lu depuis la colonne
    # rank_tier : celle-ci peut être périmée si les seuils de rang ont changé
    # (elle n'est réécrite qu'à la partie suivante du joueur).
    from app.modes.ranked import rank_config
    users = []
    for r in rows:
        d = dict(r)
        d["rank_tier"] = rank_config.tier_from_points(d["rank_points"])
        info = rank_config.tier_info(d["rank_points"])
        d["rank_name"] = f"{info['rank']} {info['palier']}"
        users.append(d)
    return {"users": users, "total": total}


# Tables rattachées à un compte. Deux familles, parce que les modes
# quotidiens (défi, énigme, duel, arcade) identifient le joueur par son PSEUDO
# et non par son identifiant : oublier la seconde famille laissait des traces
# derrière un compte supprimé, et un nouveau venu qui reprenait le pseudo libéré
# héritait de la série, des records et des duels de son prédécesseur.
_TABLES_PAR_USER_ID = [
    "question_results", "parties", "achievements", "rank_history",
    "season_history", "arcade_records", "arcade_daily",
]
_TABLES_PAR_PSEUDO = [
    "daily_attempts", "enigme_attempts", "multi_joueurs", "multi_reponses",
]


def _purger(conn, user_id: int, pseudo: str, garder_le_compte: bool):
    for table in _TABLES_PAR_USER_ID:
        conn.execute(f"DELETE FROM {table} WHERE user_id = ?", (user_id,))
    if pseudo:
        for table in _TABLES_PAR_PSEUDO:
            conn.execute(f"DELETE FROM {table} WHERE pseudo = ?", (pseudo,))
        conn.execute("DELETE FROM multi_parties WHERE hote = ?", (pseudo,))
    if not garder_le_compte:
        # Le journal d'activité n'est effacé qu'à la SUPPRESSION : une remise à
        # zéro ne doit pas amputer les statistiques de fréquentation, qui sont
        # une donnée du site et non une donnée du joueur.
        conn.execute("DELETE FROM activity_log WHERE user_id = ? OR pseudo = ?", (user_id, pseudo))
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))


def _pseudo_de(conn, user_id: int):
    row = conn.execute("SELECT pseudo FROM users WHERE id = ?", (user_id,)).fetchone()
    return row["pseudo"] if row else None


def reset_user(user_id: int):
    """Remet le compte à zéro sans le supprimer : progression, historique et
    succès repartent de rien, le pseudo et le mot de passe sont conservés."""
    conn = get_connection()
    pseudo = _pseudo_de(conn, user_id)
    conn.execute(
        "UPDATE users SET xp_total = 0, rank_tier = 0, rank_points = 0, "
        "peak_points = 0, best_tier_ever = 0, last_decay_date = NULL WHERE id = ?",
        (user_id,),
    )
    _purger(conn, user_id, pseudo, garder_le_compte=True)
    conn.commit()
    conn.close()


def delete_user(user_id: int):
    """Supprime le compte ET tout ce qui s'y rattache."""
    conn = get_connection()
    pseudo = _pseudo_de(conn, user_id)
    _purger(conn, user_id, pseudo, garder_le_compte=False)
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
        # Les réglages de mode (mode_*_enabled) valent "0"/"1". Tous les autres
        # sont numériques : on rejette le texte non numérique et les négatifs
        # pour ne pas corrompre le calcul des rangs / durées.
        if not key.startswith("mode_"):
            try:
                n = int(str(value))
            except (TypeError, ValueError):
                continue  # valeur invalide ignorée, l'ancienne reste
            if n < 0:
                continue
            value = n
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
    conn.close()
    return {"nb_comptes": nb_users, "nb_parties_classees": nb_parties}


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
        "WHERE (event LIKE '%\\_start' ESCAPE '\\') "
        "AND pseudo IS NOT NULL AND created_at >= date('now', ?) GROUP BY jour ORDER BY jour",
        (f"-{days} days",),
    ).fetchall()

    # Parties jouées par jour (source : activity_log, tous événements de partie).
    parties_par_jour = conn.execute(
        "SELECT substr(created_at, 1, 10) AS jour, COUNT(*) AS n FROM activity_log "
        "WHERE (event LIKE '%\\_start' ESCAPE '\\') "
        "AND created_at >= date('now', ?) GROUP BY jour ORDER BY jour",
        (f"-{days} days",),
    ).fetchall()

    # Répartition par mode (source : activity_log)
    par_mode = conn.execute(
        "SELECT event, COUNT(*) AS n FROM activity_log "
        "WHERE event LIKE '%_start' GROUP BY event ORDER BY n DESC"
    ).fetchall()

    # Derniers événements
    feed = conn.execute(
        "SELECT event, pseudo, created_at FROM activity_log ORDER BY id DESC LIMIT ?",
        (feed_limit,),
    ).fetchall()

    # Joueurs : dernière connexion + nombre de connexions
    joueurs = conn.execute(
        "SELECT u.pseudo, "
        "  (SELECT COUNT(*) FROM activity_log a WHERE a.pseudo = u.pseudo AND (a.event LIKE '%\\_start' ESCAPE '\\')) AS nb_parties, "
        "  (SELECT MAX(a.created_at) FROM activity_log a WHERE a.pseudo = u.pseudo AND (a.event LIKE '%\\_start' ESCAPE '\\')) AS derniere_partie "
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
            "SELECT COUNT(*) c FROM activity_log WHERE event LIKE '%\\_start' ESCAPE '\\'"
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


# ---------------------------------------------------------------------------
# Signalements de questions
# ---------------------------------------------------------------------------

def list_reports(status: str = "ouvert", limit: int = 100):
    """Signalements, enrichis du texte de la question pour pouvoir juger sans
    ouvrir le CSV."""
    conn = get_connection()
    rows = conn.execute(
        "SELECT r.id, r.question_id, r.pseudo, r.reason, r.comment, r.status, r.created_at, "
        "       q.question, q.theme, q.difficulte, q.explication, "
        "       q.reponse_1, q.reponse_2, q.reponse_3, q.reponse_4, q.bonne_reponse "
        "FROM question_reports r LEFT JOIN questions q ON q.id = r.question_id "
        "WHERE (? = 'tous' OR r.status = ?) ORDER BY r.id DESC LIMIT ?",
        (status, status, limit),
    ).fetchall()
    ouverts = conn.execute("SELECT COUNT(*) c FROM question_reports WHERE status = 'ouvert'").fetchone()["c"]
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        if d.get("bonne_reponse"):
            d["bonne"] = d.get(f"reponse_{d['bonne_reponse']}")
        for k in ("reponse_1", "reponse_2", "reponse_3", "reponse_4"):
            d.pop(k, None)
        out.append(d)
    return {"reports": out, "ouverts": ouverts}


def resolve_report(report_id: int):
    """Marque un signalement comme traité."""
    conn = get_connection()
    conn.execute("UPDATE question_reports SET status = 'traite' WHERE id = ?", (report_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


def set_user_password(user_id: int, password: str):
    """Réinitialise le mot de passe d'un joueur depuis l'administration.
    Utile quand quelqu'un est bloqué (il n'y a pas d'envoi d'e-mail)."""
    from app.auth import service as auth_service
    conn = get_connection()
    conn.execute(
        "UPDATE users SET password_hash = ? WHERE id = ?",
        (auth_service.hash_password(password), user_id),
    )
    # Les sessions ouvertes sont invalidées : le joueur devra se reconnecter.
    conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()
    return {"ok": True}
