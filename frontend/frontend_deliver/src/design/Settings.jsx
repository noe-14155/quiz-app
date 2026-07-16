import { useState } from "react";
import { Settings as SettingsIcon, Moon, Sun, Check, X } from "lucide-react";
import { COLORS, FONT_DISPLAY, FONT_BODY, ACCENT_OPTIONS } from "./theme";
import { useThemeSettings } from "./ThemeContext";

export function SettingsButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="Paramètres"
      style={{ background: "none", border: "none", color: COLORS.muted, cursor: "pointer", display: "flex", alignItems: "center", padding: 4 }}
    >
      <SettingsIcon size={18} />
    </button>
  );
}

export default function SettingsPanel({ onClose }) {
  const { mode, accent, setMode, setAccent } = useThemeSettings();

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 }}>
      <div style={{ background: COLORS.card, borderRadius: 16, padding: 24, maxWidth: 360, width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 700, margin: 0, color: COLORS.text }}>Paramètres</p>
          <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.muted, cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: FONT_BODY }}>
          Apparence
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
          <button
            onClick={() => setMode("dark")}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 0", borderRadius: 12,
              border: mode === "dark" ? `2px solid ${COLORS.gold}` : `2px solid ${COLORS.cardAlt}`,
              background: mode === "dark" ? "rgba(59,130,246,0.12)" : "transparent",
              color: COLORS.text, fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}
          >
            <Moon size={16} /> Sombre
          </button>
          <button
            onClick={() => setMode("light")}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 0", borderRadius: 12,
              border: mode === "light" ? `2px solid ${COLORS.gold}` : `2px solid ${COLORS.cardAlt}`,
              background: mode === "light" ? "rgba(59,130,246,0.12)" : "transparent",
              color: COLORS.text, fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}
          >
            <Sun size={16} /> Clair
          </button>
        </div>

        <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: FONT_BODY }}>
          Couleur d'accent
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {ACCENT_OPTIONS.map((opt) => {
            const active = accent === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setAccent(opt.value)}
                aria-label={opt.name}
                style={{
                  width: 40, height: 40, borderRadius: "50%", background: opt.value,
                  border: active ? `3px solid ${COLORS.text}` : "3px solid transparent",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {active && <Check size={18} color="#fff" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
