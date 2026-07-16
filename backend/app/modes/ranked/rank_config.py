RANKS = ["Fer", "Bronze", "Argent", "Or", "Diamant", "Légende"]
PALIER_LABELS = ["III", "II", "I"]
MAX_TIER = len(RANKS) * 3 - 1  # 17
POINTS_PER_TIER = 100

GAIN_CORRECT = 12
LOSS_PASS = 3
NB_QUESTIONS_PER_PARTY = 10


def tier_from_points(rank_points: int) -> int:
    """Le rang se déduit directement du cumul de points — un seul nombre fait
    à la fois foi pour le badge affiché ET pour comparer deux joueurs entre
    eux (ex: 550 points > 480 points, sans ambiguïté de palier)."""
    return min(MAX_TIER, rank_points // POINTS_PER_TIER)


def progress_in_tier(rank_points: int) -> int:
    """Progression (0 à 99) vers le palier suivant, pour la barre affichée."""
    tier = tier_from_points(rank_points)
    if tier >= MAX_TIER:
        # Au rang maximum, on ne peut plus monter de palier : on affiche une
        # barre pleine, mais le cumul continue lui de grimper pour la comparaison.
        return 99
    return rank_points % POINTS_PER_TIER


def tier_info(rank_points: int):
    tier = tier_from_points(rank_points)
    return {"rank": RANKS[tier // 3], "palier": PALIER_LABELS[tier % 3], "tier": tier}


def weights_for_tier(tier: int):
    """Distribution de difficulté (1 à 5) pondérée selon le tier du joueur :
    plus de questions faciles en bas de classement, plus de difficiles en haut."""
    f = tier / MAX_TIER
    low = [45, 30, 15, 7, 3]
    high = [3, 7, 15, 30, 45]
    return [round(l + (h - l) * f) for l, h in zip(low, high)]


def loss_for_tier(tier: int) -> int:
    """Le malus d'une mauvaise réponse augmente avec le rang (6 à 20 points)."""
    return 6 + round((tier / MAX_TIER) * 14)


def apply_delta(rank_points: int, delta: int) -> int:
    """Applique un delta au cumul de points, jamais négatif. Plus besoin de
    gérer la promotion/rétrogradation à la main : le rang se déduit toujours
    du cumul via tier_from_points()."""
    return max(0, rank_points + delta)
