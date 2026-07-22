"""Configuration du mode classé.

Système de progression :
- 6 rangs : Neurone → Curieux → Malin → Grosse Tête → Génie → Prodige.
- Chaque rang couvre une plage de points propre (plages IRRÉGULIÈRES, voir
  RANK_RANGES) et se découpe en 3 paliers réguliers (III, II, I).
  Le nombre total de paliers reste donc 18 (tiers 0 à 17), ce qui permet de
  conserver la courbe de gain/malus indexée sur le tier.
- Prodige est le rang sommet : au-delà de Prodige I les points continuent de
  monter, le rang reste Prodige I (le classement départage sur les points).
- Gain dégressif / malus croissant : courbe interpolée entre une borne "bas de
  classement" et une borne "haut de classement", réglables depuis l'admin.
- Passer une question est interdit à partir de Génie (5e rang).
- Perte quotidienne : à partir de Génie III, N points par jour (réglable), avec
  plancher au début de Génie III.
"""

# (nom, point de départ, dernier point du rang ; None = illimité)
RANK_RANGES = [
    ("Neurone", 0, 199),
    ("Curieux", 200, 499),
    ("Malin", 500, 999),
    ("Grosse Tête", 1000, 1499),
    ("Génie", 1500, 2999),
    ("Prodige", 3000, None),
]

RANKS = [r[0] for r in RANK_RANGES]
PALIER_LABELS = ["III", "II", "I"]
TIERS_PER_RANK = 3
NORMAL_TIERS = len(RANKS) * TIERS_PER_RANK  # 18 (tiers 0..17)

# Largeur retenue pour le rang sommet (illimité) : celle du rang précédent.
_TOP_SPAN = 1500


def _build_tier_starts():
    """Point d'entrée de chaque palier, du plus bas au plus haut (18 valeurs).
    Chaque rang est découpé en 3 parts égales de sa propre plage."""
    starts = []
    for _, lo, hi in RANK_RANGES:
        span = (hi - lo + 1) if hi is not None else _TOP_SPAN
        for i in range(TIERS_PER_RANK):
            starts.append(lo + round(span * i / TIERS_PER_RANK))
    return starts


TIER_STARTS = _build_tier_starts()

# Rang à partir duquel « passer » est interdit et la perte quotidienne s'applique.
LOCK_RANK_INDEX = RANKS.index("Génie")            # 4
LOCK_TIER = LOCK_RANK_INDEX * TIERS_PER_RANK       # 12
DECAY_FLOOR_POINTS = TIER_STARTS[LOCK_TIER]        # 1500 (début de Génie III)

NB_QUESTIONS_PER_PARTY = 10

# Valeurs par défaut (alignées avec DEFAULT_SETTINGS côté admin).
DEFAULTS = {
    "gain_low": 25,
    "gain_high": 6,
    "loss_low": 6,
    "loss_high": 22,
    "loss_pass": 3,
    "daily_decay": 50,
}


def _v(cfg, key):
    """Lit une valeur des réglages admin, avec repli sur DEFAULTS."""
    if cfg is None:
        return DEFAULTS[key]
    raw = cfg.get(f"ranked_{key}")
    if raw is None:
        return DEFAULTS[key]
    try:
        return int(raw)
    except (TypeError, ValueError):
        return DEFAULTS[key]


def tier_from_points(rank_points: int, cfg=None) -> int:
    """Tier (0 = Neurone III … 17 = Prodige I). Plafonné à 17 : au-delà, les
    points montent mais le rang reste Prodige I."""
    tier = 0
    for i, start in enumerate(TIER_STARTS):
        if rank_points >= start:
            tier = i
        else:
            break
    return tier


def tier_info(rank_points: int, cfg=None):
    """Rang et palier affichés."""
    tier = tier_from_points(rank_points, cfg)
    return {
        "rank": RANKS[tier // TIERS_PER_RANK],
        "palier": PALIER_LABELS[tier % TIERS_PER_RANK],
        "tier": tier,
        "unreal": False,  # conservé pour compatibilité avec l'ancien format
    }


def progress_in_tier(rank_points: int, cfg=None) -> int:
    """Progression (0 à 99 %) vers le palier suivant."""
    tier = tier_from_points(rank_points, cfg)
    start = TIER_STARTS[tier]
    if tier + 1 < len(TIER_STARTS):
        end = TIER_STARTS[tier + 1]
    else:
        end = start + _TOP_SPAN // TIERS_PER_RANK  # dernier palier : largeur du sommet
    span = max(1, end - start)
    return max(0, min(99, round((rank_points - start) / span * 100)))


def points_per_tier(cfg=None) -> int:
    """Largeur du palier courant — conservé pour compatibilité d'affichage.
    Les paliers n'ayant plus tous la même largeur, on renvoie celle du rang
    médian (Malin/Grosse Tête)."""
    return round(500 / TIERS_PER_RANK)


def diamant_floor_points(cfg=None) -> int:
    """Plancher de la perte quotidienne (début de Génie III)."""
    return DECAY_FLOOR_POINTS


def is_unreal(rank_points: int, cfg=None) -> bool:
    """Conservé pour compatibilité : il n'y a plus de rang « au-delà »."""
    return False


def can_pass(rank_points: int, cfg=None) -> bool:
    """Passer est interdit à partir de Génie (III et au-dessus)."""
    return tier_from_points(rank_points, cfg) < LOCK_TIER


def gain_for_tier(tier: int, cfg=None) -> int:
    """Gain d'une bonne réponse, dégressif de gain_low (Neurone III) à
    gain_high (Prodige I)."""
    low, high = _v(cfg, "gain_low"), _v(cfg, "gain_high")
    t = min(max(tier, 0), NORMAL_TIERS - 1)
    f = t / (NORMAL_TIERS - 1)
    return round(low + (high - low) * f)


def loss_for_tier(tier: int, cfg=None) -> int:
    """Malus d'une mauvaise réponse, croissant de loss_low à loss_high."""
    low, high = _v(cfg, "loss_low"), _v(cfg, "loss_high")
    t = min(max(tier, 0), NORMAL_TIERS - 1)
    f = t / (NORMAL_TIERS - 1)
    return round(low + (high - low) * f)


def loss_for_pass(tier: int, cfg=None) -> int:
    """Coût d'un « passer » (uniquement sous Génie, où c'est permis)."""
    return _v(cfg, "loss_pass")


def weights_for_tier(tier: int, cfg=None):
    """Distribution de difficulté (1 à 5) : facile en bas, dur en haut."""
    t = min(max(tier, 0), NORMAL_TIERS - 1)
    f = t / (NORMAL_TIERS - 1)
    low = [45, 30, 15, 7, 3]
    high = [3, 7, 15, 30, 45]
    return [round(l + (h - l) * f) for l, h in zip(low, high)]


def apply_delta(rank_points: int, delta: int) -> int:
    """Applique un delta au cumul, jamais négatif."""
    return max(0, rank_points + delta)


def daily_decay(rank_points: int, days: int, cfg=None) -> int:
    """Cumul après `days` jours de perte quotidienne. N'agit qu'à partir de
    Génie III, sans jamais descendre sous ce seuil."""
    floor = diamant_floor_points(cfg)
    if days <= 0 or rank_points < floor:
        return rank_points
    return max(floor, rank_points - _v(cfg, "daily_decay") * days)


def full_scale(cfg=None):
    """Barème par rang, pour l'affichage joueur (une ligne par rang, prise à son
    palier d'entrée)."""
    rows = []
    for rank_index, (name, lo, hi) in enumerate(RANK_RANGES):
        tier = rank_index * TIERS_PER_RANK
        rows.append({
            "rank": name,
            "points": lo,
            "points_max": hi,
            "gain": gain_for_tier(tier, cfg),
            "loss": loss_for_tier(tier, cfg),
            "can_pass": can_pass(lo, cfg),
        })
    return rows


def next_rank(rank_points: int, cfg=None):
    """Rang suivant et points restants pour l'atteindre. None si déjà au sommet."""
    idx = tier_from_points(rank_points, cfg) // TIERS_PER_RANK
    if idx + 1 >= len(RANK_RANGES):
        return None
    name, lo, _ = RANK_RANGES[idx + 1]
    return {"rank": name, "at": lo, "remaining": max(0, lo - rank_points)}


def rank_progress(rank_points: int, cfg=None) -> int:
    """Progression (0-100 %) à l'intérieur du RANG courant (et non du palier),
    pour la barre de la carte « Rang actuel »."""
    idx = tier_from_points(rank_points, cfg) // TIERS_PER_RANK
    _, lo, hi = RANK_RANGES[idx]
    if hi is None:
        return 100
    span = max(1, hi - lo + 1)
    return max(0, min(100, round((rank_points - lo) / span * 100)))


def ladder(rank_points: int, cfg=None):
    """L'échelle complète des rangs, avec l'état de chacun vis-à-vis du joueur :
    'done' (dépassé), 'current' (rang actuel) ou 'locked' (pas encore atteint).
    Alimente l'écran « L'échelle »."""
    current_rank_index = tier_from_points(rank_points, cfg) // TIERS_PER_RANK
    rows = []
    for i, (name, lo, hi) in enumerate(RANK_RANGES):
        state = "current" if i == current_rank_index else ("done" if i < current_rank_index else "locked")
        rows.append({
            "rank": name,
            "min": lo,
            "max": hi,               # None = illimité
            "state": state,
        })
    return rows
