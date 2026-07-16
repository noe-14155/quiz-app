from app.core.db import get_connection


def xp_for_difficulty(difficulte: int) -> int:
    """Une question difficile rapporte plus d'XP qu'une facile."""
    return difficulte * 5


def award_xp(user_id: int, amount: int):
    conn = get_connection()
    conn.execute("UPDATE users SET xp_total = xp_total + ? WHERE id = ?", (amount, user_id))
    conn.commit()
    conn.close()


def award_xp_by_pseudo(pseudo: str, amount: int):
    """Utilisé par le mode multi, où les joueurs sont identifiés par un nom
    plutôt qu'un token — n'attribue de l'XP que si ce nom correspond à un
    vrai compte enregistré."""
    conn = get_connection()
    user = conn.execute("SELECT id FROM users WHERE pseudo = ?", (pseudo,)).fetchone()
    if user:
        conn.execute("UPDATE users SET xp_total = xp_total + ? WHERE id = ?", (amount, user["id"]))
        conn.commit()
    conn.close()
