from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth.router import get_current_admin
from app.modes.admin import service

router = APIRouter(prefix="/api/admin", tags=["admin"])


class BootstrapPayload(BaseModel):
    pseudo: str
    secret: str


@router.post("/bootstrap")
def bootstrap(payload: BootstrapPayload):
    """À utiliser UNE SEULE FOIS pour créer le tout premier admin, via la page
    /docs. Nécessite le secret défini dans ADMIN_BOOTSTRAP_SECRET (.env /
    variables Portainer) — change cette valeur par défaut avant de l'utiliser."""
    result = service.bootstrap_admin(payload.pseudo, payload.secret)
    if result == "bad_secret":
        return {"ok": False, "detail": "Secret incorrect"}
    if result == "user_not_found":
        return {"ok": False, "detail": "Ce pseudo n'existe pas — crée d'abord le compte via /api/auth/register"}
    return {"ok": True, "detail": f"{payload.pseudo} est maintenant administrateur"}


@router.get("/users")
def get_users(limit: int = 100, offset: int = 0, admin=Depends(get_current_admin)):
    return service.list_users(limit, offset)


@router.post("/users/{user_id}/reset")
def reset_user(user_id: int, admin=Depends(get_current_admin)):
    service.reset_user(user_id)
    return {"ok": True}


@router.delete("/users/{user_id}")
def delete_user(user_id: int, admin=Depends(get_current_admin)):
    service.delete_user(user_id)
    return {"ok": True}


@router.get("/settings")
def get_settings(admin=Depends(get_current_admin)):
    return service.get_settings()


@router.patch("/settings")
def update_settings(patch: dict, admin=Depends(get_current_admin)):
    return service.update_settings(patch)


@router.get("/stats")
def get_stats(admin=Depends(get_current_admin)):
    return service.get_stats()


# Note : le statut public des modes est exposé par /api/modes/status (main.py),
# et l'activation/désactivation se fait via PATCH /api/admin/settings — pas
# besoin d'endpoints dédiés supplémentaires ici.


@router.get("/modes-toggle")
def modes_toggle(admin=Depends(get_current_admin)):
    """Alias pratique pour la page admin : les 4 interrupteurs, sans avoir à
    fouiller dans l'ensemble des réglages."""
    return service.get_modes_status()
