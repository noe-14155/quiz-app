import { useEffect, useState } from "react";
import { Zap, Brain, Lock, ChevronRight, ArrowRight } from "lucide-react";
import {
  COLORS, FONT_DISPLAY, FONT_BODY, cardWrap, tierInfo,
  gradientFull, gradientTri, gradientText, sectionLabel, TILE_THEMES,
} from "./design/theme";
import { SettingsButton } from "./design/Settings";
import { useAuth } from "./auth/AuthContext";
import { apiFetch } from "./api/client";

/** Tuile de mode : dégradé pastel et texte de la même famille de couleurs. */
function Tile({ theme, title, subtitle, onClick, enabled = true, wide = false }) {
  const t = TILE_THEMES[theme];
  const dark = COLORS.bg === "#14151f";
  return (
    <button
      onClick={enabled ? onClick : undefined}
      style={{
        minHeight: 90, display: "flex", flexDirection: "column", justifyContent: "flex-end",
        borderRadius: 20, padding: 16, textAlign: "left",
        gridColumn: wide ? "span 2" : "auto",
        cursor: enabled ? "pointer" : "not-allowed",
        border: `1.5px solid ${dark ? COLORS.cardAlt : t.border}`,
        background: dark ? COLORS.card : `linear-gradient(135deg, ${t.from}, ${t.to})`,
        fontFamily: FONT_BODY, opacity: enabled ? 1 : 0.5,
        transition: "transform .15s, border-color .2s",
      }}
    >
      <span style={{ width: 11, height: 11, borderRadius: "50%", background: t.dot, marginBottom: 12, display: "block" }} />
      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 18, margin: 0, color: dark ? COLORS.text : t.title }}>
        {title}
      </p>
      <p style={{ fontSize: 12, color: dark ? COLORS.muted : t.sub, margin: "2px 0 0" }}>
        {enabled ? subtitle : "Indisponible"}
      </p>
    </button>
  );
}

export default function Home({ screen, onNavigate }) {
  const { user } = useAuth();
  const [modes, setModes] = useState({
    mode_chill_enabled: true, mode_ranked_enabled: true,
    mode_local_enabled: true, mode_daily_enabled: true,
  });

  useEffect(() => {
    apiFetch("/api/modes/status").then(setModes).catch(() => {});
  }, []);

  const t = user ? tierInfo(user.rank_tier) : null;

  return (
    <div style={cardWrap}>
      {/* Barre du haut : pseudo + rang, puis réglages */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "10px 0 30px", animation: "sqrise .5s both" }}>
        <button
          onClick={() => onNavigate(user ? "profile" : "login")}
          style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 17, color: COLORS.text }}>
            {user ? user.pseudo : "Invité"}
          </span>
          {t && (
            <span style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 12, color: COLORS.label }}>
              · {t.rank.name} {t.palierLabel}
            </span>
          )}
        </button>
        <SettingsButton onClick={() => onNavigate(user ? "profile" : "login")} />
      </div>

      <p style={{ ...sectionLabel, letterSpacing: 2, margin: "0 0 3px", animation: "sqrise .5s .04s both" }}>
        Prêt à jouer ?
      </p>
      <h2 style={{
        fontFamily: FONT_DISPLAY, fontSize: 30, fontWeight: 800, margin: "0 0 26px",
        letterSpacing: -0.5, lineHeight: 1, animation: "sqrise .5s .08s both",
      }}>
        <span style={gradientText(90)}>S</span>
        <span style={{ color: COLORS.bg === "#14151f" ? COLORS.text : "#2A2350" }}>quizz</span>
        <span style={gradientText(90)}>YourBrain</span>
      </h2>

      {modes.mode_daily_enabled !== false && (
        <button
          onClick={() => onNavigate("daily")}
          style={{
            position: "relative", overflow: "hidden", display: "flex", alignItems: "center", gap: 14,
            width: "100%", textAlign: "left", cursor: "pointer", border: "none", borderRadius: 18,
            padding: "14px 16px", marginBottom: 20,
            background: gradientFull(110), backgroundSize: "300% 100%",
            boxShadow: `0 12px 26px -16px ${COLORS.gold}8c`,
            animation: "sqgrad 14s linear infinite, sqrise .5s .14s both",
          }}
        >
          <span style={{
            width: 44, height: 44, borderRadius: 13, background: "rgba(255,255,255,.22)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Zap size={20} color="#fff" />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontFamily: FONT_BODY, fontWeight: 800, fontSize: 10, letterSpacing: 1.5, color: "rgba(255,255,255,.9)" }}>
              DÉFI DU JOUR
            </span>
            <span style={{ display: "block", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 18, color: "#fff", marginTop: 1, lineHeight: 1.1 }}>
              10 questions
            </span>
          </span>
          <ArrowRight size={20} color="#fff" style={{ flexShrink: 0 }} />
        </button>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, animation: "sqrise .5s .2s both" }}>
        <Tile theme="ranked" title="Classé" subtitle="Timer · points"
          enabled={modes.mode_ranked_enabled} onClick={() => onNavigate(user ? "ranked-setup" : "login")} />
        <Tile theme="chill" title="Chill" subtitle="Sans pression"
          enabled={modes.mode_chill_enabled} onClick={() => onNavigate("chill-setup")} />
        <Tile theme="local" title="Local" subtitle="À tour de rôle" wide
          enabled={modes.mode_local_enabled} onClick={() => onNavigate("local-choice")} />
      </div>

      {user ? (
        <button
          onClick={() => onNavigate("ranks")}
          style={{
            display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
            background: COLORS.card, border: `1px solid ${COLORS.cardAlt}`, borderRadius: 20,
            padding: "14px 16px", marginTop: 18, cursor: "pointer", animation: "sqrise .5s .26s both",
          }}
        >
          <span style={{
            width: 42, height: 42, borderRadius: 13, background: gradientTri(135), flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Brain size={20} color="#fff" />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15, color: COLORS.text }}>
                {t.rank.name} {t.palierLabel}
              </span>
              <span style={{ fontSize: 12, color: COLORS.muted, fontWeight: 700 }}>
                {user.rank_points.toLocaleString("fr-FR")} pts
              </span>
            </span>
            <span style={{ display: "block", height: 7, borderRadius: 4, background: COLORS.cardAlt, marginTop: 7, overflow: "hidden" }}>
              <span style={{ display: "block", height: "100%", width: `${user.rank_progress || 0}%`, background: gradientTri(90) }} />
            </span>
          </span>
          <ChevronRight size={18} color={COLORS.chevron} style={{ flexShrink: 0 }} />
        </button>
      ) : (
        <button
          onClick={() => onNavigate("login")}
          style={{
            display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
            background: COLORS.card, border: `1px solid ${COLORS.cardAlt}`, borderRadius: 20,
            padding: "14px 16px", marginTop: 18, cursor: "pointer",
          }}
        >
          <span style={{
            width: 42, height: 42, borderRadius: 13, background: COLORS.soft, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Lock size={18} color={COLORS.muted} />
          </span>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15, color: COLORS.text }}>
              Connecte-toi
            </span>
            <span style={{ display: "block", fontSize: 12, color: COLORS.muted, marginTop: 1 }}>
              Pour suivre ton rang et ta progression
            </span>
          </span>
          <ChevronRight size={18} color={COLORS.chevron} style={{ flexShrink: 0 }} />
        </button>
      )}
    </div>
  );
}
