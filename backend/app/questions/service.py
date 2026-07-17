import csv
import os
import random

from app.core.config import CSV_PATH, DATA_DIR
from app.core.db import get_connection


def import_questions_from_csv():
    """Recrée entièrement la table `questions` à partir de questions.csv.

    Appelée à chaque démarrage du conteneur : remplacer le CSV (via
    FileZilla) puis redémarrer le conteneur (via Portainer) suffit à
    mettre à jour la banque de questions, sans rebuild ni ligne de commande.
    """
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DROP TABLE IF EXISTS questions")
    cur.execute("""
        CREATE TABLE questions (
            id INTEGER PRIMARY KEY,
            theme TEXT NOT NULL,
            question TEXT NOT NULL,
            reponse_1 TEXT NOT NULL,
            reponse_2 TEXT NOT NULL,
            reponse_3 TEXT NOT NULL,
            reponse_4 TEXT NOT NULL,
            bonne_reponse INTEGER NOT NULL,
            explication TEXT NOT NULL,
            difficulte INTEGER NOT NULL
        )
    """)
    if os.path.exists(CSV_PATH):
        with open(CSV_PATH, encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            rows = [
                (
                    i + 1, r["theme"], r["question"], r["reponse_1"], r["reponse_2"],
                    r["reponse_3"], r["reponse_4"], int(r["bonne_reponse"]),
                    r["explication"], int(r["difficulte"]),
                )
                for i, r in enumerate(reader)
            ]
        cur.executemany(
            "INSERT INTO questions "
            "(id, theme, question, reponse_1, reponse_2, reponse_3, reponse_4, bonne_reponse, explication, difficulte) "
            "VALUES (?,?,?,?,?,?,?,?,?,?)",
            rows,
        )
    conn.commit()
    conn.close()


def get_themes():
    conn = get_connection()
    rows = conn.execute("SELECT DISTINCT theme FROM questions ORDER BY theme").fetchall()
    conn.close()
    return [r["theme"] for r in rows]


def _row_to_dict(row):
    return {
        "id": row["id"],
        "theme": row["theme"],
        "question": row["question"],
        "choix": [row["reponse_1"], row["reponse_2"], row["reponse_3"], row["reponse_4"]],
        "bonne_reponse": row["bonne_reponse"],
        "explication": row["explication"],
        "difficulte": row["difficulte"],
    }


def shuffle_choices(question):
    """Mélange l'ordre des 4 réponses, en réajustant l'index de la bonne réponse.

    Corrige le biais observé initialement dans le prototype (la bonne
    réponse se retrouvait trop souvent en première position).
    """
    order = list(range(4))
    random.shuffle(order)
    choix = [question["choix"][i] for i in order]
    bonne = order.index(question["bonne_reponse"] - 1) + 1
    return {**question, "choix": choix, "bonne_reponse": bonne}


def fetch_questions(themes=None, difficulte=None, difficulte_max=None, exclude_ids=None, limit=10, hide_answer=True, allow_repeat=True, shuffle=True):
    """Pioche des questions en base, mélange leurs réponses, et masque la
    bonne réponse/l'explication si hide_answer=True (cas des modes où le
    client ne doit pas voir la réponse avant d'avoir répondu).

    shuffle=False sert aux appels qui ne font que PIOCHER dans un grand
    ensemble (mode classé) : mélanger les réponses des 1114 questions pour
    n'en garder que 10 était du travail jeté à la poubelle."""
    conn = get_connection()
    query = "SELECT * FROM questions WHERE 1=1"
    params = []
    if themes:
        placeholders = ",".join("?" for _ in themes)
        query += f" AND theme IN ({placeholders})"
        params.extend(themes)
    if difficulte is not None:
        query += " AND difficulte = ?"
        params.append(difficulte)
    if difficulte_max is not None:
        query += " AND difficulte <= ?"
        params.append(difficulte_max)
    if exclude_ids:
        placeholders = ",".join("?" for _ in exclude_ids)
        query += f" AND id NOT IN ({placeholders})"
        params.extend(exclude_ids)
    # Le LIMIT est poussé dans le SQL : avant, TOUTES les questions
    # correspondantes (jusqu'à 1114) étaient chargées en mémoire et converties
    # en dictionnaires pour n'en garder que 10.
    query += " ORDER BY RANDOM()"
    if limit is not None and not allow_repeat:
        query += " LIMIT ?"
        params.append(limit)
    elif limit is not None:
        # allow_repeat : il faut au moins `limit` lignes, mais si la base en
        # contient moins on recyclera celles disponibles.
        query += " LIMIT ?"
        params.append(limit)
    rows = conn.execute(query, params).fetchall()
    conn.close()

    candidates = [_row_to_dict(r) for r in rows]
    if not candidates:
        return []

    prepare = shuffle_choices if shuffle else (lambda q: q)
    picked = []
    if allow_repeat:
        i = 0
        while len(picked) < limit:
            picked.append(prepare(candidates[i % len(candidates)]))
            i += 1
    else:
        picked = [prepare(c) for c in candidates[:limit]]

    if hide_answer:
        for p in picked:
            p.pop("bonne_reponse", None)
            p.pop("explication", None)
    return picked


def get_question_by_id(question_id):
    conn = get_connection()
    row = conn.execute("SELECT * FROM questions WHERE id = ?", (question_id,)).fetchone()
    conn.close()
    return _row_to_dict(row) if row else None
