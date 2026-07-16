import os

DATA_DIR = os.environ.get("DATA_DIR", "/app/data")
DB_PATH = os.path.join(DATA_DIR, "quiz.db")

# Le CSV est intégré à l'image Docker via GitHub (voir seed_data/ et le
# Dockerfile), pas monté depuis le VPS — solution en attendant que FileZilla
# soit en place. Une mise à jour des questions demande alors de repasser par
# GitHub + "Pull and redeploy" plutôt qu'un simple redémarrage du conteneur.
CSV_PATH = os.environ.get("CSV_PATH", "/app/seed_data/questions.csv")

# Secret à usage unique pour promouvoir le tout premier compte admin
# (voir modes/admin/router.py, endpoint /api/admin/bootstrap).
# Change cette valeur par défaut dans .env / les variables Portainer.
ADMIN_BOOTSTRAP_SECRET = os.environ.get("ADMIN_BOOTSTRAP_SECRET", "change-moi")
