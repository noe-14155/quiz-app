from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.auth.router import get_current_user
from app.auth import rate_limit
from app.modes.admin.service import is_mode_enabled
from app.modes.enigme import service
from app.profile.activity import log_event
from app.profile.xp import award_xp

router = APIRouter(prefix="/api/enigme", tags=["enigme"])


def _require_enabled():
    if not is_mode_enabled("mode_enigme_enabled"):
        raise HTTPException(status_code=403, detail="L'énigme du jour est temporairement désactivée")


def _etat(user):
    """État complet pour le joueur : l'énigme, ses indices débloqués, son score.
    La réponse n'est JAMAIS envoyée tant qu'il n'a pas trouvé — sinon elle
    serait lisible dans les outils du navigateur."""
    e = service.enigme_du_jour()
    if not e:
        raise HTTPException(status_code=503, detail="Aucune énigme disponible")
    t = service.tentative(user["pseudo"]) or {}
    indices_vus = t.get("indices", 0)
    trouve = bool(t.get("trouve"))
    return {
        "date": service.today_str(),
        "enigme": e["enigme"],
        "categorie": e["categorie"],
        "difficulte": e["difficulte"],
        "indices": e["indices"][:indices_vus],
        "indices_restants": service.NB_INDICES - indices_vus,
        "forme": service.forme_reponse(e),
        "erreurs": t.get("erreurs", 0),
        "trouve": trouve,
        "points": t.get("points", 0),
        "points_possibles": service.points(indices_vus, t.get("erreurs", 0)),
        "reponse": e["reponse"] if trouve else None,
        "serie": service.serie(user["pseudo"]),
        **service.classement(),
    }


@router.get("/today")
def today(user=Depends(get_current_user)):
    """L'énigme du jour et l'état du joueur."""
    _require_enabled()
    return _etat(user)


@router.post("/indice")
def indice(user=Depends(get_current_user)):
    """Débloque l'indice suivant (et réduit les points possibles)."""
    _require_enabled()
    t = service.tentative(user["pseudo"])
    if t and t.get("trouve"):
        raise HTTPException(status_code=409, detail="Tu as déjà trouvé")
    service.prendre_indice(user["pseudo"], user["id"])
    return _etat(user)


class Proposition(BaseModel):
    reponse: str


@router.post("/repondre")
def repondre(payload: Proposition, request: Request, user=Depends(get_current_user)):
    """Vérifie une proposition. Limité pour éviter le passage en force."""
    _require_enabled()
    rate_limit.check(request, "enigme", maximum=20, fenetre=60)

    t = service.tentative(user["pseudo"])
    if t and t.get("trouve"):
        raise HTTPException(status_code=409, detail="Tu as déjà trouvé")
    if not t:
        log_event("enigme_start", user_id=user["id"], pseudo=user["pseudo"])

    e = service.enigme_du_jour()
    verdict = service.evaluer(e, payload.reponse)  # "juste" | "presque" | "faux"
    juste = verdict == "juste"
    # Une proposition « presque » ne coûte pas d'essai : le joueur a la bonne
    # idée, il l'a seulement mal écrite. Le pénaliser serait injuste.
    apres = service.enregistrer_essai(user["pseudo"], user["id"], juste) if verdict != "presque" \
        else service.tentative(user["pseudo"])

    if juste:
        # L'XP suit les points obtenus, divisés pour rester cohérente avec les
        # autres modes (une énigme parfaite vaut environ deux bonnes réponses
        # difficiles en classé).
        award_xp(user["id"], max(5, (apres or {}).get("points", 0) // 4))

    return {"juste": juste, "verdict": verdict, **_etat(user)}
