from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.auth import service
from app.profile.activity import log_event

router = APIRouter(prefix="/api/auth", tags=["auth"])


class Credentials(BaseModel):
    pseudo: str
    password: str


@router.post("/register")
def register(payload: Credentials):
    user_id = service.create_user(payload.pseudo, payload.password)
    if user_id is None:
        raise HTTPException(status_code=409, detail="Ce pseudo est déjà pris")
    token = service.create_session(user_id)
    log_event("register", user_id=user_id, pseudo=payload.pseudo)
    return {"token": token, "pseudo": payload.pseudo}


@router.post("/login")
def login(payload: Credentials):
    user = service.verify_login(payload.pseudo, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Pseudo ou mot de passe incorrect")
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
