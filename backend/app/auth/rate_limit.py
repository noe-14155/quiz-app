"""Limitation du nombre de tentatives sur les endpoints sensibles.

Sans ça, rien n'empêche d'essayer des milliers de mots de passe à la suite.
Implémentation volontairement simple : un compteur en mémoire par clé (adresse
IP + endpoint), avec une fenêtre glissante. Pas de dépendance, pas de Redis —
suffisant pour une application de cette taille, où le serveur est unique.

Limite : le compteur est réinitialisé au redémarrage du serveur. Acceptable :
une attaque par force brute dure bien plus longtemps qu'un redéploiement.
"""
import time
from collections import defaultdict
from threading import Lock

from fastapi import HTTPException, Request

_tentatives = defaultdict(list)
_verrou = Lock()


def _nettoyer(cle: str, fenetre: int, maintenant: float):
    _tentatives[cle] = [t for t in _tentatives[cle] if maintenant - t < fenetre]


def check(request: Request, nom: str, maximum: int = 8, fenetre: int = 60):
    """Autorise `maximum` appels par `fenetre` secondes pour cette IP.
    Lève une 429 au-delà. À appeler en début d'endpoint."""
    ip = request.client.host if request.client else "inconnu"
    cle = f"{nom}:{ip}"
    maintenant = time.monotonic()

    with _verrou:
        _nettoyer(cle, fenetre, maintenant)
        if len(_tentatives[cle]) >= maximum:
            attente = int(fenetre - (maintenant - _tentatives[cle][0])) + 1
            raise HTTPException(
                status_code=429,
                detail=f"Trop de tentatives. Réessaie dans {attente} seconde(s).",
            )
        _tentatives[cle].append(maintenant)


def reset(nom: str, request: Request):
    """Remet le compteur à zéro (après une connexion réussie, par exemple)."""
    ip = request.client.host if request.client else "inconnu"
    with _verrou:
        _tentatives.pop(f"{nom}:{ip}", None)
