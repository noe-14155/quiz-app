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
