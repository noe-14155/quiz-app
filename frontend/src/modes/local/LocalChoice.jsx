import { cardWrap, COLORS, FONT_DISPLAY } from "../../design/theme";
import TopBar from "../../components/TopBar";
import Button from "../../components/Button";

export default function LocalChoice({ screen, onNavigate }) {
  return (
    <div style={cardWrap}>
      <TopBar screen={screen} onNavigate={onNavigate} />
      <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 800, margin: "0 0 4px" }}>Mode local</h2>
      <p style={{ color: COLORS.muted, margin: "0 0 20px", fontSize: 14 }}>Choisis la variante à jouer entre potes.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ background: COLORS.card, borderRadius: 18, padding: 18 }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 18, margin: "0 0 4px" }}>Tu te mets combien ?</p>
          <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 12px" }}>Chacun mise des points sur sa confiance, question individuelle, premier au score cible gagne.</p>
          <Button onClick={() => onNavigate("mise-setup")}>Jouer</Button>
        </div>

        <div style={{ background: COLORS.card, borderRadius: 18, padding: 18 }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 18, margin: "0 0 4px" }}>Mode Questions</p>
          <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 12px" }}>Une question à voix haute, tu révèles la réponse, puis tu désignes qui a trouvé.</p>
          <Button onClick={() => onNavigate("questions-mode-setup")}>Jouer</Button>
        </div>
      </div>
    </div>
  );
}
