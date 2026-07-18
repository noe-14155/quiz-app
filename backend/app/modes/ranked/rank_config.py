"""Configuration du mode classé.

Système de progression :
- Rangs : Fer, Bronze, Argent, Or, Diamant, Légende, puis Unreal (sommet, illimité).
- Chaque rang normal = 3 paliers (III, II, I) de 200 points = 600 points par rang.
- Unreal commence après Légende I et n'a pas de plafond : le cumul continue de
  grimper indéfiniment, mais gagner devient très dur et perdre coûte très cher.
- Gain dégressif : on gagne beaucoup en bas de classement, de moins en moins haut.
- Malus croissant : une mauvaise réponse coûte de plus en plus cher en montant,
  sans plafond dans Unreal.
- Passer une question est interdit à partir de Diamant.
- Perte quotidienne : à partir de Diamant III, on perd 50 points par jour
  d'inactivité relative (voir daily_decay), avec un plancher au début de
  Diamant III (ne fait jamais retomber sous Diamant).
"""

RANKS = ["Fer", "Bronze", "Argent", "Or", "Diamant", "Légende"]
PALIER_LABELS = ["III", "II", "I"]
POINTS_PER_TIER = 200
TIERS_PER_RANK = 3

# Nombre de tiers "normaux" (Fer III → Légende I) = 6 rangs × 3 = 18 (tiers 0..17).
NORMAL_TIERS = len(RANKS) * TIERS_PER_RANK  # 18
# Le tier 18 et au-delà = Unreal.
UNREAL_TIER = NORMAL_TIERS  # 18

# Seuil d'entrée dans Diamant III (5e rang = index 4, premier de ses paliers).
# tier de Diamant III = 4 rangs complets avant × 3 = 12.
DIAMANT_TIER = RANKS.index("Diamant") * TIERS_PER_RANK  # 12
DIAMANT_FLOOR_POINTS = DIAMANT_TIER * POINTS_PER_TIER    # 2400

NB_QUESTIONS_PER_PARTY = 10
DAILY_DECAY = 50  # points perdus par jour à partir de Diamant III


def tier_from_points(rank_points: int) -> int:
    """Tier (0 = Fer III, 17 = Légende I, 18+ = Unreal). Non plafonné : au-delà
    de Légende I, le tier continue d'augmenter (Unreal), ce qui permet de monter
    indéfiniment."""
    return rank_points // POINTS_PER_TIER


def is_unreal(rank_points: int) -> bool:
    return tier_from_points(rank_points) >= UNREAL_TIER


def progress_in_tier(rank_points: int) -> int:
    """Progression (0 à 99, en pourcentage) vers le palier suivant."""
    return round((rank_points % POINTS_PER_TIER) / POINTS_PER_TIER * 100)


def tier_info(rank_points: int):
    """Rang + palier affichés. Unreal a son propre libellé et un numéro de
    niveau croissant (Unreal 1, Unreal 2, …) au lieu des paliers III/II/I."""
    tier = tier_from_points(rank_points)
    if tier >= UNREAL_TIER:
        unreal_level = tier - UNREAL_TIER + 1
        return {"rank": "Unreal", "palier": str(unreal_level), "tier": tier, "unreal": True}
    return {"rank": RANKS[tier // TIERS_PER_RANK], "palier": PALIER_LABELS[tier % TIERS_PER_RANK], "tier": tier, "unreal": False}


def can_pass(rank_points: int) -> bool:
    """Passer une question est interdit à partir de Diamant (III et au-dessus)."""
    return tier_from_points(rank_points) < DIAMANT_TIER


def gain_for_tier(tier: int) -> int:
    """Gain d'une bonne réponse, DÉGRESSIF avec le rang.
    Fer : ~25 points ; ça descend régulièrement ; Unreal : plancher à 5.
    (Le barème admin ranked_gain_correct sert de valeur de référence au tier 0
    via le facteur ci-dessous, pour rester réglable.)"""
    # De 25 (tier 0) à 6 (Légende I, tier 17), puis plancher 5 dans Unreal.
    if tier >= UNREAL_TIER:
        return 5
    start, end = 25, 6
    f = tier / (NORMAL_TIERS - 1)
    return round(start + (end - start) * f)


def loss_for_tier(tier: int) -> int:
    """Malus d'une mauvaise réponse, CROISSANT avec le rang, SANS plafond dans
    Unreal. Fer : 6 ; Légende I : 22 ; puis +3 par niveau d'Unreal."""
    if tier >= UNREAL_TIER:
        base = 22
        return base + (tier - UNREAL_TIER + 1) * 3
    start, end = 6, 22
    f = tier / (NORMAL_TIERS - 1)
    return round(start + (end - start) * f)


def loss_for_pass(tier: int) -> int:
    """Coût d'un « passer ». Interdit à partir de Diamant (géré en amont par
    can_pass), donc cette valeur ne concerne que les rangs sous Diamant."""
    return 3


def weights_for_tier(tier: int):
    """Distribution de difficulté (1 à 5) selon le tier : facile en bas, dur en
    haut. Plafonnée au profil de Légende I une fois dans Unreal (pas plus dur
    au-delà, faute de questions encore plus difficiles)."""
    t = min(tier, NORMAL_TIERS - 1)
    f = t / (NORMAL_TIERS - 1)
    low = [45, 30, 15, 7, 3]
    high = [3, 7, 15, 30, 45]
    return [round(l + (h - l) * f) for l, h in zip(low, high)]


def apply_delta(rank_points: int, delta: int) -> int:
    """Applique un delta au cumul, jamais négatif."""
    return max(0, rank_points + delta)


def daily_decay(rank_points: int, days: int) -> int:
    """Retourne le nouveau cumul après `days` jours de perte quotidienne.
    N'agit qu'à partir de Diamant III, et ne descend jamais sous le plancher de
    Diamant III (2400). En dessous de Diamant, aucune perte."""
    if days <= 0 or rank_points < DIAMANT_FLOOR_POINTS:
        return rank_points
    decayed = rank_points - DAILY_DECAY * days
    return max(DIAMANT_FLOOR_POINTS, decayed)
