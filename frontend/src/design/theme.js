export const FONT_DISPLAY = "'Baloo 2', system-ui, sans-serif";
export const FONT_BODY = "'Nunito', system-ui, sans-serif";

export const COLORS = {
  bg: "#f2f2f7",
  card: "#ffffff",
  cardAlt: "#e4e4ee",
  gold: "#3B82F6",
  text: "#2d2d3a",
  muted: "#7a7a8c",
  success: "#22C55E",
  danger: "#EF4444",
  shapeA: "#3B82F6",
  shapeB: "#FB923C",
  shapeC: "#8B5CF6",
  shapeD: "#14B8A6",
};

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

export const cardWrap = {
  fontFamily: FONT_BODY,
  background: COLORS.bg,
  color: COLORS.text,
  borderRadius: 20,
  padding: "clamp(16px, 5vw, 28px)",
  maxWidth: 560,
  margin: "0 auto",
  boxSizing: "border-box",
  minHeight: "100vh",
};
