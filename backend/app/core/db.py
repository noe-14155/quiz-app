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

    # check_same_thread=False : uvicorn sert les requêtes sur plusieurs threads.
    # Chaque appel crée SA connexion (jamais partagée entre threads), mais SQLite
    # refuse par défaut qu'une connexion soit même créée hors du thread principal
    # dans certains montages ; on lève cette contrainte explicitement puisqu'on
    # ne partage jamais une connexion entre threads.
    # timeout=10 : attendre si la base est verrouillée par une écriture concurrente
    # plutôt que de lever "database is locked" immédiatement.
    conn = sqlite3.connect(DB_PATH, timeout=10, check_same_thread=False)
    conn.row_factory = sqlite3.Row

    # Ces PRAGMA doivent être posés sur CHAQUE connexion (ils ne sont pas
    # globaux à la base pour busy_timeout). L'ancien code les sautait à partir de
    # la 2e connexion à cause d'un flag global : la connexion du 2e joueur se
    # retrouvait sans busy_timeout et plantait sur un verrou — ce qui pouvait
    # tuer le worker uvicorn (d'où "erreur 500, obligé de relancer le stack").
    conn.execute("PRAGMA busy_timeout=10000")

    # WAL : meilleur pour la concurrence, mais fragile sur certains volumes
    # Docker/réseau. On l'active une seule fois et on n'échoue jamais si le
    # montage ne le supporte pas (repli silencieux sur le mode journal par défaut,
    # qui fonctionne aussi grâce au busy_timeout ci-dessus).
    if not _wal_enabled:
        try:
            conn.execute("PRAGMA journal_mode=WAL")
        except Exception:
            pass
        _wal_enabled = True

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
            answers TEXT,
            created_at TEXT NOT NULL,
            PRIMARY KEY (date, pseudo)
        );

        CREATE TABLE IF NOT EXISTS enigme_attempts (
            date TEXT NOT NULL,
            pseudo TEXT NOT NULL,
            user_id INTEGER,
            indices INTEGER NOT NULL DEFAULT 0,
            erreurs INTEGER NOT NULL DEFAULT 0,
            trouve INTEGER NOT NULL DEFAULT 0,
            points INTEGER NOT NULL DEFAULT 0,
            resolu_at TEXT,
            created_at TEXT NOT NULL,
            PRIMARY KEY (date, pseudo)
        );

        CREATE TABLE IF NOT EXISTS season_history (
            user_id INTEGER NOT NULL,
            season TEXT NOT NULL,
            best_points INTEGER NOT NULL,
            best_tier INTEGER NOT NULL,
            final_points INTEGER NOT NULL,
            archived_at TEXT NOT NULL,
            PRIMARY KEY (user_id, season)
        );

        CREATE TABLE IF NOT EXISTS rank_history (
            user_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            points INTEGER NOT NULL,
            PRIMARY KEY (user_id, date)
        );

        CREATE TABLE IF NOT EXISTS duels (
            code TEXT PRIMARY KEY,
            host_pseudo TEXT NOT NULL,
            questions_data TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS duel_players (
            code TEXT NOT NULL,
            pseudo TEXT NOT NULL,
            user_id INTEGER,
            score INTEGER NOT NULL,
            answers TEXT,
            played_at TEXT NOT NULL,
            PRIMARY KEY (code, pseudo)
        );

        CREATE TABLE IF NOT EXISTS arcade_daily (
            date TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            pseudo TEXT NOT NULL,
            mode TEXT NOT NULL,
            score INTEGER NOT NULL,
            PRIMARY KEY (date, user_id, mode)
        );

        CREATE TABLE IF NOT EXISTS arcade_records (
            user_id INTEGER NOT NULL,
            pseudo TEXT NOT NULL,
            mode TEXT NOT NULL,
            score INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY (user_id, mode)
        );

        CREATE TABLE IF NOT EXISTS question_stats (
            question_id INTEGER PRIMARY KEY,
            vues INTEGER NOT NULL DEFAULT 0,
            reussies INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS achievements (
            user_id INTEGER NOT NULL,
            code TEXT NOT NULL,
            unlocked_at TEXT NOT NULL,
            PRIMARY KEY (user_id, code)
        );

        CREATE TABLE IF NOT EXISTS question_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question_id INTEGER NOT NULL,
            pseudo TEXT,
            reason TEXT NOT NULL,
            comment TEXT,
            status TEXT NOT NULL DEFAULT 'ouvert',
            created_at TEXT NOT NULL
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
    # multi (mode retiré). Tables conservées pour ne rien détruire en base.
    # erreur 500 ("no such column: questions_data") sur une base existante.
    existing_room_columns = [row["name"] for row in conn.execute("PRAGMA table_info(multi_rooms)").fetchall()]
    if "questions_data" not in existing_room_columns:
        conn.execute("ALTER TABLE multi_rooms ADD COLUMN questions_data TEXT")
        conn.commit()

    # Migration : date du dernier calcul de la perte quotidienne du mode classé
    # (à partir de Champion III). NULL = jamais calculée encore.
    if "last_decay_date" not in existing_columns:
        conn.execute("ALTER TABLE users ADD COLUMN last_decay_date TEXT")
        conn.commit()

    # Migration : avatar (une expression de visage sur un fond de couleur).
    # Deux colonnes plutôt qu'une chaîne composite : c'est plus simple à lire,
    # à valider et à faire évoluer si on ajoute des visages.
    if "avatar_face" not in existing_columns:
        conn.execute("ALTER TABLE users ADD COLUMN avatar_face INTEGER NOT NULL DEFAULT 0")
        conn.commit()
    if "avatar_color" not in existing_columns:
        conn.execute("ALTER TABLE users ADD COLUMN avatar_color TEXT NOT NULL DEFAULT '#7C4DFF'")
        conn.commit()

    # Migration : sommet atteint pendant la saison en cours, et meilleur rang
    # jamais atteint toutes saisons confondues (pour le palmarès du profil).
    if "peak_points" not in existing_columns:
        conn.execute("ALTER TABLE users ADD COLUMN peak_points INTEGER NOT NULL DEFAULT 0")
        conn.execute("UPDATE users SET peak_points = rank_points")
        conn.commit()
    if "best_tier_ever" not in existing_columns:
        conn.execute("ALTER TABLE users ADD COLUMN best_tier_ever INTEGER NOT NULL DEFAULT 0")
        # On RECALCULE depuis les points, sans recopier l'ancienne colonne
        # rank_tier : celle-ci a été calculée avec un système de rangs antérieur
        # et ne veut plus rien dire. Un joueur à 120 points se serait retrouvé
        # avec un « sommet » de Champion qu'il n'a jamais atteint.
        from app.modes.ranked import rank_config
        for row in conn.execute("SELECT id, rank_points FROM users").fetchall():
            conn.execute(
                "UPDATE users SET best_tier_ever = ? WHERE id = ?",
                (rank_config.tier_from_points(row["rank_points"] or 0), row["id"]),
            )
        conn.commit()

    # Migration : réponses données au défi du jour, pour pouvoir les revoir
    # après retour à l'accueil.
    existing_daily_columns = [row["name"] for row in conn.execute("PRAGMA table_info(daily_attempts)").fetchall()]
    if "answers" not in existing_daily_columns:
        conn.execute("ALTER TABLE daily_attempts ADD COLUMN answers TEXT")
        conn.commit()

    # Ménage : les sessions n'expiraient jamais et s'accumulaient indéfiniment.
    # On supprime celles de plus de 90 jours (le joueur se reconnectera).
    conn.execute("DELETE FROM sessions WHERE created_at < date('now', '-90 days')")
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
        CREATE INDEX IF NOT EXISTS idx_daily_pseudo ON daily_attempts(pseudo);
        CREATE INDEX IF NOT EXISTS idx_enigme_date ON enigme_attempts(date);
        CREATE INDEX IF NOT EXISTS idx_arcade_daily ON arcade_daily(date, mode);
        CREATE INDEX IF NOT EXISTS idx_enigme_pseudo ON enigme_attempts(pseudo);
        CREATE INDEX IF NOT EXISTS idx_achievements_user ON achievements(user_id);
        CREATE INDEX IF NOT EXISTS idx_reports_status ON question_reports(status);
    """)
    conn.commit()
    conn.close()
