"""Mode multi en temps réel — la logique.

Principe fondateur : **le temps est la seule source de vérité.**

Les questions sont tirées à la création de la partie et l'hôte inscrit un unique
horodatage de départ. À partir de là, toute la partie se DÉDUIT de cet
horodatage : personne n'a besoin de faire avancer quoi que ce soit.

    cycle   = duree_question + duree_reveal
    ecoule  = maintenant - started_at
    index   = ecoule // cycle          -> question en cours
    reste   = ecoule %  cycle
    phase   = "question" si reste < duree_question, sinon "reveal"

C'est ce qui distingue ce mode du multi précédent, qui a été retiré. Là-bas, le
serveur tenait des colonnes `phase`, `current_index` et `question_started_at`
que plusieurs clients réécrivaient en concurrence : trois états mutables, des
verrous SQLite, et un joueur dont l'écran se verrouillait trente secondes se
retrouvait désynchronisé sans moyen de se rattraper.

Ici il n'existe qu'UN SEUL champ mutable dans toute la partie : `started_at`,
écrit une fois par un `UPDATE ... WHERE started_at IS NULL` (atomique : seul le
premier appel gagne). Tout le reste n'est que de l'insertion sur des clés
primaires distinctes — plus rien ne peut entrer en collision. Et un joueur qui
revient après une interruption recalcule simplement où en est la partie : il a
manqué deux questions, c'est tout, il n'y a rien à resynchroniser.

Le score n'est stocké nulle part pendant la partie : il se recalcule par une
somme sur les réponses. C'était l'autre piège de l'ancien mode, où une table
`multi_scores` était réécrite en entier par chaque joueur.
"""
import json
import random
from datetime import datetime, timezone

from app.core import dates

# Sans I, L, O, 0 ni 1 : illisibles sur un écran de téléphone qu'on se passe.
ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
LONGUEUR_CODE = 5

MAX_JOUEURS = 10
MIN_JOUEURS = 2

# Réglages proposés à l'hôte. Bornés côté serveur : une durée fantaisiste
# (0 seconde, ou 300) casserait l'arithmétique du temps pour tout le monde.
NB_QUESTIONS_POSSIBLES = [5, 10, 15]
DUREES_POSSIBLES = [10, 15, 20, 30]
DUREE_REVEAL = 6          # temps d'affichage de la correction, entre 2 questions
DUREE_COMPTE_A_REBOURS = 3  # petit décompte avant la 1re question

POINTS_BASE = 100         # une bonne réponse, quelle que soit la vitesse
POINTS_VITESSE = 100      # bonus dégressif : répondre vite rapporte davantage


def code_aleatoire():
    return "".join(random.choice(ALPHABET) for _ in range(LONGUEUR_CODE))


def _instant(iso: str) -> datetime:
    """Un horodatage ISO stocké en base -> datetime conscient du fuseau."""
    d = datetime.fromisoformat(iso)
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def maintenant() -> datetime:
    return datetime.now(timezone.utc)


def etat_temporel(partie, a_l_instant: datetime = None):
    """Où en est la partie, déduit du seul `started_at`.

    Renvoie un dictionnaire toujours de la même forme, que la partie soit dans
    le salon, en cours ou terminée — le client n'a ainsi qu'un seul schéma à
    lire.
    """
    nb = partie["nb_questions"]
    duree_q = partie["duree_question"]
    duree_r = partie["duree_reveal"]
    cycle = duree_q + duree_r

    if not partie["started_at"]:
        return {
            "statut": "salon", "index": None, "phase": None,
            "reste_ms": None, "nb_questions": nb,
            "duree_question": duree_q, "duree_reveal": duree_r,
        }

    ecoule = ((a_l_instant or maintenant()) - _instant(partie["started_at"])).total_seconds()

    # Décompte d'entrée : trois secondes pour que chacun pose son pouce sur
    # l'écran. Sans lui, le premier à charger la page répond avant les autres.
    if ecoule < DUREE_COMPTE_A_REBOURS:
        return {
            "statut": "decompte", "index": 0, "phase": "decompte",
            "reste_ms": int((DUREE_COMPTE_A_REBOURS - ecoule) * 1000), "nb_questions": nb,
            "duree_question": duree_q, "duree_reveal": duree_r,
        }

    ecoule -= DUREE_COMPTE_A_REBOURS
    index = int(ecoule // cycle)
    if index >= nb:
        return {
            "statut": "termine", "index": nb, "phase": "fin",
            "reste_ms": 0, "nb_questions": nb,
            "duree_question": duree_q, "duree_reveal": duree_r,
        }

    reste_cycle = ecoule % cycle
    if reste_cycle < duree_q:
        phase, reste = "question", duree_q - reste_cycle
    else:
        phase, reste = "reveal", cycle - reste_cycle

    return {
        "statut": "en_cours", "index": index, "phase": phase,
        "reste_ms": int(reste * 1000), "nb_questions": nb,
        "duree_question": duree_q, "duree_reveal": duree_r,
    }


def points_pour(ms_ecoulees: int, duree_question: int) -> int:
    """Points d'une bonne réponse : une base fixe plus un bonus de vitesse
    dégressif. Répondre à la première seconde vaut le maximum, répondre juste
    avant la fin ne rapporte que la base — mais rapporte quand même : le but
    reste de savoir, pas seulement d'être rapide."""
    total_ms = max(1, duree_question * 1000)
    fraction_restante = max(0.0, min(1.0, 1 - ms_ecoulees / total_ms))
    return POINTS_BASE + round(POINTS_VITESSE * fraction_restante)


def partie_par_code(conn, code: str):
    return conn.execute("SELECT * FROM multi_parties WHERE code = ?", (code.upper(),)).fetchone()


def joueurs(conn, code: str):
    return [dict(r) for r in conn.execute(
        "SELECT pseudo, user_id, avatar_face, avatar_color, rejoint_at "
        "FROM multi_joueurs WHERE code = ? ORDER BY rejoint_at", (code.upper(),)
    ).fetchall()]


def classement(conn, code: str):
    """Cumul des points de chacun, recalculé à la demande.

    C'est une somme, pas un compteur entretenu : aucune ligne partagée, donc
    aucune écriture concurrente possible. Départage par le nombre de bonnes
    réponses puis par le temps cumulé, pour qu'une égalité de points ne donne
    jamais deux premiers.
    """
    rows = conn.execute(
        "SELECT j.pseudo, j.avatar_face, j.avatar_color, "
        "       COALESCE(SUM(r.points), 0) AS points, "
        "       COALESCE(SUM(r.juste), 0)  AS bonnes, "
        "       COALESCE(SUM(r.ms), 0)     AS temps_ms "
        "FROM multi_joueurs j "
        "LEFT JOIN multi_reponses r ON r.code = j.code AND r.pseudo = j.pseudo "
        "WHERE j.code = ? GROUP BY j.pseudo "
        "ORDER BY points DESC, bonnes DESC, temps_ms ASC",
        (code.upper(),),
    ).fetchall()
    return [{**dict(r), "position": i + 1} for i, r in enumerate(rows)]


def nb_reponses(conn, code: str, index: int) -> int:
    return conn.execute(
        "SELECT COUNT(*) c FROM multi_reponses WHERE code = ? AND question_index = ?",
        (code.upper(), index),
    ).fetchone()["c"]


def question_publique(partie, index: int):
    """La question `index`, débarrassée de sa réponse."""
    questions = json.loads(partie["questions_data"])
    if not 0 <= index < len(questions):
        return None
    q = questions[index]
    return {k: v for k, v in q.items() if k not in ("bonne_reponse", "explication")}


def question_complete(partie, index: int):
    questions = json.loads(partie["questions_data"])
    return questions[index] if 0 <= index < len(questions) else None


def peut_lire_question(etat, index: int) -> bool:
    """Autorise la lecture d'une question.

    La question suivante est servie DÈS la phase de révélation de la
    précédente : le client a ainsi six secondes pour la télécharger, ce qui
    absorbe un réseau capricieux sans jamais donner un temps d'avance — on ne
    peut pas lire la question 5 pendant la question 2.
    """
    if etat["statut"] == "termine":
        return index < etat["nb_questions"]
    if etat["statut"] not in ("en_cours", "decompte"):
        return False
    if index <= etat["index"]:
        return True
    return index == etat["index"] + 1 and etat["phase"] == "reveal"


def fenetre_ouverte(etat, index: int) -> bool:
    """Vrai si l'on peut encore répondre à cette question."""
    return etat["statut"] == "en_cours" and etat["phase"] == "question" and etat["index"] == index


def reveal_disponible(etat, index: int) -> bool:
    """La correction n'est lisible qu'une fois la fenêtre de réponse FERMÉE.
    Sinon il suffirait d'appeler cet endpoint pour connaître la réponse avant
    de répondre."""
    if etat["statut"] == "termine":
        return index < etat["nb_questions"]
    if etat["statut"] != "en_cours":
        return False
    return index < etat["index"] or (index == etat["index"] and etat["phase"] == "reveal")


def detail_question(conn, partie, index: int):
    """Correction d'une question : bonne réponse, explication, qui a répondu
    quoi, et la répartition des choix (utile pour commenter à voix haute)."""
    q = question_complete(partie, index)
    if q is None:
        return None
    reponses = [dict(r) for r in conn.execute(
        "SELECT r.pseudo, r.choix, r.juste, r.points, r.ms, j.avatar_face, j.avatar_color "
        "FROM multi_reponses r LEFT JOIN multi_joueurs j "
        "  ON j.code = r.code AND j.pseudo = r.pseudo "
        "WHERE r.code = ? AND r.question_index = ? ORDER BY r.ms",
        (partie["code"], index),
    ).fetchall()]
    repartition = [0, 0, 0, 0]
    for r in reponses:
        if 0 <= r["choix"] < 4:
            repartition[r["choix"]] += 1
    return {
        "index": index,
        "question": q["question"],
        "theme": q["theme"],
        "difficulte": q["difficulte"],
        "choix": q["choix"],
        "correct_index": q["bonne_reponse"] - 1,
        "explication": q["explication"],
        "reponses": reponses,
        "repartition": repartition,
        "question_id": q["id"],
    }


def enregistrer_partie(conn, code, hote, questions, duree_question):
    conn.execute(
        "INSERT INTO multi_parties (code, hote, questions_data, nb_questions, "
        "duree_question, duree_reveal, started_at, xp_versee, created_at) "
        "VALUES (?,?,?,?,?,?,NULL,0,?)",
        (code, hote, json.dumps(questions), len(questions), duree_question,
         DUREE_REVEAL, dates.horodatage()),
    )
