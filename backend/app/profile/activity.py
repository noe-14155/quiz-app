"""Journal d'activité interne.

Remplace le besoin d'un outil de suivi externe (type Umami) pour ce projet :
- pas de problème de contenu mixte HTTP/HTTPS,
- pas de sous-domaine ni de service supplémentaire à maintenir,
- fonctionne malgré l'application à écran unique (l'URL ne change jamais, donc
  un traqueur de pages vues classique ne verrait qu'une seule visite),
- et surtout : l'activité est reliée à de vrais comptes, ce qu'un traqueur
  anonyme ne permet pas.

Volontairement minimal : aucune IP, aucune empreinte navigateur.
"""
from datetime import datetime, timezone

from app.core.db import get_connection

# Événements connus, pour garder la page de suivi lisible.
EVENTS = {
    "login": "Connexion",
    "register": "Inscription",
    "chill_start": "Partie chill",
    "ranked_start": "Partie classée",
    "local_start": "Partie locale",
    "multi_create": "Partie multi créée",
    "daily_start": "Défi du jour",
}


def log_event(event: str, user_id=None, pseudo=None):
    """Journalise un événement. Ne doit JAMAIS faire échouer la requête
    appelante : le suivi est secondaire par rapport au jeu."""
    try:
        conn = get_connection()
        conn.execute(
            "INSERT INTO activity_log (user_id, pseudo, event, created_at) VALUES (?,?,?,?)",
            (user_id, pseudo, event, datetime.now(timezone.utc).isoformat()),
        )
        conn.commit()
        conn.close()
    except Exception:
        pass
