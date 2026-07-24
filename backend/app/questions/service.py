import csv
import logging
import os
import random

from app.core.config import CSV_PATH, DATA_DIR
from app.core.db import get_connection

logger = logging.getLogger("quiz")


def _lire_csv(chemin: str):
    """Lit le CSV et renvoie les lignes prêtes à insérer.

    L'identifiant vient de la COLONNE `id` du fichier, jamais du numéro de
    ligne. C'est la seule façon de garder un identifiant stable : l'historique
    des joueurs (`question_results`), les statistiques de calibration
    (`question_stats`) et les signalements (`question_reports`) pointent vers
    ces identifiants. Avec un identifiant dérivé du rang de la ligne, insérer
    une question au milieu du fichier décalait silencieusement tout
    l'historique — un joueur se voyait attribuer des réponses à des questions
    qu'il n'avait jamais vues.

    Les lignes inexploitables (identifiant absent, en double, difficulté ou
    bonne réponse hors bornes) sont IGNORÉES plutôt que corrigées au jugé :
    mieux vaut une question de moins qu'une question fausse. Le compte est
    journalisé pour qu'un problème de fichier soit visible dans les logs.
    """
    rows, vus, rejets = [], set(), []
    with open(chemin, encoding="utf-8-sig") as f:
        for numero, r in enumerate(csv.DictReader(f), start=2):  # 2 = 1re ligne de données
            try:
                qid = int(str(r["id"]).strip())
                bonne = int(str(r["bonne_reponse"]).strip())
                difficulte = int(str(r["difficulte"]).strip())
                choix = [r["reponse_1"], r["reponse_2"], r["reponse_3"], r["reponse_4"]]
                if not r["question"].strip() or not all(c.strip() for c in choix):
                    raise ValueError("question ou réponse vide")
                if qid <= 0 or qid in vus:
                    raise ValueError("identifiant absent ou en double")
                if not 1 <= bonne <= 4:
                    raise ValueError("bonne_reponse hors de 1-4")
                if not 1 <= difficulte <= 5:
                    raise ValueError("difficulte hors de 1-5")
            except (KeyError, TypeError, ValueError) as e:
                rejets.append(f"ligne {numero} ({e})")
                continue
            vus.add(qid)
            rows.append((qid, r["theme"], r["question"], *choix, bonne,
                         r.get("explication") or "", difficulte))

    if rejets:
        logger.warning("questions.csv : %d ligne(s) ignorée(s) — %s",
                       len(rejets), ", ".join(rejets[:10]))
    logger.info("questions.csv : %d question(s) importée(s)", len(rows))
    return rows


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
        rows = _lire_csv(CSV_PATH)
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


def shuffle_choices(question, seed=None):
    """Mélange l'ordre des 4 réponses, en réajustant l'index de la bonne réponse.

    Corrige le biais observé initialement dans le prototype (la bonne
    réponse se retrouvait trop souvent en première position).

    seed : si fourni, le mélange est déterministe et reproductible (utilisé par
    le défi quotidien pour que tous les joueurs voient le même ordre). Sans
    seed, mélange aléatoire habituel — aucun changement pour les autres modes.
    """
    rng = random.Random(seed) if seed is not None else random
    order = list(range(4))
    rng.shuffle(order)
    choix = [question["choix"][i] for i in order]
    bonne = order.index(question["bonne_reponse"] - 1) + 1
    return {**question, "choix": choix, "bonne_reponse": bonne}


def fetch_questions(themes=None, difficulte=None, difficulte_max=None, exclude_ids=None, limit=10, hide_answer=True, allow_repeat=True, shuffle=True, user_id=None):
    """Pioche des questions en base, mélange leurs réponses, et masque la
    bonne réponse/l'explication si hide_answer=True (cas des modes où le
    client ne doit pas voir la réponse avant d'avoir répondu).

    shuffle=False sert aux appels qui ne font que PIOCHER dans un grand
    ensemble (mode classé) : mélanger les réponses des 1114 questions pour
    n'en garder que 10 était du travail jeté à la poubelle."""
    conn = get_connection()
    # Rotation : quand on connaît le joueur, on sert d'abord les questions
    # qu'il n'a JAMAIS vues, puis les plus anciennes. Un simple ORDER BY
    # RANDOM() ramenait sans cesse les mêmes : sur 1 500 questions, tirer 10
    # fois au hasard fait réapparaître un doublon bien plus vite qu'on ne le
    # croit (c'est le paradoxe des anniversaires).
    if user_id is not None:
        query = (
            "SELECT q.* FROM questions q "
            "LEFT JOIN question_results r ON r.question_id = q.id AND r.user_id = ? "
            "WHERE 1=1"
        )
        params = [user_id]
    else:
        query = "SELECT * FROM questions q WHERE 1=1"
        params = []
    if themes:
        placeholders = ",".join("?" for _ in themes)
        query += f" AND q.theme IN ({placeholders})"
        params.extend(themes)
    if difficulte is not None:
        query += " AND q.difficulte = ?"
        params.append(difficulte)
    if difficulte_max is not None:
        query += " AND q.difficulte <= ?"
        params.append(difficulte_max)
    if exclude_ids:
        placeholders = ",".join("?" for _ in exclude_ids)
        query += f" AND q.id NOT IN ({placeholders})"
        params.extend(exclude_ids)
    # Le LIMIT est poussé dans le SQL : avant, TOUTES les questions
    # correspondantes (jusqu'à 1114) étaient chargées en mémoire et converties
    # en dictionnaires pour n'en garder que 10.
    if user_id is not None:
        # Jamais vues d'abord (r.question_id NULL), puis les plus anciennes,
        # et au hasard à l'intérieur de chaque groupe.
        query += " ORDER BY (r.question_id IS NOT NULL), r.updated_at, RANDOM()"
    else:
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
