import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.core import config
from app.core.db import init_schema, create_indexes
from app.core.backup import run_backup
from app.questions.service import import_questions_from_csv
from app.questions.router import router as questions_router
from app.auth.router import router as auth_router
from app.modes.chill.router import router as chill_router
from app.modes.ranked.router import router as ranked_router
from app.modes.local.router import router as local_router
from app.modes.daily.router import router as daily_router
from app.modes.arcade.router import router as arcade_router
from app.modes.multi.router import router as multi_router
from app.modes.enigme.router import router as enigme_router
from app.modes.admin.router import router as admin_router
from app.modes.admin import service as admin_service
from app.profile.router import router as profile_router

# Sans configuration explicite, les messages du logger "quiz" n'ont aucun
# gestionnaire et disparaissent : les avertissements de démarrage n'auraient
# servi à rien.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("quiz")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Séquence de démarrage.

    `@app.on_event("startup")` est déprécié depuis FastAPI 0.109 et émettait un
    avertissement à chaque lancement ; le gestionnaire de contexte est
    l'équivalent officiel, à comportement identique.

    L'ordre compte :
      1. sauvegarde AVANT toute modification de schéma — si un redéploiement se
         passe mal, on a une copie de l'état d'avant ;
      2. tables persistantes (comptes, parties) : créées si absentes, jamais
         supprimées ;
      3. table `questions` : recréée en entier depuis le CSV ;
      4. index APRÈS l'import, car recréer `questions` détruit les siens ;
      5. bascule de saison si le mois a changé pendant l'arrêt du serveur.
    """
    _verifier_configuration()
    run_backup()
    init_schema()
    import_questions_from_csv()
    create_indexes()
    from app.modes.ranked.season import verifier_et_reinitialiser
    verifier_et_reinitialiser()
    yield


def _verifier_configuration():
    """Journalise franchement les réglages laissés en position « ouverte ».

    Ces deux valeurs par défaut conviennent en local et sont dangereuses en
    ligne. Elles ne bloquent pas le démarrage — un serveur qui refuse de se
    lancer après un redéploiement est pire — mais elles ne doivent plus passer
    inaperçues.
    """
    if config.ADMIN_BOOTSTRAP_SECRET == "change-moi":
        logger.warning(
            "ADMIN_BOOTSTRAP_SECRET est resté à sa valeur par défaut : "
            "n'importe qui peut se promouvoir administrateur. À changer dans Portainer."
        )
    if not os.environ.get("ALLOWED_ORIGINS"):
        logger.warning(
            "ALLOWED_ORIGINS n'est pas renseigné : l'API accepte les requêtes de "
            "n'importe quel site. À renseigner avec le domaine du frontend."
        )


app = FastAPI(title="Quiz API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    # Restreint aux domaines déclarés dans ALLOWED_ORIGINS (séparés par des
    # virgules). Sans cette variable, on reste ouvert — pratique en local, à
    # renseigner sur le VPS (ex: "https://noe.crabdance.com").
    allow_origins=[o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def catch_all_exceptions(request: Request, exc: Exception):
    """Filet de sécurité : toute exception non gérée est transformée en réponse
    500 propre AU LIEU de remonter et potentiellement tuer le worker uvicorn.
    C'était la cause de "erreur 500, obligé de relancer le stack" : une
    exception dans un endpoint faisait
    tomber le process, qui ne se relevait pas. Ici, on journalise et on répond,
    le serveur reste debout."""
    logger.exception("Exception non gérée sur %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Une erreur interne est survenue, réessaie."},
    )


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
app.include_router(daily_router)
app.include_router(arcade_router)
app.include_router(multi_router)
app.include_router(enigme_router)
app.include_router(admin_router)
app.include_router(profile_router)
