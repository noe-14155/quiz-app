RANKS = ["Fer", "Bronze", "Argent", "Or", "Diamant", "Légende"]
PALIER_LABELS = ["III", "II", "I"]
MAX_TIER = len(RANKS) * 3 - 1  # 17

GAIN_CORRECT = 12
LOSS_PASS = 3
NB_QUESTIONS_PER_PARTY = 10


def tier_info(tier: int):
    return {"rank": RANKS[tier // 3], "palier": PALIER_LABELS[tier % 3]}


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


def apply_delta(tier: int, points: int, delta: int):
    """Applique un delta de points et gère la promotion/rétrogradation de palier."""
    new_points = points + delta
    new_tier = tier
    while new_points >= 100 and new_tier < MAX_TIER:
        new_points -= 100
        new_tier += 1
    while new_points < 0 and new_tier > 0:
        new_points += 100
        new_tier -= 1
    new_points = max(0, min(99, new_points))
    return new_tier, new_points
