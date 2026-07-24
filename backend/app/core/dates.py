"""Référence temporelle unique du projet.

Avant ce module, trois horloges cohabitaient : l'UTC (défi du jour, énigme),
`date('now')` de SQLite (arcade, relevés — également en UTC) et l'heure locale
du conteneur (saisons, perte quotidienne). Conséquence : entre minuit et 2 h du
matin heure de Paris, une partie n'était pas rattachée au même jour selon le
mode. Le défi du jour changeait à 2 h du matin en été, ce qui n'a de sens pour
personne.

Tout ce qui a besoin d'une notion de « jour » passe désormais par ici. Le
fuseau est configurable (`APP_TIMEZONE`), Paris par défaut : le public de
l'application est français.

Note : les horodatages techniques (création de compte, de session, journal)
restent en UTC — ce sont des instants, pas des jours, et l'UTC est la bonne
convention pour les stocker.
"""
import os
from datetime import date, datetime, timezone

FUSEAU_NOM = os.environ.get("APP_TIMEZONE", "Europe/Paris")

try:
    from zoneinfo import ZoneInfo

    FUSEAU = ZoneInfo(FUSEAU_NOM)
except Exception:  # base de fuseaux absente de l'image : repli sur l'UTC
    FUSEAU = timezone.utc


def maintenant() -> datetime:
    """Instant présent dans le fuseau de l'application."""
    return datetime.now(FUSEAU)


def aujourdhui() -> date:
    """Date du jour telle que la voit un joueur."""
    return maintenant().date()


def aujourdhui_str() -> str:
    """Date du jour au format AAAA-MM-JJ (clé des tables quotidiennes)."""
    return aujourdhui().isoformat()


def horodatage() -> str:
    """Horodatage technique, en UTC (création, journal, historique)."""
    return datetime.now(timezone.utc).isoformat()
