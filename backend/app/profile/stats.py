import math

from app.core.db import get_connection


def compute_theme_stats(user_id: int):
    """Une question compte une seule fois par thème, avec son DERNIER résultat
    connu — pas un cumul de tous les essais (si ratée puis réussie plus tard,
    elle repasse en 'bonne'), exactement comme dans le prototype JSX."""
    conn = get_connection()
    rows = conn.execute(
        "SELECT q.theme, qr.result FROM question_results qr "
        "JOIN questions q ON q.id = qr.question_id WHERE qr.user_id = ?",
        (user_id,),
    ).fetchall()
    conn.close()

    raw = {}
    for r in rows:
        raw.setdefault(r["theme"], {"attempted": 0, "correct": 0})
        raw[r["theme"]]["attempted"] += 1
        if r["result"] == "bonne":
            raw[r["theme"]]["correct"] += 1

    return {
        theme: {
            "attempted": s["attempted"],
            "pct": round((s["correct"] / s["attempted"]) * 100) if s["attempted"] else 0,
        }
        for theme, s in raw.items()
    }


def compute_level(xp_total: int) -> int:
    return int(0.6 * math.sqrt(xp_total))


def historique_points(user_id: int, jours: int = 30):
    """Courbe des points sur la période. Alimentée par un relevé quotidien fait
    à la lecture du profil (voir `releve_du_jour`)."""
    conn = get_connection()
    rows = conn.execute(
        "SELECT date AS jour, points AS n FROM rank_history "
        "WHERE user_id = ? AND date >= date('now', ?) ORDER BY date",
        (user_id, f"-{jours} days"),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def releve_du_jour(user_id: int, points: int):
    """Enregistre le score du jour, une fois par jour. Sans historique, aucune
    courbe de progression n'est possible : on le construit au fil de l'eau."""
    try:
        conn = get_connection()
        conn.execute(
            "INSERT INTO rank_history (user_id, date, points) VALUES (?, date('now'), ?) "
            "ON CONFLICT(user_id, date) DO UPDATE SET points = excluded.points",
            (user_id, points),
        )
        conn.commit()
        conn.close()
    except Exception:
        pass


def parties_par_jour(user_id: int, jours: int = 30):
    """Nombre de parties classées par jour."""
    conn = get_connection()
    rows = conn.execute(
        "SELECT substr(created_at,1,10) AS jour, COUNT(*) AS n FROM parties "
        "WHERE user_id = ? AND created_at >= date('now', ?) GROUP BY jour ORDER BY jour",
        (user_id, f"-{jours} days"),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def points_forts_faibles(user_id: int, minimum: int = 5):
    """Thèmes les mieux et les moins bien réussis, à partir des résultats du
    mode classé. On ignore les thèmes trop peu joués : un 0/1 ne veut rien dire.
    """
    conn = get_connection()
    rows = conn.execute(
        "SELECT q.theme, COUNT(*) AS total, "
        "       SUM(CASE WHEN r.result = 'bonne' THEN 1 ELSE 0 END) AS bonnes "
        "FROM question_results r JOIN questions q ON q.id = r.question_id "
        "WHERE r.user_id = ? GROUP BY q.theme HAVING total >= ? ORDER BY (bonnes*1.0/total) DESC",
        (user_id, minimum),
    ).fetchall()
    conn.close()
    themes = [{"theme": r["theme"], "total": r["total"], "bonnes": r["bonnes"],
               "pct": round(r["bonnes"] / r["total"] * 100)} for r in rows]
    return {
        "themes": themes,
        "forts": themes[:3],
        "faibles": list(reversed(themes[-3:])) if len(themes) > 3 else [],
    }
