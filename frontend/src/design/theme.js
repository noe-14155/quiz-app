export const FONT_DISPLAY = "'Baloo 2', system-ui, sans-serif";
export const FONT_BODY = "'Nunito', system-ui, sans-serif";

/* ---------------------------------------------------------------------------
 * Palette issue de la maquette SquizzYourBrain.
 * Mode CLAIR par défaut (fond blanc, cartes très pâles), mode sombre disponible.
 * Les noms de clés historiques (bg, card, cardAlt, gold, text, muted, success,
 * danger, shapeA..D) sont conservés pour ne casser aucun composant existant ;
 * de nouvelles clés (accent2, accent3, soft, muted2, page) apportent les
 * nuances de la maquette.
 * ------------------------------------------------------------------------- */

const LIGHT_BASE = {
  bg: "#ffffff",
  card: "#fafafd",    // fond de carte (soft2 dans la maquette)
  cardAlt: "#eeeef4", // lignes / pistes / bordures (line)
  soft: "#f2f3f7",    // fond de bouton discret / champ
  text: "#1c1e2e",
  muted: "#9092a6",
  muted2: "#7f8196",
  label: "#a3a5b8",   // libellés de sections (plus clair que muted)
  chevron: "#c2c4d2", // chevrons et texte très discret
  success: "#12B981",
  danger: "#F43F5E",
  page: "#eceef4",    // fond derrière la carte principale
};

const DARK_BASE = {
  bg: "#14151f",
  card: "#1a1c26",
  cardAlt: "#2c2e3c",
  soft: "#20222e",
  text: "#f2f2f8",
  muted: "#8b8da3",
  muted2: "#a5a7bb",
  label: "#7a7c92",
  chevron: "#565973",
  success: "#12B981",
  danger: "#F43F5E",
  page: "#0c0d14",
};

/* Accent principal personnalisable ; accent2/accent3 complètent les dégradés. */
export const ACCENT_OPTIONS = [
  { name: "Violet", value: "#7C4DFF" },
  { name: "Rose", value: "#FF4D9D" },
  { name: "Orange", value: "#FF8A3D" },
  { name: "Vert", value: "#12B981" },
  { name: "Bleu", value: "#38BDF8" },
];

const ACCENT2 = "#FF4D9D";
const ACCENT3 = "#FF8A3D";

/* Couleurs des 4 réponses (façon plateau de jeu) : losange, rond, triangle, carré. */
const SHAPE_COLORS = {
  shapeA: "#7C4DFF",
  shapeB: "#FF4D9D",
  shapeC: "#FF8A3D",
  shapeD: "#12B981",
};

// Objet unique et mutable : on modifie ses valeurs en place (applyTheme),
// jamais sa référence, pour que tous les fichiers qui l'importent une seule
// fois voient les changements sans avoir à re-importer quoi que ce soit.
export const COLORS = {
  ...LIGHT_BASE,
  gold: ACCENT_OPTIONS[0].value, // "gold" = accent principal (nom historique)
  accent2: ACCENT2,
  accent3: ACCENT3,
  ...SHAPE_COLORS,
};

const STORAGE_KEY = "quiz_theme_settings";

export function loadThemeSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { mode: saved?.mode || "light", accent: saved?.accent || ACCENT_OPTIONS[0].value };
  } catch (e) {
    return { mode: "light", accent: ACCENT_OPTIONS[0].value };
  }
}

export function applyTheme(mode, accent) {
  const base = mode === "dark" ? DARK_BASE : LIGHT_BASE;
  Object.assign(COLORS, base, { gold: accent, accent2: ACCENT2, accent3: ACCENT3 });
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, accent }));
  // Le fond de page suit le thème (la carte principale est centrée dessus).
  if (typeof document !== "undefined") {
    document.body.style.background = base.page;
    document.body.dataset.theme = mode;
  }
}

/* ---------------------------------------------------------------------------
 * Dégradés et helpers de style réutilisables
 * ------------------------------------------------------------------------- */

/** Dégradé principal (boutons, barres de progression). */
export function gradient(angle = 110) {
  return `linear-gradient(${angle}deg, ${COLORS.gold}, ${COLORS.accent2})`;
}

/** Dégradé animé multi-couleurs (logo, carte du défi du jour). */
export function gradientFull(angle = 110) {
  return `linear-gradient(${angle}deg, ${COLORS.gold}, ${COLORS.accent2}, ${COLORS.accent3}, ${COLORS.gold})`;
}

/** Texte en dégradé (titres, gros score). */
export function gradientText(angle = 120) {
  return {
    background: gradientFull(angle),
    backgroundSize: "300% 100%",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
    animation: "sqgrad 12s linear infinite",
  };
}


/* ---------------------------------------------------------------------------
 * Habillage des tuiles de l'accueil : chaque mode a sa famille de couleurs,
 * jusqu'au texte (titre foncé, sous-titre adouci de la même teinte).
 * ------------------------------------------------------------------------- */
export const TILE_THEMES = {
  ranked: { from: "#f1ebff", to: "#e7dcff", border: "#ddd0fb", dot: "#7C4DFF", title: "#4a2fb0", sub: "#8778ab" },
  chill:  { from: "#e3f8f1", to: "#d3f3e8", border: "#c2ecdd", dot: "#12B981", title: "#0a8f63", sub: "#6fa593" },
  local:  { from: "#fff1e4", to: "#ffe6d2", border: "#ffd9bd", dot: "#FF8A3D", title: "#d9701f", sub: "#bb8b64" },
  daily:  { from: "#ffe9f2", to: "#ffdcea", border: "#ffc9de", dot: "#FF4D9D", title: "#c9327a", sub: "#b3799a" },
  duel:   { from: "#e7f0ff", to: "#d7e6ff", border: "#c3daff", dot: "#3B82F6", title: "#1d4ed8", sub: "#7189b8" },
};

/** Dégradé « signature » à trois couleurs (carte de rang, badges). */
export function gradientTri(angle = 135) {
  return `linear-gradient(${angle}deg, ${COLORS.gold}, ${COLORS.accent2}, ${COLORS.accent3})`;
}

/** Mélange une couleur avec du transparent (fonds de tags, lignes surlignées). */
export function tint(color, pct) {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

/** Style de carte standard. */
export const cardStyle = {
  get background() { return COLORS.card; },
  get border() { return `1px solid ${COLORS.cardAlt}`; },
  borderRadius: 18,
  padding: 16,
};

/* Libellés de sections (petites majuscules espacées). */
export const sectionLabel = {
  fontFamily: FONT_BODY,
  fontWeight: 800,
  fontSize: 12,
  letterSpacing: 1.6,
  textTransform: "uppercase",
  margin: "24px 0 11px",
  get color() { return COLORS.label; },
};

/* ---------------------------------------------------------------------------
 * Rangs — habillage visuel de la maquette (dégradés par rang)
 * ------------------------------------------------------------------------- */

export const RANKS = [
  { name: "Neurone", color: "#AEB4C4", color2: "#8A93A5", min: 0, max: 199 },
  { name: "Curieux", color: "#54D0F5", color2: "#38BDF8", min: 200, max: 499 },
  { name: "Malin", color: "#2ED9B0", color2: "#12B981", min: 500, max: 999 },
  { name: "Grosse Tête", color: "#FFA351", color2: "#FF8A3D", min: 1000, max: 1499 },
  { name: "Génie", color: "#FF7FAE", color2: "#FF4D9D", min: 1500, max: 2999 },
  { name: "Prodige", color: "#9B7FE8", color2: "#7C4DFF", min: 3000, max: null },
];
export const PALIER_LABELS = ["III", "II", "I"];
const TIERS_PER_RANK = 3;
export const MAX_TIER = RANKS.length * TIERS_PER_RANK - 1; // 17

/** Rang à partir duquel passer est interdit et la perte quotidienne s'applique. */
export const LOCK_RANK_INDEX = 4; // Génie

export function tierInfo(tier) {
  // 6 rangs x 3 paliers = 18 niveaux (0..17). Au-delà, on reste au sommet.
  const t = Math.max(0, Math.min(tier, MAX_TIER));
  const rankIndex = Math.floor(t / TIERS_PER_RANK);
  const palierIndex = t % TIERS_PER_RANK;
  return {
    rank: RANKS[rankIndex],
    rankIndex,
    palierLabel: PALIER_LABELS[palierIndex],
    unreal: false,
  };
}

/** Plage de points affichable pour un rang ("1 000 – 1 499 pts" / "3 000 pts et +"). */
export function rankRange(rank) {
  const f = (n) => n.toLocaleString("fr-FR");
  return rank.max === null || rank.max === undefined
    ? `${f(rank.min)} pts et +`
    : `${f(rank.min)} – ${f(rank.max)} pts`;
}

/** Dégradé d'un rang, pour les pastilles et badges. */
export function rankGradient(rank) {
  return `linear-gradient(135deg, ${rank.color}, ${rank.color2 || rank.color})`;
}

// cardWrap reste le même objet partout (aucun fichier consommateur à modifier),
// mais "background" est dynamique et relit toujours la valeur ACTUELLE de COLORS.
export const cardWrap = {
  fontFamily: FONT_BODY,
  padding: "18px 20px 34px",
  maxWidth: 480,
  margin: "0 auto",
  boxSizing: "border-box",
  minHeight: "100vh",
};
Object.defineProperty(cardWrap, "background", { get: () => COLORS.bg, enumerable: true });
Object.defineProperty(cardWrap, "color", { get: () => COLORS.text, enumerable: true });
