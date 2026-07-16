export const FONT_DISPLAY = "'Baloo 2', system-ui, sans-serif";
export const FONT_BODY = "'Nunito', system-ui, sans-serif";

const LIGHT_BASE = {
  bg: "#f2f2f7",
  card: "#ffffff",
  cardAlt: "#e4e4ee",
  text: "#2d2d3a",
  muted: "#7a7a8c",
  success: "#22C55E",
  danger: "#EF4444",
};

const DARK_BASE = {
  bg: "#1a1a24",
  card: "#242430",
  cardAlt: "#34344a",
  text: "#f0f0f5",
  muted: "#9a9aad",
  success: "#34D399",
  danger: "#F87171",
};

// Palette restreinte : seule la couleur d'accent (boutons, sélections, timer...)
// est personnalisable, pas l'ensemble du thème.
export const ACCENT_OPTIONS = [
  { name: "Bleu", value: "#3B82F6" },
  { name: "Orange", value: "#FB923C" },
  { name: "Violet", value: "#8B5CF6" },
  { name: "Turquoise", value: "#14B8A6" },
  { name: "Rose", value: "#EC4899" },
  { name: "Vert", value: "#84CC16" },
];

const SHAPE_COLORS = { shapeA: "#3B82F6", shapeB: "#FB923C", shapeC: "#8B5CF6", shapeD: "#14B8A6" };

// Objet unique et mutable : on modifie ses valeurs en place (applyTheme),
// jamais sa référence, pour que tous les fichiers qui l'importent une seule
// fois voient les changements sans avoir à re-importer quoi que ce soit.
export const COLORS = { ...DARK_BASE, gold: ACCENT_OPTIONS[0].value, ...SHAPE_COLORS };

const STORAGE_KEY = "quiz_theme_settings";

export function loadThemeSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { mode: saved?.mode || "dark", accent: saved?.accent || ACCENT_OPTIONS[0].value };
  } catch (e) {
    return { mode: "dark", accent: ACCENT_OPTIONS[0].value };
  }
}

export function applyTheme(mode, accent) {
  const base = mode === "light" ? LIGHT_BASE : DARK_BASE;
  Object.assign(COLORS, base, { gold: accent });
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, accent }));
}

export const RANKS = [
  { name: "Fer", color: "#9C9184" },
  { name: "Bronze", color: "#B9764A" },
  { name: "Argent", color: "#C3CBD3" },
  { name: "Or", color: "#F4B942" },
  { name: "Diamant", color: "#6FD3E0" },
  { name: "Légende", color: "#C77DFF" },
];
export const PALIER_LABELS = ["III", "II", "I"];
export const MAX_TIER = RANKS.length * 3 - 1;

export function tierInfo(tier) {
  const rankIndex = Math.floor(tier / 3);
  const palierIndex = tier % 3;
  return { rank: RANKS[rankIndex], rankIndex, palierLabel: PALIER_LABELS[palierIndex] };
}

// cardWrap reste le même objet partout (aucun fichier consommateur à modifier),
// mais "background" et "color" sont des propriétés dynamiques qui relisent
// toujours la valeur ACTUELLE de COLORS, y compris après un changement de thème.
export const cardWrap = {
  fontFamily: FONT_BODY,
  borderRadius: 20,
  padding: "clamp(16px, 5vw, 28px)",
  maxWidth: 560,
  margin: "0 auto",
  boxSizing: "border-box",
  minHeight: "100vh",
};
Object.defineProperty(cardWrap, "background", { get: () => COLORS.bg, enumerable: true });
Object.defineProperty(cardWrap, "color", { get: () => COLORS.text, enumerable: true });

