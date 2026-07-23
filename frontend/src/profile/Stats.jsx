import { useEffect, useState } from "react";
import { ChevronLeft, TrendingUp, TrendingDown } from "lucide-react";
import {
  cardWrap, COLORS, FONT_DISPLAY, FONT_BODY, sectionLabel,
} from "../design/theme";
import LineChart from "../components/LineChart";
import { apiFetch } from "../api/client";

/** Barre horizontale de réussite par thème. */
function BarreTheme({ t, couleur }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <span style={{
        fontFamily: FONT_BODY, fontWeight: 800, fontSize: 12.5, width: 120, flexShrink: 0,
        color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {t.theme}
      </span>
      <span style={{ flex: 1, height: 8, background: COLORS.cardAlt, borderRadius: 4, overflow: "hidden" }}>
        <span style={{ display: "block", height: "100%", width: `${t.pct}%`, background: couleur }} />
      </span>
      <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 12.5, color: COLORS.muted, width: 60, textAlign: "right" }}>
        {t.pct}% · {t.total}
      </span>
    </div>
  );
}

/** Statistiques détaillées du joueur : progression, régularité, thèmes. */
export default function Stats({ onNavigate }) {
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    apiFetch("/api/profile/me/stats").then(setData).catch((e) => setErreur(e.message));
  }, []);

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
          Statistiques
        </h2>
      </div>

      {erreur && <p style={{ color: COLORS.danger, fontSize: 13 }}>{erreur}</p>}
      {!data && !erreur && <p style={{ color: COLORS.muted, fontSize: 14 }}>Chargement…</p>}

      {data && (
        <>
          <p style={{ ...sectionLabel, marginTop: 0 }}>Progression</p>
          {data.historique_points.length > 1 ? (
            <LineChart data={data.historique_points} label="points" color={COLORS.gold} />
          ) : (
            <p style={{ fontSize: 12.5, color: COLORS.muted, lineHeight: 1.5 }}>
              La courbe apparaîtra après quelques jours : un relevé est enregistré chaque jour où tu ouvres ton profil.
            </p>
          )}

          <p style={sectionLabel}>Régularité</p>
          {data.parties_par_jour.length > 1 ? (
            <LineChart data={data.parties_par_jour} label="parties" color={COLORS.success} />
          ) : (
            <p style={{ fontSize: 12.5, color: COLORS.muted }}>Pas encore assez de parties classées.</p>
          )}

          {data.forts.length > 0 && (
            <>
              <p style={{ ...sectionLabel, display: "flex", alignItems: "center", gap: 6 }}>
                <TrendingUp size={13} color={COLORS.success} /> Tes points forts
              </p>
              {data.forts.map((t) => <BarreTheme key={t.theme} t={t} couleur={COLORS.success} />)}
            </>
          )}

          {data.faibles.length > 0 && (
            <>
              <p style={{ ...sectionLabel, display: "flex", alignItems: "center", gap: 6 }}>
                <TrendingDown size={13} color={COLORS.danger} /> À travailler
              </p>
              {data.faibles.map((t) => <BarreTheme key={t.theme} t={t} couleur={COLORS.danger} />)}
            </>
          )}

          {data.themes.length === 0 && (
            <p style={{ fontSize: 12.5, color: COLORS.muted, lineHeight: 1.5, marginTop: 12 }}>
              Joue quelques parties classées pour voir tes thèmes forts et faibles apparaître
              (au moins 5 questions par thème).
            </p>
          )}
        </>
      )}
    </div>
  );
}
