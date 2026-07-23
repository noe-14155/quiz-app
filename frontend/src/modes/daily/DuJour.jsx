import { useEffect, useState } from "react";
import { Zap, Lightbulb, Flame, Check, ChevronRight } from "lucide-react";
import {
  cardWrap, COLORS, FONT_DISPLAY, FONT_BODY, gradientFull, sectionLabel, tint,
} from "../../design/theme";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

/**
 * Onglet « Du jour » : les deux rendez-vous quotidiens réunis.
 *
 * Ils étaient auparavant noyés parmi les modes sur l'accueil, alors qu'ils
 * relèvent d'une logique différente — on y revient chaque jour, ils ont une
 * série, ils expirent à minuit.
 */
export default function DuJour({ onNavigate }) {
  const { user } = useAuth();
  const [defi, setDefi] = useState(null);
  const [enigme, setEnigme] = useState(null);

  useEffect(() => {
    apiFetch("/api/daily/today").then(setDefi).catch(() => {});
    if (user) apiFetch("/api/enigme/today").then(setEnigme).catch(() => {});
  }, [user]);

  const dateLisible = new Date().toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
  });

  const defiFait = !!defi?.already_played;
  const enigmeFaite = !!enigme?.trouve;

  return (
    <div style={cardWrap}>
      <h2 style={{
        fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 26, margin: "14px 0 2px", color: COLORS.text,
      }}>
        Aujourd'hui
      </h2>
      <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 22px", textTransform: "capitalize" }}>
        {dateLisible}
      </p>

      {/* Défi du jour */}
      <button
        onClick={() => onNavigate(user ? "daily" : "login")}
        style={{
          position: "relative", overflow: "hidden", width: "100%", textAlign: "left",
          border: "none", borderRadius: 20, padding: "18px", marginBottom: 14, cursor: "pointer",
          background: gradientFull(110), backgroundSize: "300% 100%",
          boxShadow: `0 14px 30px -18px ${COLORS.gold}8c`,
          animation: "sqgrad 14s linear infinite, sqrise .45s both",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 10 }}>
          <span style={{
            width: 42, height: 42, borderRadius: 13, background: "rgba(255,255,255,.22)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Zap size={20} color="#fff" />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{
              display: "block", fontFamily: FONT_BODY, fontWeight: 800, fontSize: 10,
              letterSpacing: 1.5, color: "rgba(255,255,255,.9)",
            }}>
              DÉFI DU JOUR
            </span>
            <span style={{ display: "block", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 19, color: "#fff", lineHeight: 1.1 }}>
              10 questions, les mêmes pour tous
            </span>
          </span>
        </div>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontFamily: FONT_BODY, fontWeight: 700, fontSize: 12.5, color: "rgba(255,255,255,.92)",
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {defiFait
              ? <><Check size={14} /> Fait — {defi.already_played.score}/{defi.already_played.total}</>
              : "Pas encore joué"}
          </span>
          {defi?.streak?.current > 0 && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              background: "rgba(255,255,255,.25)", borderRadius: 20, padding: "3px 10px",
            }}>
              <Flame size={11} /> {defi.streak.current}
            </span>
          )}
        </div>
      </button>

      {/* Énigme du jour */}
      <button
        onClick={() => onNavigate(user ? "enigme" : "login")}
        style={{
          display: "flex", alignItems: "center", gap: 13, width: "100%", textAlign: "left",
          background: COLORS.card, border: `1px solid ${COLORS.cardAlt}`, borderRadius: 20,
          padding: "16px 18px", cursor: "pointer", animation: "sqrise .45s .06s both",
        }}
      >
        <span style={{
          width: 42, height: 42, borderRadius: 13, flexShrink: 0,
          background: tint(COLORS.accent3, 14),
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Lightbulb size={20} color={COLORS.accent3} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 16, color: COLORS.text }}>
            Énigme du jour
          </span>
          <span style={{
            display: "flex", alignItems: "center", gap: 6, fontSize: 12.5,
            color: enigmeFaite ? COLORS.success : COLORS.muted, marginTop: 2,
          }}>
            {enigmeFaite
              ? <><Check size={13} /> Trouvée — {enigme.points} points</>
              : enigme
                ? `Une devinette, ${enigme.indices_restants} indice${enigme.indices_restants > 1 ? "s" : ""} en réserve`
                : "Une devinette, trois indices"}
          </span>
        </span>
        {enigme?.serie?.current > 0 && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0,
            background: tint(COLORS.accent3, 14), borderRadius: 20, padding: "3px 9px",
            fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 12, color: COLORS.accent3,
          }}>
            <Flame size={11} /> {enigme.serie.current}
          </span>
        )}
        <ChevronRight size={17} color={COLORS.chevron} style={{ flexShrink: 0 }} />
      </button>

      {!user && (
        <p style={{ fontSize: 12.5, color: COLORS.muted, lineHeight: 1.5, marginTop: 18 }}>
          Connecte-toi pour enregistrer tes scores, apparaître au classement du jour et garder ta série.
        </p>
      )}

      {(defiFait || enigmeFaite) && user && (
        <>
          <p style={sectionLabel}>Reviens demain</p>
          <p style={{ fontSize: 12.5, color: COLORS.muted, lineHeight: 1.5 }}>
            {defiFait && enigmeFaite
              ? "Tout est fait pour aujourd'hui. Une nouvelle série de questions et une nouvelle énigme t'attendent demain."
              : "Il te reste quelque chose à faire aujourd'hui."}
          </p>
        </>
      )}
    </div>
  );
}
