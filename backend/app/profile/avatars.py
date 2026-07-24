"""Choix d'avatars disponibles.

Isolé dans son propre module : la migration de base et le routeur de profil en
ont tous deux besoin, et faire dépendre `core.db` de `profile.router` créerait
une boucle d'imports.
"""
import random

NB_VISAGES = 8

COULEURS_AVATAR = [
    "#7C4DFF", "#FF4D9D", "#FF8A3D", "#12B981",
    "#38BDF8", "#F43F5E", "#FFC94D", "#8A93A5",
]


def avatar_aleatoire():
    """Visage et couleur tirés au hasard, pour un nouveau compte."""
    return random.randrange(NB_VISAGES), random.choice(COULEURS_AVATAR)
