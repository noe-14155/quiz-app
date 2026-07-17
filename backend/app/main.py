from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.db import init_schema, create_indexes
from app.questions.service import import_questions_from_csv
from app.questions.router import router as questions_router
from app.auth.router import router as auth_router
from app.modes.chill.router import router as chill_router
from app.modes.ranked.router import router as ranked_router
from app.modes.local.router import router as local_router
from app.modes.multi.router import router as multi_router
from app.modes.admin.router import router as admin_router
from app.modes.admin import service as admin_service
from app.profile.router import router as profile_router

app = FastAPI(title="Quiz API")

# À restreindre à ton propre domaine une fois le frontend en place
# (ex: allow_origins=["https://quiz.87-106-2-201.nip.io"])
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_schema()  # tables persistantes (comptes, parties...) : créées si absentes, jamais supprimées
    import_questions_from_csv()  # table `questions` : recréée en entier depuis le CSV à chaque démarrage
    create_indexes()  # APRÈS l'import : recréer la table `questions` détruit ses index


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/modes/status")
def modes_status():
    """Accessible sans compte : le frontend en a besoin pour tout le monde,
    pour griser les modes désactivés dès l'écran d'accueil."""
    return admin_service.get_modes_status()


# Un mode = un routeur = une ligne ici. Ajouter un mode ne touche à aucun
# des fichiers des autres modes (voir CLAUDE.md, section organisation modulaire).
app.include_router(questions_router)
app.include_router(auth_router)
app.include_router(chill_router)
app.include_router(ranked_router)
app.include_router(local_router)
app.include_router(multi_router)
app.include_router(admin_router)
app.include_router(profile_router)
