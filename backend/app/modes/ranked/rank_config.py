"""Configuration du mode classé.

Système de progression :
- 7 rangs : Novice → Apprenti → Confirmé → Expert → Champion → Maître → Légende.
- Chaque rang couvre une plage de points propre (plages IRRÉGULIÈRES, voir
  RANK_RANGES) et se découpe en 3 paliers réguliers (III, II, I).
  Le nombre total de paliers reste donc 18 (tiers 0 à 17), ce qui permet de
  conserver la courbe de gain/malus indexée sur le tier.
- Légende est le rang sommet : au-delà de Légende I les points
  continuent de monter, le rang reste le même (le classement départage sur les
  points).
- Le barème dépend du taux de réussite attendu au rang (voir plus bas).
- Passer une question est interdit à partir de Champion (5e rang).
- Perte quotidienne : à partir de Champion III, N points par jour (réglable),
  avec plancher au début de Champion III.
"""

# (nom, point de départ, dernier point du rang ; None = illimité)
RANK_RANGES = [
    ("Novice", 0, 199),
    ("Apprenti", 200, 499),
    ("Confirmé", 500, 999),
    ("Expert", 1000, 1799),
    ("Champion", 1800, 2999),
    ("Maître", 3000, 4999),
    ("Légende", 5000, None),
]

RANKS = [r[0] for r in RANK_RANGES]
PALIER_LABELS = ["III", "II", "I"]
TIERS_PER_RANK = 3
NORMAL_TIERS = len(RANKS) * TIERS_PER_RANK  # 18 (tiers 0..17)

# Largeur retenue pour le rang sommet (illimité) : celle du rang précédent.
_TOP_SPAN = 2000


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
LOCK_RANK_INDEX = RANKS.index("Champion")            # 4
LOCK_TIER = LOCK_RANK_INDEX * TIERS_PER_RANK       # 12
DECAY_FLOOR_POINTS = TIER_STARTS[LOCK_TIER]        # début de Champion III

NB_QUESTIONS_PER_PARTY = 10

# Valeurs par défaut (alignées avec DEFAULT_SETTINGS côté admin).
DEFAULTS = {
    "amplitude": 60,   # échelle générale des variations de points
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


# ---------------------------------------------------------------------------
# Barème : chaque rang attend un niveau de jeu
#
# À chaque rang correspond un TAUX DE RÉUSSITE ATTENDU. Le barème est calibré
# pour qu'un joueur atteignant exactement ce taux termine sa partie à zéro : il
# se maintient. Au-dessus il monte, en dessous il descend, et l'écart au taux
# attendu détermine l'ampleur.
#
# Le calcul est direct. Si p est le taux attendu et A l'amplitude :
#     gain d'une bonne réponse = A x (1 - p)
#     coût d'une erreur        = A x p
# Sur N questions, réussir exactement N x p fois donne bien un solde nul.
#
# Conséquence : plus le rang est élevé, plus une bonne réponse rapporte peu et
# plus une erreur coûte cher. Au rang Légende (95 % attendu), une bonne réponse
# vaut +3 et une erreur -57 : il faut être quasiment incollable pour progresser,
# et une seule erreur efface le bénéfice de dix-neuf bonnes réponses.
#
# La difficulté des questions n'entre pas dans le calcul : elle est déjà prise
# en compte en amont, puisque les questions servies deviennent plus dures à
# mesure qu'on monte (voir weights_for_tier). Atteindre 80 % au rang Champion
# est donc bien plus exigeant qu'atteindre 80 % au rang Novice.
# ---------------------------------------------------------------------------

# Taux de réussite attendu par rang, dans l'ordre de RANK_RANGES.
TAUX_ATTENDU = [0.40, 0.50, 0.60, 0.70, 0.80, 0.88, 0.95]

CALIBRATION_MIN_REPONSES = 20


def taux_attendu(points: int, cfg=None) -> float:
    """Taux de réussite attendu au rang du joueur."""
    rang = tier_from_points(points, cfg) // TIERS_PER_RANK
    return TAUX_ATTENDU[min(rang, len(TAUX_ATTENDU) - 1)]


def amplitude(cfg=None) -> int:
    return _v(cfg, "amplitude")


def gain_for_points(points: int, cfg=None) -> int:
    """Points d'une bonne réponse à ce rang."""
    return max(1, round(amplitude(cfg) * (1 - taux_attendu(points, cfg))))


def malus_for_points(points: int, cfg=None) -> int:
    """Coût d'une erreur à ce rang."""
    return max(1, round(amplitude(cfg) * taux_attendu(points, cfg)))


def difficulte_effective(difficulte: int, vues: int = 0, reussies: int = 0) -> int:
    """Difficulté réelle d'une question, corrigée par les statistiques.
    Ne sert plus au calcul des points, mais reste utile pour l'administration
    (repérer les questions mal classées dans le CSV)."""
    d = max(1, min(5, int(difficulte or 3)))
    if vues < CALIBRATION_MIN_REPONSES:
        return d
    taux = reussies / vues
    if taux >= 0.85:
        return max(1, d - 1)
    if taux <= 0.25:
        return min(5, d + 1)
    return d


def delta_for(points: int, difficulte: int, correct: bool, cfg=None,
              vues: int = 0, reussies: int = 0) -> int:
    """Variation de points pour une réponse."""
    if correct:
        return gain_for_points(points, cfg)
    return -malus_for_points(points, cfg)


def tier_from_points(rank_points: int, cfg=None) -> int:
    """Tier (0 = Novice III … 20 = Légende I). Plafonné : au-delà, les points
    montent mais le rang reste Légende I."""
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
    médian."""
    return round(500 / TIERS_PER_RANK)


def diamant_floor_points(cfg=None) -> int:
    """Plancher de la perte quotidienne (début de Champion III)."""
    return DECAY_FLOOR_POINTS


def is_unreal(rank_points: int, cfg=None) -> bool:
    """Conservé pour compatibilité : il n'y a plus de rang « au-delà »."""
    return False


def can_pass(rank_points: int, cfg=None) -> bool:
    """Passer est interdit à partir de Champion (III et au-dessus)."""
    return tier_from_points(rank_points, cfg) < LOCK_TIER


def gain_for_tier(tier: int, cfg=None) -> int:
    """Gain d'une bonne réponse à ce palier (affichage)."""
    return gain_for_points(TIER_STARTS[min(max(tier, 0), NORMAL_TIERS - 1)], cfg)


def loss_for_tier(tier: int, cfg=None) -> int:
    """Coût d'une erreur à ce palier (affichage)."""
    return malus_for_points(TIER_STARTS[min(max(tier, 0), NORMAL_TIERS - 1)], cfg)


def _difficulte_de_reference(tier: int) -> int:
    """Difficulté la plus représentative des questions posées à ce tier."""
    poids = weights_for_tier(tier)
    return 1 + poids.index(max(poids))


def loss_for_pass(tier: int, cfg=None) -> int:
    """Coût d'un « passer » : un tiers d'une erreur, pour que passer reste
    préférable à répondre au hasard sans être gratuit."""
    points = TIER_STARTS[min(max(tier, 0), NORMAL_TIERS - 1)]
    return max(2, malus_for_points(points, cfg) // 3)


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
    Champion III, sans jamais descendre sous ce seuil."""
    floor = diamant_floor_points(cfg)
    if days <= 0 or rank_points < floor:
        return rank_points
    return max(floor, rank_points - _v(cfg, "daily_decay") * days)


def bareme_joueur(points: int, cfg=None):
    """Ce que rapporte ou coûte chaque niveau de difficulté POUR CE JOUEUR.
    C'est l'information utile désormais : elle dépend de son score, pas d'un
    forfait par rang."""
    return {
        "gain": gain_for_points(points, cfg),
        "perte": malus_for_points(points, cfg),
        "taux_attendu": round(taux_attendu(points, cfg) * 100),
        "sur_dix": round(taux_attendu(points, cfg) * 10, 1),
    }


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
