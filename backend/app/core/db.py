import os
import sqlite3

from app.core.config import DATA_DIR, DB_PATH


def get_connection():
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
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
            created_at TEXT NOT NULL
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
    conn.close()
