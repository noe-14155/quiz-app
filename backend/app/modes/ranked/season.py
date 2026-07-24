"""Saisons mensuelles du mode classé.

Le classement repart de zéro au début de chaque mois. Sans cela il se fige :
les premiers inscrits creusent un écart que personne ne rattrape, et l'intérêt
retombe. Une saison d'un mois redonne sa chance à tout le monde, régulièrement.

Rien n'est perdu pour autant : avant la remise à zéro, le meilleur score et le
meilleur rang atteints pendant la saison sont archivés (`season_history`), et
le meilleur rang de tous les temps est conservé sur le compte. C'est cette
mémoire qui donne sa valeur au palmarès affiché sur le profil.
"""
from datetime import date, datetime, timezone

from app.core import dates
from app.core.db import get_connection

CLE_SAISON = "ranked_season"


def saison_courante(aujourdhui: date = None) -> str:
    d = aujourdhui or dates.aujourdhui()
    return f"{d.year:04d}-{d.month:02d}"


def fin_de_saison(aujourdhui: date = None) -> date:
    """Premier jour du mois suivant : l'instant de la remise à zéro."""
    d = aujourdhui or dates.aujourdhui()
    return date(d.year + 1, 1, 1) if d.month == 12 else date(d.year, d.month + 1, 1)


def _saison_enregistree(conn) -> str:
    row = conn.execute("SELECT value FROM app_settings WHERE key = ?", (CLE_SAISON,)).fetchone()
    return row["value"] if row else None


def verifier_et_reinitialiser(aujourdhui: date = None):
    """Archive puis remet le classement à zéro si le mois a changé.

    Appelée au démarrage et avant chaque partie classée : le coût est d'une
    lecture, et cela garantit que la bascule se fait même si le serveur ne
    redémarre jamais au bon moment.
    """
    courante = saison_courante(aujourdhui)
    conn = get_connection()
    try:
        precedente = _saison_enregistree(conn)

        if precedente is None:
            # Première exécution : on enregistre la saison sans rien remettre à
            # zéro, sinon on effacerait les points existants sans prévenir.
            conn.execute(
                "INSERT INTO app_settings (key, value) VALUES (?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (CLE_SAISON, courante),
            )
            conn.commit()
            return {"reinitialise": False, "saison": courante}

        if precedente == courante:
            return {"reinitialise": False, "saison": courante}

        # Le mois a changé : on archive avant d'effacer.
        from app.modes.ranked import rank_config
        maintenant = datetime.now(timezone.utc).isoformat()
        joueurs = conn.execute(
            "SELECT id, rank_points, peak_points, best_tier_ever FROM users"
        ).fetchall()
        for u in joueurs:
            sommet = max(u["rank_points"] or 0, u["peak_points"] or 0)
            tier_sommet = rank_config.tier_from_points(sommet)
            conn.execute(
                "INSERT OR REPLACE INTO season_history "
                "(user_id, season, best_points, best_tier, final_points, archived_at) VALUES (?,?,?,?,?,?)",
                (u["id"], precedente, sommet, tier_sommet, u["rank_points"] or 0, maintenant),
            )
            meilleur_jamais = max(tier_sommet, u["best_tier_ever"] or 0)
            conn.execute(
                "UPDATE users SET rank_points = 0, rank_tier = 0, peak_points = 0, "
                "best_tier_ever = ?, last_decay_date = NULL WHERE id = ?",
                (meilleur_jamais, u["id"]),
            )

        conn.execute(
            "INSERT INTO app_settings (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (CLE_SAISON, courante),
        )
        conn.commit()
        return {"reinitialise": True, "saison": courante, "precedente": precedente, "joueurs": len(joueurs)}
    except Exception:
        conn.rollback()
        return {"reinitialise": False, "saison": courante}
    finally:
        conn.close()


def info(aujourdhui: date = None):
    """Informations de saison pour l'affichage : identifiant, date de fin, et
    temps restant en jours/heures."""
    d = aujourdhui or dates.aujourdhui()
    fin = fin_de_saison(d)
    maintenant = datetime.now(timezone.utc)
    limite = datetime(fin.year, fin.month, fin.day, tzinfo=timezone.utc)
    reste = limite - maintenant
    return {
        "saison": saison_courante(d),
        "fin": fin.isoformat(),
        "jours_restants": max(0, reste.days),
        "heures_restantes": max(0, reste.seconds // 3600),
    }


def palmares(user_id: int, limite: int = 12):
    """Saisons passées d'un joueur, la plus récente en premier."""
    conn = get_connection()
    rows = conn.execute(
        "SELECT season, best_points, best_tier, final_points FROM season_history "
        "WHERE user_id = ? ORDER BY season DESC LIMIT ?",
        (user_id, limite),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
