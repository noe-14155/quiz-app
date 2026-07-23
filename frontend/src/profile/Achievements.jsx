import { ChevronLeft, Award, Lock } from "lucide-react";
import {
  cardWrap, COLORS, FONT_DISPLAY, FONT_BODY, gradient, sectionLabel, tint,
} from "../design/theme";
import { useAuth } from "../auth/AuthContext";

/**
 * Page dédiée aux succès.
 *
 * Regroupés par catégorie plutôt qu'en liste continue : on voit ainsi ce qui
 * relève de l'assiduité, de la performance ou de la progression, et donc quoi
 * viser ensuite. Les succès restant à obtenir sont estompés mais toujours
 * lisibles — c'est ce qui donne envie de les décrocher.
 */
export default function Achievements({ onNavigate }) {
  const { user } = useAuth();
  const liste = user?.achievements || [];
  const obtenus = liste.filter((a) => a.unlocked).length;
  const pct = liste.length ? Math.round((obtenus / liste.length) * 100) : 0;

  // Ordre d'affichage voulu : on découvre, on s'assidue, on progresse, on performe.
  const ORDRE = ["Découverte", "Assiduité", "Progression", "Performance"];
  const categories = [...new Set(liste.map((a) => a.categorie))]
    .sort((a, b) => (ORDRE.indexOf(a) + 99) % 99 - (ORDRE.indexOf(b) + 99) % 99);

  return (
    <div style={cardWrap}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "2px 0 18px" }}>
        <button
          onClick={() => onNavigate("profile")}
          aria-label="Retour"
          style={{
            width: 36, height: 36, borderRadius: 11, background: COLORS.soft, border: "none",
            color: COLORS.muted2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <ChevronLeft size={18} />
        </button>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 24, margin: 0, color: COLORS.text }}>
          Succès
        </h2>
      </div>

      {/* Avancement global */}
      <div style={{
        background: COLORS.card, border: `1px solid ${COLORS.cardAlt}`, borderRadius: 20,
        padding: "16px 18px", marginBottom: 4, animation: "sqrise .4s both",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 9 }}>
          <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 17, color: COLORS.text }}>
            {obtenus} sur {liste.length}
          </span>
          <span style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: 13, color: COLORS.gold }}>
            {pct}%
          </span>
        </div>
        <div style={{ height: 8, borderRadius: 5, background: COLORS.cardAlt, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: gradient(90), borderRadius: 5 }} />
        </div>
      </div>

      {liste.length === 0 && (
        <p style={{ fontSize: 13, color: COLORS.muted, textAlign: "center", padding: "28px 0", lineHeight: 1.5 }}>
          Les succès apparaîtront ici dès ta première partie.
        </p>
      )}

      {categories.map((cat) => {
        const succes = liste.filter((a) => a.categorie === cat);
        const faits = succes.filter((a) => a.unlocked).length;
        return (
          <div key={cat}>
            <p style={sectionLabel}>
              {cat} <span style={{ color: COLORS.chevron, fontWeight: 700 }}>{faits}/{succes.length}</span>
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {succes.map((a) => (
                <div
                  key={a.code}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 16,
                    background: a.unlocked ? tint(COLORS.gold, 8) : COLORS.card,
                    border: `1px solid ${a.unlocked ? COLORS.gold : COLORS.cardAlt}`,
                    opacity: a.unlocked ? 1 : 0.6,
                  }}
                >
                  <span style={{
                    width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: a.unlocked ? gradient(135) : COLORS.soft,
                  }}>
                    {a.unlocked
                      ? <Award size={17} color="#fff" />
                      : <Lock size={15} color={COLORS.muted} />}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15, color: COLORS.text }}>
                      {a.titre}
                    </span>
                    <span style={{ display: "block", fontFamily: FONT_BODY, fontSize: 12, color: COLORS.muted, marginTop: 1, lineHeight: 1.35 }}>
                      {a.description}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
