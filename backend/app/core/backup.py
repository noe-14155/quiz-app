"""Sauvegarde automatique de la base.

Une copie datée de `quiz.db` est déposée dans `DATA_DIR/backups/` au démarrage
du serveur, au maximum une fois par jour. Les sauvegardes de plus de N jours
sont supprimées pour ne pas remplir le disque.

Pourquoi au démarrage plutôt qu'une tâche planifiée : aucune dépendance, aucun
cron à configurer sur le VPS, et un redéploiement (le moment le plus risqué)
déclenche justement une sauvegarde juste avant que quoi que ce soit ne change.

La copie utilise l'API de sauvegarde de SQLite, qui gère proprement une base en
cours d'utilisation (contrairement à une copie de fichier brute).
"""
import os
import sqlite3
from datetime import datetime, timedelta

from app.core.config import DATA_DIR, DB_PATH

RETENTION_JOURS = 7


def backup_dir():
    return os.path.join(DATA_DIR, "backups")


def run_backup(retention_jours: int = RETENTION_JOURS):
    """Crée une sauvegarde du jour si elle n'existe pas déjà, puis fait le
    ménage. Ne lève jamais : une sauvegarde ratée ne doit pas empêcher le
    serveur de démarrer."""
    try:
        if not os.path.exists(DB_PATH):
            return None  # première exécution, rien à sauvegarder

        dossier = backup_dir()
        os.makedirs(dossier, exist_ok=True)

        nom = f"quiz-{datetime.now().strftime('%Y-%m-%d')}.db"
        cible = os.path.join(dossier, nom)

        if not os.path.exists(cible):
            source = sqlite3.connect(DB_PATH)
            dest = sqlite3.connect(cible)
            with dest:
                source.backup(dest)  # cohérent même si la base est utilisée
            dest.close()
            source.close()

        _nettoyer(dossier, retention_jours)
        return cible
    except Exception:
        return None


def _nettoyer(dossier: str, retention_jours: int):
    """Supprime les sauvegardes plus vieilles que la rétention."""
    limite = datetime.now() - timedelta(days=retention_jours)
    for f in os.listdir(dossier):
        if not (f.startswith("quiz-") and f.endswith(".db")):
            continue
        try:
            jour = datetime.strptime(f[5:-3], "%Y-%m-%d")
            if jour < limite:
                os.remove(os.path.join(dossier, f))
        except Exception:
            continue


def list_backups():
    """Liste des sauvegardes présentes, la plus récente en premier."""
    dossier = backup_dir()
    if not os.path.isdir(dossier):
        return []
    out = []
    for f in sorted(os.listdir(dossier), reverse=True):
        if f.startswith("quiz-") and f.endswith(".db"):
            chemin = os.path.join(dossier, f)
            out.append({
                "nom": f,
                "date": f[5:-3],
                "taille_ko": round(os.path.getsize(chemin) / 1024),
            })
    return out
