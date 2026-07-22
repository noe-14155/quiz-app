import { COLORS, FONT_DISPLAY, FONT_BODY } from "../design/theme";
import Button from "./Button";

export default function QuitConfirmModal({ onCancel, onConfirm }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20,
      }}
    >
      <div style={{ background: COLORS.card, borderRadius: 16, padding: 24, maxWidth: 340, width: "100%" }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 800, margin: "0 0 8px" }}>Quitter la partie ?</p>
        <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 20px", fontFamily: FONT_BODY }}>
          Ta progression dans cette partie sera perdue.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="secondary" onClick={onCancel} style={{ flex: 1 }}>Annuler</Button>
          <Button variant="danger" onClick={onConfirm} style={{ flex: 1 }}>Quitter</Button>
        </div>
      </div>
    </div>
  );
}
