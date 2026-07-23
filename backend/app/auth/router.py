from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel

from app.auth import service
from app.auth import rate_limit
from app.profile.activity import log_event

router = APIRouter(prefix="/api/auth", tags=["auth"])


class Credentials(BaseModel):
    pseudo: str
    password: str


@router.post("/register")
def register(payload: Credentials, request: Request):
    # 5 créations de compte par minute et par adresse : large pour un usage
    # normal, bloquant pour un script.
    rate_limit.check(request, "register", maximum=5, fenetre=60)
    pseudo = payload.pseudo.strip()
    if len(pseudo) < 2 or len(pseudo) > 20:
        raise HTTPException(status_code=422, detail="Le pseudo doit faire entre 2 et 20 caractères")
    if len(payload.password) < 6:
        raise HTTPException(status_code=422, detail="Le mot de passe doit faire au moins 6 caractères")
    user_id = service.create_user(pseudo, payload.password)
    if user_id is None:
        raise HTTPException(status_code=409, detail="Ce pseudo est déjà pris")
    token = service.create_session(user_id)
    log_event("register", user_id=user_id, pseudo=pseudo)
    return {"token": token, "pseudo": pseudo}


@router.post("/login")
def login(payload: Credentials, request: Request):
    rate_limit.check(request, "login", maximum=8, fenetre=60)
    user = service.verify_login(payload.pseudo, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Pseudo ou mot de passe incorrect")
    rate_limit.reset("login", request)
    token = service.create_session(user["id"])
    log_event("login", user_id=user["id"], pseudo=user["pseudo"])
    return {"token": token, "pseudo": user["pseudo"]}


def get_current_user(authorization: Optional[str] = Header(None)):
    """Dépendance FastAPI : lève une erreur 401 si non connecté. Utilisée par
    les endpoints qui nécessitent obligatoirement un compte (classé, profil)."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Non connecté")
    token = authorization.removeprefix("Bearer ")
    user = service.get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Session invalide")
    return user


def get_current_user_optional(authorization: Optional[str] = Header(None)):
    """Variante silencieuse : renvoie None au lieu de lever une erreur.
    Utilisée par le mode chill, où la connexion est facultative (les stats ne
    sont enregistrées que si un compte est présent)."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.removeprefix("Bearer ")
    return service.get_user_from_token(token)


def get_current_admin(authorization: Optional[str] = Header(None)):
    """Comme get_current_user, mais exige en plus que le compte soit admin (403 sinon)."""
    user = get_current_user(authorization)
    if not user["is_admin"]:
        raise HTTPException(status_code=403, detail="Réservé aux administrateurs")
    return user
