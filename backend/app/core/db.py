import os
import sqlite3

from app.core.config import DATA_DIR, DB_PATH


_data_dir_ready = False
_wal_enabled = False


def get_connection():
    # os.makedirs était appelé à CHAQUE connexion (donc à chaque requête HTTP) :
    # inutile, le dossier ne disparaît pas en cours de route.
    global _data_dir_ready, _wal_enabled
    if not _data_dir_ready:
        os.makedirs(DATA_DIR, exist_ok=True)
        _data_dir_ready = True
    # timeout=10 : si la base est verrouillée par une autre écriture (plusieurs
    # joueurs multi qui agissent en même temps), on attend jusqu'à 10 s au lieu
    # de lever immédiatement "database is locked" (qui provoquait des erreurs 500
    # en cascade quand plusieurs personnes rejoignaient/jouaient simultanément).
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    if not _wal_enabled:
        # WAL : bien meilleur pour les accès concurrents (lecteurs et écrivain
        # ne se bloquent pas mutuellement). Activé une fois, persistant sur le
        # fichier de base.
        try:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA busy_timeout=10000")
            _wal_enabled = True
        except Exception:
            pass
    return conn


def init_schema():
    """Crée les tables persistantes si elles n'existent pas encore.

    Contrairement à la table `questions` (entièrement recréée à chaque
    démarrage depuis le CSV, voir questions/service.py), ces tables ne
    doivent JAMAIS être supprimées automatiquement : elles contiennent les
    comptes, les scores et les parties des joueurs.
    """
    conn = get_connection()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pseudo TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            xp_total INTEGER NOT NULL DEFAULT 0,
            rank_tier INTEGER NOT NULL DEFAULT 0,
            rank_points INTEGER NOT NULL DEFAULT 0,
            is_admin INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS daily_attempts (
            date TEXT NOT NULL,
            pseudo TEXT NOT NULL,
            user_id INTEGER,
            score INTEGER NOT NULL,
            total INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY (date, pseudo)
        );

        CREATE TABLE IF NOT EXISTS activity_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            pseudo TEXT,
            event TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS parties (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            mode TEXT NOT NULL,
            score INTEGER NOT NULL DEFAULT 0,
            questions_data TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS question_results (
            user_id INTEGER NOT NULL,
            question_id INTEGER NOT NULL,
            result TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (user_id, question_id)
        );

        CREATE TABLE IF NOT EXISTS multi_rooms (
            code TEXT PRIMARY KEY,
            host_name TEXT NOT NULL,
            players TEXT NOT NULL,
            themes TEXT NOT NULL,
            difficulte INTEGER NOT NULL DEFAULT 3,
            nb_questions INTEGER NOT NULL DEFAULT 10,
            game_mode TEXT NOT NULL DEFAULT 'classique',
            status TEXT NOT NULL DEFAULT 'lobby',
            phase TEXT NOT NULL DEFAULT 'answering',
            question_ids TEXT,
            questions_data TEXT,
            current_index INTEGER NOT NULL DEFAULT 0,
            question_started_at TEXT,
            reveal_started_at TEXT,
            created_at TEXT NOT NULL
        );

        -- Chaque réponse est SA PROPRE LIGNE (clé primaire composite) :
        -- c'est ce qui corrige le risque de conflit d'écriture identifié
        -- dans le prototype JSX, où toutes les réponses partageaient un
        -- même objet réécrit en entier à chaque soumission.
        CREATE TABLE IF NOT EXISTS multi_answers (
            room_code TEXT NOT NULL,
            question_index INTEGER NOT NULL,
            player_name TEXT NOT NULL,
            choice INTEGER NOT NULL,
            answered_at TEXT NOT NULL,
            PRIMARY KEY (room_code, question_index, player_name)
        );

        CREATE TABLE IF NOT EXISTS multi_scores (
            room_code TEXT NOT NULL,
            player_name TEXT NOT NULL,
            score INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (room_code, player_name)
        );
    """)
    conn.commit()

    # Migration : les bases créées avant l'ajout du module admin n'ont pas
    # encore la colonne is_admin sur une table users déjà existante.
    # CREATE TABLE IF NOT EXISTS ne l'ajoute pas automatiquement, donc on
    # vérifie et on l'ajoute nous-mêmes si besoin.
    existing_columns = [row["name"] for row in conn.execute("PRAGMA table_info(users)").fetchall()]
    if "is_admin" not in existing_columns:
        conn.execute("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0")
        conn.commit()

    # Migration : même chose pour questions_data sur multi_rooms, ajoutée
    # après coup pour corriger le mélange non persistant des questions en
    # multi. Sans cette migration, /api/multi/{code}/start échoue avec une
    # erreur 500 ("no such column: questions_data") sur une base existante.
    existing_room_columns = [row["name"] for row in conn.execute("PRAGMA table_info(multi_rooms)").fetchall()]
    if "questions_data" not in existing_room_columns:
        conn.execute("ALTER TABLE multi_rooms ADD COLUMN questions_data TEXT")
        conn.commit()

    # Migration : date du dernier calcul de la perte quotidienne du mode classé
    # (à partir de Diamant III). NULL = jamais calculée encore.
    if "last_decay_date" not in existing_columns:
        conn.execute("ALTER TABLE users ADD COLUMN last_decay_date TEXT")
        conn.commit()

    conn.close()


def create_indexes():
    """Index sur les colonnes réellement filtrées dans les requêtes chaudes.
    À appeler APRÈS l'import du CSV, car la table `questions` est recréée à
    chaque démarrage (ce qui détruit ses index)."""
    conn = get_connection()
    conn.executescript("""
        CREATE INDEX IF NOT EXISTS idx_questions_theme ON questions(theme);
        CREATE INDEX IF NOT EXISTS idx_questions_difficulte ON questions(difficulte);
        CREATE INDEX IF NOT EXISTS idx_results_user ON question_results(user_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
        CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);
        CREATE INDEX IF NOT EXISTS idx_activity_event ON activity_log(event);
        CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_attempts(date);
    """)
    conn.commit()
    conn.close()
