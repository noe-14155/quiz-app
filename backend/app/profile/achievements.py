"""Succès débloquables.

Chaque succès a un code stable (stocké en base), un libellé, une description et
une catégorie. Le déblocage est vérifié à des moments clés (fin de partie
classée, fin de défi du jour, montée de rang) à partir de données DÉJÀ
enregistrées — aucun compteur supplémentaire à maintenir.

Ajouter un succès = ajouter une entrée dans CATALOGUE et la règle correspondante
dans `evaluer`. Rien d'autre à toucher.
"""
from datetime import datetime, timezone

from app.core.db import get_connection

CATALOGUE = [
    # code,             titre,                 description,                                   catégorie
    ("premiere_partie",  "Premiers pas",        "Jouer sa première partie classée",            "Découverte"),
    ("sans_faute",       "Sans-faute",          "10 bonnes réponses sur 10 en classé",         "Performance"),
    ("dix_parties",      "Habitué",             "Jouer 10 parties classées",                   "Assiduité"),
    ("cinquante_parties","Pilier",              "Jouer 50 parties classées",                   "Assiduité"),
    ("daily_premier",    "Défi relevé",         "Terminer un premier défi du jour",            "Découverte"),
    ("daily_parfait",    "Journée parfaite",    "10/10 au défi du jour",                       "Performance"),
    ("serie_3",          "Trois jours de suite","Défi du jour 3 jours d'affilée",              "Assiduité"),
    ("serie_7",          "Une semaine pleine",  "Défi du jour 7 jours d'affilée",              "Assiduité"),
    ("serie_30",         "Un mois sans faillir","Défi du jour 30 jours d'affilée",             "Assiduité"),
    ("rang_malin",       "Malin",               "Atteindre le rang Malin",                     "Progression"),
    ("rang_grosse_tete", "Grosse Tête",         "Atteindre le rang Grosse Tête",               "Progression"),
    ("rang_genie",       "Génie",               "Atteindre le rang Génie",                     "Progression"),
    ("rang_prodige",     "Prodige",             "Atteindre le rang Prodige",                   "Progression"),
    ("xp_1000",          "Mille",               "Cumuler 1 000 XP",                            "Progression"),
    ("xp_5000",          "Cinq mille",          "Cumuler 5 000 XP",                            "Progression"),
]

_PAR_CODE = {c[0]: {"code": c[0], "titre": c[1], "description": c[2], "categorie": c[3]} for c in CATALOGUE}


def _debloques(conn, user_id):
    rows = conn.execute("SELECT code FROM achievements WHERE user_id = ?", (user_id,)).fetchall()
    return {r["code"] for r in rows}


def evaluer(user_id: int, pseudo: str = None, contexte: dict = None):
    """Vérifie toutes les règles et débloque ce qui doit l'être.
    Renvoie la liste des succès NOUVELLEMENT débloqués (pour les annoncer).

    `contexte` permet de transmettre un résultat ponctuel qui n'est pas en base
    au moment de l'appel (ex: score du défi du jour qui vient d'être joué).
    Ne lève jamais : un succès raté ne doit pas casser une fin de partie.
    """
    contexte = contexte or {}
    nouveaux = []
    try:
        conn = get_connection()
        deja = _debloques(conn, user_id)

        u = conn.execute("SELECT pseudo, xp_total, rank_points FROM users WHERE id = ?", (user_id,)).fetchone()
        if not u:
            conn.close()
            return []
        pseudo = pseudo or u["pseudo"]

        nb_parties = conn.execute(
            "SELECT COUNT(*) c FROM parties WHERE user_id = ? AND mode = 'ranked'", (user_id,)
        ).fetchone()["c"]

        from app.modes.ranked import rank_config
        rang = rank_config.tier_info(u["rank_points"])["rank"]
        rang_index = rank_config.RANKS.index(rang) if rang in rank_config.RANKS else 0

        from app.modes.daily import service as daily_service
        serie = daily_service.streak(pseudo)
        nb_daily = conn.execute(
            "SELECT COUNT(*) c FROM daily_attempts WHERE pseudo = ?", (pseudo,)
        ).fetchone()["c"]
        meilleur_daily = conn.execute(
            "SELECT MAX(score) m, MAX(total) t FROM daily_attempts WHERE pseudo = ?", (pseudo,)
        ).fetchone()

        regles = {
            "premiere_partie":   nb_parties >= 1,
            "dix_parties":       nb_parties >= 10,
            "cinquante_parties": nb_parties >= 50,
            "sans_faute":        contexte.get("ranked_sans_faute", False),
            "daily_premier":     nb_daily >= 1,
            "daily_parfait":     bool(meilleur_daily and meilleur_daily["m"] is not None
                                      and meilleur_daily["t"] and meilleur_daily["m"] == meilleur_daily["t"]),
            "serie_3":           serie["best"] >= 3,
            "serie_7":           serie["best"] >= 7,
            "serie_30":          serie["best"] >= 30,
            "rang_malin":        rang_index >= 2,
            "rang_grosse_tete":  rang_index >= 3,
            "rang_genie":        rang_index >= 4,
            "rang_prodige":      rang_index >= 5,
            "xp_1000":           u["xp_total"] >= 1000,
            "xp_5000":           u["xp_total"] >= 5000,
        }

        maintenant = datetime.now(timezone.utc).isoformat()
        for code, atteint in regles.items():
            if atteint and code not in deja:
                conn.execute(
                    "INSERT OR IGNORE INTO achievements (user_id, code, unlocked_at) VALUES (?,?,?)",
                    (user_id, code, maintenant),
                )
                nouveaux.append(_PAR_CODE[code])
        conn.commit()
        conn.close()
    except Exception:
        return []
    return nouveaux


def lister(user_id: int):
    """Catalogue complet avec l'état de chaque succès pour ce joueur."""
    conn = get_connection()
    rows = conn.execute(
        "SELECT code, unlocked_at FROM achievements WHERE user_id = ?", (user_id,)
    ).fetchall()
    conn.close()
    dates = {r["code"]: r["unlocked_at"] for r in rows}
    return [
        {**_PAR_CODE[c[0]], "unlocked": c[0] in dates, "unlocked_at": dates.get(c[0])}
        for c in CATALOGUE
    ]
