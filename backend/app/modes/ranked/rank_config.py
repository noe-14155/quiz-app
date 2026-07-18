"""Configuration du mode classé.

Système de progression :
- Rangs : Fer, Bronze, Argent, Or, Diamant, Légende, puis Unreal (sommet, illimité).
- Chaque rang normal = 3 paliers (III, II, I). Points par palier = réglable (défaut 200).
- Unreal commence après Légende I et n'a pas de plafond.
- Gain dégressif / malus croissant : une courbe interpolée entre une borne "bas
  de classement" et une borne "haut de classement", toutes deux réglables depuis
  l'administration.
- Passer une question est interdit à partir de Diamant.
- Perte quotidienne : à partir de Diamant III, on perd N points par jour (réglable),
  avec un plancher au début de Diamant III.

Les valeurs réglables sont passées via un dict `cfg` (issu des réglages admin).
Sans `cfg`, on retombe sur les valeurs par défaut ci-dessous — utile pour les
tests et pour ne jamais planter si un réglage manque.
"""

RANKS = ["Fer", "Bronze", "Argent", "Or", "Diamant", "Légende"]
PALIER_LABELS = ["III", "II", "I"]
TIERS_PER_RANK = 3
NORMAL_TIERS = len(RANKS) * TIERS_PER_RANK  # 18 (tiers 0..17)
UNREAL_TIER = NORMAL_TIERS                   # 18+
DIAMANT_RANK_INDEX = RANKS.index("Diamant")  # 4
DIAMANT_TIER = DIAMANT_RANK_INDEX * TIERS_PER_RANK  # 12
NB_QUESTIONS_PER_PARTY = 10

# Valeurs par défaut (doivent rester alignées avec DEFAULT_SETTINGS côté admin).
DEFAULTS = {
    "points_per_tier": 200,
    "gain_low": 25,
    "gain_high": 6,
    "loss_low": 6,
    "loss_high": 22,
    "loss_pass": 3,
    "daily_decay": 50,
}


def _v(cfg, key):
    """Lit une valeur du dict cfg (réglages admin) avec repli sur DEFAULTS."""
    if cfg is None:
        return DEFAULTS[key]
    raw = cfg.get(f"ranked_{key}")
    if raw is None:
        return DEFAULTS[key]
    try:
        return int(raw)
    except (TypeError, ValueError):
        return DEFAULTS[key]


def points_per_tier(cfg=None) -> int:
    return max(1, _v(cfg, "points_per_tier"))


def diamant_floor_points(cfg=None) -> int:
    """Seuil d'entrée dans Diamant III, recalculé selon points_per_tier."""
    return DIAMANT_TIER * points_per_tier(cfg)


def tier_from_points(rank_points: int, cfg=None) -> int:
    """Tier (0 = Fer III … 17 = Légende I, 18+ = Unreal). Non plafonné."""
    return rank_points // points_per_tier(cfg)


def is_unreal(rank_points: int, cfg=None) -> bool:
    return tier_from_points(rank_points, cfg) >= UNREAL_TIER


def progress_in_tier(rank_points: int, cfg=None) -> int:
    """Progression (0 à 99 %) vers le palier suivant."""
    ppt = points_per_tier(cfg)
    return round((rank_points % ppt) / ppt * 100)


def tier_info(rank_points: int, cfg=None):
    """Rang + palier affichés. Unreal a un numéro croissant (1, 2, …)."""
    tier = tier_from_points(rank_points, cfg)
    if tier >= UNREAL_TIER:
        return {"rank": "Unreal", "palier": str(tier - UNREAL_TIER + 1), "tier": tier, "unreal": True}
    return {"rank": RANKS[tier // TIERS_PER_RANK], "palier": PALIER_LABELS[tier % TIERS_PER_RANK], "tier": tier, "unreal": False}


def can_pass(rank_points: int, cfg=None) -> bool:
    """Passer est interdit à partir de Diamant (III et au-dessus)."""
    return tier_from_points(rank_points, cfg) < DIAMANT_TIER


def gain_for_tier(tier: int, cfg=None) -> int:
    """Gain d'une bonne réponse, dégressif. Interpolé de gain_low (Fer III) à
    gain_high (Légende I), puis figé à gain_high en Unreal."""
    low, high = _v(cfg, "gain_low"), _v(cfg, "gain_high")
    if tier >= UNREAL_TIER:
        return high
    f = tier / (NORMAL_TIERS - 1)
    return round(low + (high - low) * f)


def loss_for_tier(tier: int, cfg=None) -> int:
    """Malus d'une mauvaise réponse, croissant. Interpolé de loss_low (Fer III)
    à loss_high (Légende I), puis +3 par niveau d'Unreal, sans plafond."""
    low, high = _v(cfg, "loss_low"), _v(cfg, "loss_high")
    if tier >= UNREAL_TIER:
        return high + (tier - UNREAL_TIER + 1) * 3
    f = tier / (NORMAL_TIERS - 1)
    return round(low + (high - low) * f)


def loss_for_pass(tier: int, cfg=None) -> int:
    """Coût d'un « passer » (uniquement sous Diamant, où c'est permis)."""
    return _v(cfg, "loss_pass")


def weights_for_tier(tier: int, cfg=None):
    """Distribution de difficulté (1 à 5) : facile en bas, dur en haut.
    Plafonnée au profil de Légende I une fois dans Unreal."""
    t = min(tier, NORMAL_TIERS - 1)
    f = t / (NORMAL_TIERS - 1)
    low = [45, 30, 15, 7, 3]
    high = [3, 7, 15, 30, 45]
    return [round(l + (h - l) * f) for l, h in zip(low, high)]


def apply_delta(rank_points: int, delta: int) -> int:
    """Applique un delta au cumul, jamais négatif."""
    return max(0, rank_points + delta)


def daily_decay(rank_points: int, days: int, cfg=None) -> int:
    """Cumul après `days` jours de perte quotidienne. N'agit qu'à partir de
    Diamant III, plancher au début de Diamant III."""
    floor = diamant_floor_points(cfg)
    if days <= 0 or rank_points < floor:
        return rank_points
    decayed = rank_points - _v(cfg, "daily_decay") * days
    return max(floor, decayed)


def full_scale(cfg=None):
    """Tableau complet du barème par rang, pour l'affichage joueur.
    Un point représentatif par rang (le palier III, entrée du rang) + Unreal 1."""
    rows = []
    for rank_index, rank_name in enumerate(RANKS):
        tier = rank_index * TIERS_PER_RANK
        pts = tier * points_per_tier(cfg)
        rows.append({
            "rank": rank_name,
            "points": pts,
            "gain": gain_for_tier(tier, cfg),
            "loss": loss_for_tier(tier, cfg),
            "can_pass": can_pass(pts, cfg),
        })
    # Unreal 1
    tier = UNREAL_TIER
    pts = tier * points_per_tier(cfg)
    rows.append({
        "rank": "Unreal",
        "points": pts,
        "gain": gain_for_tier(tier, cfg),
        "loss": loss_for_tier(tier, cfg),
        "can_pass": can_pass(pts, cfg),
    })
    return rows
