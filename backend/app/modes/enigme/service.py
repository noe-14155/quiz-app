"""Énigme du jour.

Une devinette par jour, la même pour tout le monde, avec une réponse en texte
libre et trois indices débloquables. Le choix du jour est déterministe : la date
sert de graine, donc rien n'est stocké et tout le monde reçoit la même.

La difficulté du mode tient surtout à la reconnaissance de la réponse : « le
Soleil », « soleil » et « SOLEIL » doivent être acceptés, sans pour autant
valider n'importe quoi. Voir `normaliser`.
"""
import csv
import hashlib
import os
import re
import unicodedata
from datetime import date, datetime, timezone

from app.core.config import DATA_DIR
from app.core.db import get_connection

# Barème : trouver seul vaut le maximum, chaque indice et chaque erreur coûtent.
POINTS_MAX = 100
COUT_INDICE = 20
COUT_ERREUR = 5
POINTS_MIN = 20
NB_INDICES = 3

_CACHE = None


def _chemin_csv():
    """Le CSV est livré avec l'image, mais on accepte une version déposée dans
    DATA_DIR pour pouvoir en ajouter sans redéployer."""
    perso = os.path.join(DATA_DIR, "enigmes.csv")
    if os.path.exists(perso):
        return perso
    # app/modes/enigme/service.py -> remonter jusqu'à backend/, où vit seed_data
    racine = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
        os.path.abspath(__file__)))))
    return os.path.join(racine, "seed_data", "enigmes.csv")


def charger():
    global _CACHE
    if _CACHE is not None:
        return _CACHE
    lignes = []
    try:
        with open(_chemin_csv(), encoding="utf-8") as f:
            for r in csv.DictReader(f):
                lignes.append({
                    "id": int(r["id"]),
                    "enigme": r["enigme"],
                    "reponse": r["reponse"],
                    "alternatives": [a for a in (r.get("alternatives") or "").split("|") if a],
                    "indices": [r["indice_1"], r["indice_2"], r["indice_3"]],
                    "categorie": r["categorie"],
                    "difficulte": int(r["difficulte"]),
                })
    except Exception:
        lignes = []
    _CACHE = lignes
    return _CACHE


def today_str():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def enigme_du_jour(date_str: str = None):
    """Sélection déterministe : la même énigme pour tous, un cycle complet avant
    qu'une énigme ne revienne."""
    lignes = charger()
    if not lignes:
        return None
    date_str = date_str or today_str()
    # Le rang du jour dans le cycle : on avance d'une énigme par jour, et l'ordre
    # du cycle dépend d'un mélange stable, pour ne pas suivre l'ordre du CSV.
    jour = (date.fromisoformat(date_str) - date(2026, 1, 1)).days
    ordre = sorted(
        range(len(lignes)),
        key=lambda i: hashlib.sha256(f"enigme-{i}".encode()).hexdigest(),
    )
    return lignes[ordre[jour % len(lignes)]]


def normaliser(texte: str) -> str:
    """Ramène une réponse à sa forme comparable : sans accents, sans article,
    sans ponctuation, en minuscules.

    Objectif : accepter les formulations naturelles (« c'est le soleil », « LE
    SOLEIL », « soleil ») sans valider une réponse réellement différente.
    """
    t = unicodedata.normalize("NFD", (texte or "").lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")  # accents
    t = re.sub(r"[^a-z0-9\s]", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    # Formules d'introduction fréquentes
    t = re.sub(r"^(c est|c etait|je pense que c est|la reponse est|il s agit d[eu]?|reponse)\s+", "", t)
    # Articles, y compris élidés (déjà transformés en espace par la ponctuation)
    mots = [m for m in t.split() if m not in
            ("le", "la", "les", "l", "un", "une", "des", "du", "de", "d", "au", "aux", "mon", "ma", "mes", "ton", "ta", "tes", "son", "sa", "ses")]
    return " ".join(mots)


def verifier(enigme: dict, proposition: str) -> bool:
    """Une proposition est bonne si elle correspond à la réponse ou à l'une des
    variantes acceptées, après normalisation."""
    if not proposition or not proposition.strip():
        return False
    p = normaliser(proposition)
    if not p:
        return False
    attendues = {normaliser(enigme["reponse"])} | {normaliser(a) for a in enigme["alternatives"]}
    attendues.discard("")
    return p in attendues


def points(indices_utilises: int, erreurs: int) -> int:
    return max(POINTS_MIN, POINTS_MAX - COUT_INDICE * indices_utilises - COUT_ERREUR * erreurs)


# ---------------------------------------------------------------------------
# Tentatives
# ---------------------------------------------------------------------------

def tentative(pseudo: str, date_str: str = None):
    date_str = date_str or today_str()
    conn = get_connection()
    r = conn.execute(
        "SELECT * FROM enigme_attempts WHERE date = ? AND pseudo = ?", (date_str, pseudo)
    ).fetchone()
    conn.close()
    return dict(r) if r else None


def _assurer(conn, pseudo, user_id, date_str):
    conn.execute(
        "INSERT OR IGNORE INTO enigme_attempts (date, pseudo, user_id, indices, erreurs, trouve, points, created_at) "
        "VALUES (?,?,?,0,0,0,0,?)",
        (date_str, pseudo, user_id, datetime.now(timezone.utc).isoformat()),
    )


def prendre_indice(pseudo: str, user_id, date_str: str = None):
    """Débloque l'indice suivant. Renvoie le nombre d'indices désormais visibles."""
    date_str = date_str or today_str()
    conn = get_connection()
    _assurer(conn, pseudo, user_id, date_str)
    conn.execute(
        "UPDATE enigme_attempts SET indices = MIN(indices + 1, ?) "
        "WHERE date = ? AND pseudo = ? AND trouve = 0",
        (NB_INDICES, date_str, pseudo),
    )
    conn.commit()
    r = conn.execute(
        "SELECT indices FROM enigme_attempts WHERE date = ? AND pseudo = ?", (date_str, pseudo)
    ).fetchone()
    conn.close()
    return r["indices"] if r else 0


def enregistrer_essai(pseudo: str, user_id, juste: bool, date_str: str = None):
    """Enregistre une proposition et renvoie l'état à jour."""
    date_str = date_str or today_str()
    conn = get_connection()
    _assurer(conn, pseudo, user_id, date_str)
    if juste:
        etat = conn.execute(
            "SELECT indices, erreurs FROM enigme_attempts WHERE date = ? AND pseudo = ?",
            (date_str, pseudo),
        ).fetchone()
        pts = points(etat["indices"], etat["erreurs"])
        conn.execute(
            "UPDATE enigme_attempts SET trouve = 1, points = ?, resolu_at = ? "
            "WHERE date = ? AND pseudo = ? AND trouve = 0",
            (pts, datetime.now(timezone.utc).isoformat(), date_str, pseudo),
        )
    else:
        conn.execute(
            "UPDATE enigme_attempts SET erreurs = erreurs + 1 WHERE date = ? AND pseudo = ? AND trouve = 0",
            (date_str, pseudo),
        )
    conn.commit()
    r = conn.execute(
        "SELECT * FROM enigme_attempts WHERE date = ? AND pseudo = ?", (date_str, pseudo)
    ).fetchone()
    conn.close()
    return dict(r) if r else None


def classement(date_str: str = None, limite: int = 20):
    """Ceux qui ont trouvé aujourd'hui, les meilleurs scores en premier."""
    date_str = date_str or today_str()
    conn = get_connection()
    rows = conn.execute(
        "SELECT pseudo, points, indices, erreurs, resolu_at FROM enigme_attempts "
        "WHERE date = ? AND trouve = 1 ORDER BY points DESC, resolu_at ASC LIMIT ?",
        (date_str, limite),
    ).fetchall()
    total = conn.execute(
        "SELECT COUNT(*) c FROM enigme_attempts WHERE date = ?", (date_str,)
    ).fetchone()["c"]
    trouve = conn.execute(
        "SELECT COUNT(*) c FROM enigme_attempts WHERE date = ? AND trouve = 1", (date_str,)
    ).fetchone()["c"]
    conn.close()
    return {"classement": [dict(r) for r in rows], "tentatives": total, "trouvee": trouve}


def serie(pseudo: str, date_str: str = None):
    """Jours consécutifs où l'énigme a été résolue. Même tolérance que le défi
    du jour : ne pas encore avoir joué aujourd'hui ne casse pas la série."""
    from datetime import timedelta
    if not pseudo:
        return {"current": 0, "best": 0, "resolu_today": False}
    aujourdhui = date.fromisoformat(date_str or today_str())
    conn = get_connection()
    rows = conn.execute(
        "SELECT date FROM enigme_attempts WHERE pseudo = ? AND trouve = 1 ORDER BY date DESC", (pseudo,)
    ).fetchall()
    conn.close()
    jours = set()
    for r in rows:
        try:
            jours.add(date.fromisoformat(r["date"]))
        except (TypeError, ValueError):
            continue
    if not jours:
        return {"current": 0, "best": 0, "resolu_today": False}
    resolu_today = aujourdhui in jours
    curseur = aujourdhui if resolu_today else aujourdhui - timedelta(days=1)
    courante = 0
    while curseur in jours:
        courante += 1
        curseur -= timedelta(days=1)
    ordonnes = sorted(jours)
    meilleure = actuelle = 1
    for i in range(1, len(ordonnes)):
        actuelle = actuelle + 1 if (ordonnes[i] - ordonnes[i - 1]).days == 1 else 1
        meilleure = max(meilleure, actuelle)
    return {"current": courante, "best": max(meilleure, courante), "resolu_today": resolu_today}
