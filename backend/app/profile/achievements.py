"""Succès débloquables.

Chaque succès a un code stable (stocké en base), un libellé, une description et
une catégorie. Le déblocage est vérifié à des moments clés (fin de partie
classée, fin de défi du jour, montée de rang) à partir de données DÉJÀ
enregistrées — aucun compteur supplémentaire à maintenir.

Ajouter un succès = ajouter une entrée dans CATALOGUE et la règle correspondante
dans `evaluer`. Rien d'autre à toucher.
"""
import logging
from datetime import datetime, timezone

from app.core.db import get_connection

logger = logging.getLogger("quiz")

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
    ("rang_malin",       "Confirmé",            "Atteindre le rang Confirmé",                  "Progression"),
    ("rang_grosse_tete", "Expert",              "Atteindre le rang Expert",                    "Progression"),
    ("rang_genie",       "Champion",            "Atteindre le rang Champion",                  "Progression"),
    ("rang_prodige",     "Maître",              "Atteindre le rang Maître",                    "Progression"),
    ("rang_hall",        "Légende",             "Atteindre le rang Légende",                   "Progression"),
    ("xp_1000",          "Mille",               "Cumuler 1 000 XP",                            "Progression"),
    ("xp_5000",          "Cinq mille",          "Cumuler 5 000 XP",                            "Progression"),
    ("xp_15000",         "Quinze mille",        "Cumuler 15 000 XP",                           "Progression"),

    ("cent_parties",     "Marathonien",         "Jouer 100 parties classées",                  "Assiduité"),
    ("serie_100",        "Increvable",          "Défi du jour 100 jours d'affilée",            "Assiduité"),
    ("cinq_cents_q",     "Bibliothèque",        "Répondre à 500 questions différentes",        "Assiduité"),

    ("survie_20",        "Increvable en survie","Tenir 20 questions d'affilée en Survie",      "Performance"),
    ("survie_40",        "Inarrêtable",         "Tenir 40 questions d'affilée en Survie",      "Performance"),
    ("chrono_25",        "Vif",                 "25 bonnes réponses au contre-la-montre",      "Performance"),
    ("chrono_35",        "Foudroyant",          "35 bonnes réponses au contre-la-montre",      "Performance"),
    ("daily_parfait_5",  "Métronome",           "Cinq fois 10/10 au défi du jour",             "Performance"),

    # Codes hérités du duel, conservés tels quels : ils sont stockés en base,
    # les renommer effacerait les succès déjà obtenus par les joueurs.
    ("duel_premier",     "Dans la partie",      "Terminer une première partie multi",          "Découverte"),
    ("duel_5_gagnes",    "Meneur",              "Gagner cinq parties multi",                   "Performance"),
    ("enigme_premiere",  "Petit malin",         "Résoudre une première énigme",                "Découverte"),
    ("enigme_sans_aide", "Sans filet",          "Résoudre une énigme sans aucun indice",       "Performance"),
    ("enigme_10",        "Fin limier",          "Résoudre dix énigmes",                        "Assiduité"),

    ("polyvalent",       "Touche-à-tout",       "Jouer à cinq modes différents",               "Découverte"),
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
    conn = None
    try:
        conn = get_connection()
        deja = _debloques(conn, user_id)

        u = conn.execute("SELECT pseudo, xp_total, rank_points FROM users WHERE id = ?", (user_id,)).fetchone()
        if not u:
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
        daily_parfaits = conn.execute(
            "SELECT COUNT(*) c FROM daily_attempts WHERE pseudo = ? AND score = total AND total > 0", (pseudo,)
        ).fetchone()["c"]

        nb_questions = conn.execute(
            "SELECT COUNT(*) c FROM question_results WHERE user_id = ?", (user_id,)
        ).fetchone()["c"]

        # Records des modes rapides
        records = {r["mode"]: r["score"] for r in conn.execute(
            "SELECT mode, score FROM arcade_records WHERE user_id = ?", (user_id,)
        ).fetchall()}

        # Multi : parties auxquelles le joueur a réellement répondu, et
        # parties où personne n'a fait mieux que lui. Le score n'étant stocké
        # nulle part, on le recalcule ici comme partout ailleurs (somme des
        # points de ses réponses), ce qui évite un compteur de plus à tenir.
        multi_jouees = conn.execute(
            "SELECT COUNT(DISTINCT code) c FROM multi_reponses WHERE pseudo = ?", (pseudo,)
        ).fetchone()["c"]
        multi_gagnees = conn.execute(
            "WITH totaux AS ("
            "  SELECT code, pseudo, SUM(points) AS pts FROM multi_reponses GROUP BY code, pseudo"
            ") SELECT COUNT(*) c FROM totaux moi "
            "WHERE moi.pseudo = ? AND NOT EXISTS ("
            "  SELECT 1 FROM totaux autre WHERE autre.code = moi.code "
            "  AND autre.pseudo <> moi.pseudo AND autre.pts >= moi.pts)",
            (pseudo,),
        ).fetchone()["c"]

        # Énigmes résolues, et au moins une sans le moindre indice
        enigmes = conn.execute(
            "SELECT COUNT(*) c FROM enigme_attempts WHERE pseudo = ? AND trouve = 1", (pseudo,)
        ).fetchone()["c"]
        enigme_pure = conn.execute(
            "SELECT COUNT(*) c FROM enigme_attempts WHERE pseudo = ? AND trouve = 1 AND indices = 0",
            (pseudo,),
        ).fetchone()["c"]

        # Modes différents essayés, d'après le journal d'activité
        modes_essayes = conn.execute(
            "SELECT COUNT(DISTINCT event) c FROM activity_log "
            "WHERE pseudo = ? AND event LIKE '%\\_start' ESCAPE '\\'", (pseudo,)
        ).fetchone()["c"]

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
            "rang_hall":         rang_index >= 6,
            "xp_1000":           u["xp_total"] >= 1000,
            "xp_5000":           u["xp_total"] >= 5000,
            "xp_15000":          u["xp_total"] >= 15000,

            "cent_parties":      nb_parties >= 100,
            "serie_100":         serie["best"] >= 100,
            "cinq_cents_q":      nb_questions >= 500,

            "survie_20":         records.get("survie", 0) >= 20,
            "survie_40":         records.get("survie", 0) >= 40,
            "chrono_25":         records.get("chrono", 0) >= 25,
            "chrono_35":         records.get("chrono", 0) >= 35,
            "daily_parfait_5":   daily_parfaits >= 5,

            "duel_premier":      multi_jouees >= 1,
            "duel_5_gagnes":     multi_gagnees >= 5,
            "enigme_premiere":   enigmes >= 1,
            "enigme_sans_aide":  enigme_pure >= 1,
            "enigme_10":         enigmes >= 10,

            "polyvalent":        modes_essayes >= 5,
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
    except Exception:
        # Un succès raté ne doit pas casser une fin de partie — mais la
        # connexion, elle, doit être rendue : sans le `finally` ci-dessous,
        # chaque erreur laissait une connexion SQLite ouverte, et le verrou
        # d'écriture avec elle.
        logger.exception("Évaluation des succès impossible pour l'utilisateur %s", user_id)
        return []
    finally:
        if conn is not None:
            conn.close()
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
