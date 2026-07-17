import { Search } from "lucide-react";
import { COLORS, FONT_BODY } from "../design/theme";

/**
 * Petit lien discret à côté de l'explication : ouvre une recherche Google
 * sur la question + la bonne réponse, pour aller creuser le sujet.
 */
export default function SearchLink({ question, reponse }) {
  const query = encodeURIComponent(`${question} ${reponse || ""}`.trim());
  return (
    <a
      href={`https://www.google.com/search?q=${query}`}
      target="_blank"
      rel="noopener noreferrer"
      title="Chercher sur Google"
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
        color: COLORS.gold, textDecoration: "none", fontFamily: FONT_BODY,
        fontSize: 12, fontWeight: 700, padding: "4px 8px", borderRadius: 8,
        border: `1px solid ${COLORS.cardAlt}`, whiteSpace: "nowrap",
      }}
    >
      <Search size={13} /> En savoir plus
    </a>
  );
}
