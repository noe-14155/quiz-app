#!/usr/bin/env python3
"""Restaure une sauvegarde de la base.

À lancer DANS le conteneur backend, depuis Portainer (Console) :

    python restaurer_sauvegarde.py               # liste les sauvegardes
    python restaurer_sauvegarde.py 2026-07-22    # restaure celle de cette date

La base actuelle est d'abord copiée en `quiz-avant-restauration.db`, pour que
l'opération reste réversible même en cas d'erreur de date.
"""
import os
import shutil
import sys
from datetime import datetime

DATA_DIR = os.environ.get("DATA_DIR", "/app/data")
DB_PATH = os.path.join(DATA_DIR, "quiz.db")
BACKUP_DIR = os.path.join(DATA_DIR, "backups")


def lister():
    if not os.path.isdir(BACKUP_DIR):
        print("Aucun dossier de sauvegarde. Le serveur en crée une à chaque démarrage.")
        return []
    fichiers = sorted((f for f in os.listdir(BACKUP_DIR)
                       if f.startswith("quiz-") and f.endswith(".db")), reverse=True)
    if not fichiers:
        print("Aucune sauvegarde trouvée.")
        return []
    print(f"Sauvegardes disponibles dans {BACKUP_DIR} :\n")
    for f in fichiers:
        chemin = os.path.join(BACKUP_DIR, f)
        taille = os.path.getsize(chemin) / 1024
        modif = datetime.fromtimestamp(os.path.getmtime(chemin)).strftime("%d/%m/%Y %H:%M")
        print(f"  {f[5:-3]}   {taille:7.0f} Ko   (créée le {modif})")
    print("\nPour restaurer :  python restaurer_sauvegarde.py AAAA-MM-JJ")
    return fichiers


def restaurer(jour: str):
    source = os.path.join(BACKUP_DIR, f"quiz-{jour}.db")
    if not os.path.exists(source):
        print(f"Sauvegarde introuvable pour le {jour}.")
        lister()
        return 1

    if os.path.exists(DB_PATH):
        filet = os.path.join(DATA_DIR, "quiz-avant-restauration.db")
        shutil.copy2(DB_PATH, filet)
        print(f"Base actuelle sauvegardée dans {filet}")

    shutil.copy2(source, DB_PATH)
    # Les fichiers annexes du mode WAL doivent disparaître, sinon SQLite
    # rejouerait un journal qui ne correspond plus à la base restaurée.
    for annexe in (DB_PATH + "-wal", DB_PATH + "-shm"):
        if os.path.exists(annexe):
            os.remove(annexe)

    print(f"Base restaurée depuis la sauvegarde du {jour}.")
    print("Redémarre le conteneur backend pour que le changement soit pris en compte.")
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        lister()
    else:
        sys.exit(restaurer(sys.argv[1]))
