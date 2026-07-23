from fastapi import APIRouter, Depends, HTTPException
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
        raise HTTPException(status_code=403, detail="Secret incorrect")
    if result == "user_not_found":
        raise HTTPException(status_code=404, detail="Ce pseudo n'existe pas — crée d'abord le compte via /api/auth/register")
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


@router.get("/activity")
def get_activity(days: int = 14, admin=Depends(get_current_admin)):
    """Page de suivi : connexions, flux par mode, joueurs, derniers événements."""
    return service.get_activity(days=days)


# Note : le statut public des modes est exposé par /api/modes/status (main.py),
# et l'activation/désactivation se fait via PATCH /api/admin/settings — pas
# besoin d'endpoints dédiés supplémentaires ici.


@router.get("/modes-toggle")
def modes_toggle(admin=Depends(get_current_admin)):
    """Alias pratique pour la page admin : les 4 interrupteurs, sans avoir à
    fouiller dans l'ensemble des réglages."""
    return service.get_modes_status()


@router.get("/reports")
def get_reports(status: str = "ouvert", admin=Depends(get_current_admin)):
    """Questions signalées par les joueurs, avec leur contenu pour arbitrer."""
    return service.list_reports(status=status)


@router.post("/reports/{report_id}/resolve")
def resolve_report(report_id: int, admin=Depends(get_current_admin)):
    return service.resolve_report(report_id)


class PasswordPayload(BaseModel):
    password: str


@router.post("/users/{user_id}/password")
def set_password(user_id: int, payload: PasswordPayload, admin=Depends(get_current_admin)):
    """Réinitialise le mot de passe d'un joueur bloqué. Déconnecte ses sessions."""
    if len(payload.password) < 6:
        raise HTTPException(status_code=422, detail="Le mot de passe doit faire au moins 6 caractères")
    return service.set_user_password(user_id, payload.password)


@router.get("/backups")
def get_backups(admin=Depends(get_current_admin)):
    """Sauvegardes automatiques présentes sur le serveur."""
    from app.core.backup import list_backups
    return {"backups": list_backups()}
