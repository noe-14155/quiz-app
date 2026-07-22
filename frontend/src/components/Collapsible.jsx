import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { COLORS, FONT_DISPLAY } from "../design/theme";

/**
 * Section dépliable. Repliée par défaut (defaultOpen=false), on clique l'en-tête
 * pour l'ouvrir. Utilisée dans l'administration et le suivi pour ne pas tout
 * afficher d'un coup.
 */
export default function Collapsible({ title, count, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: `1px solid ${COLORS.cardAlt}`, borderRadius: 16, marginBottom: 12, overflow: "hidden" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
          padding: "12px 14px", background: COLORS.card, border: "none", cursor: "pointer",
          fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 800, color: COLORS.text,
        }}
      >
        <span>
          {title}
          {count !== undefined && <span style={{ color: COLORS.muted, fontWeight: 400, marginLeft: 8, fontSize: 13 }}>({count})</span>}
        </span>
        <ChevronDown
          size={18}
          color={COLORS.muted}
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }}
        />
      </button>
      {open && <div style={{ padding: "14px" }}>{children}</div>}
    </div>
  );
}
