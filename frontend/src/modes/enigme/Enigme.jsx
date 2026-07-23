import { useState, useEffect, useRef } from "react";
import { ChevronLeft, Lightbulb, Check, Send, Flame } from "lucide-react";
import {
  cardWrap, COLORS, FONT_DISPLAY, FONT_BODY, gradient, gradientText, sectionLabel, tint,
} from "../../design/theme";
import { inputStyle } from "../../components/PageTitle";
import Button from "../../components/Button";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { feedbackBon, feedbackMauvais, feedbackFin } from "../../design/feedback";

/**
 * Énigme du jour : une devinette, une réponse en texte libre, trois indices
 * qui coûtent des points. Le classement du jour départage ceux qui ont trouvé.
 */
export default function Enigme({ onNavigate }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [saisie, setSaisie] = useState("");
  const [rate, setRate] = useState(false);      // secousse après une erreur
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const champ = useRef(null);

  useEffect(() => {
    apiFetch("/api/enigme/today").then(setData).catch((e) => setErreur(e.message));
  }, []);

  async function proposer() {
    const texte = saisie.trim();
    if (!texte || envoi) return;
    setEnvoi(true);
    try {
      const r = await apiFetch("/api/enigme/repondre", {
        method: "POST",
        body: JSON.stringify({ reponse: texte }),
      });
      setData(r);
      if (r.juste) {
        feedbackFin(true);
        setSaisie("");
      } else {
        feedbackMauvais();
        setRate(true);
        setTimeout(() => setRate(false), 450);
        champ.current?.focus();
      }
    } catch (e) { setErreur(e.message); }
    setEnvoi(false);
  }

  async function demanderIndice() {
    try {
      const r = await apiFetch("/api/enigme/indice", { method: "POST" });
      setData(r);
      feedbackBon();
    } catch (e) { setErreur(e.message); }
  }

  if (erreur && !data) {
    return (
      <div style={cardWrap}>
        <EnTete onNavigate={onNavigate} />
        <p style={{ color: COLORS.danger, fontSize: 13, lineHeight: 1.5 }}>{erreur}</p>
        <div style={{ height: 16 }} />
        <Button variant="secondary" onClick={() => onNavigate("home")}>Retour à l'accueil</Button>
      </div>
    );
  }
  if (!data) {
    return (
      <div style={cardWrap}>
        <EnTete onNavigate={onNavigate} />
        <p style={{ color: COLORS.muted, fontSize: 14 }}>Chargement…</p>
      </div>
    );
  }

  const dateLisible = new Date(data.date).toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <div style={cardWrap}>
      <EnTete onNavigate={onNavigate} />

      {/* Carte de l'énigme */}
      <div style={{
        borderRadius: 20, padding: "20px 18px", color: "#fff", marginBottom: 16,
        background: `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.accent2} 60%, ${COLORS.accent3})`,
        boxShadow: `0 14px 30px -18px ${COLORS.gold}8c`, animation: "sqrise .45s both",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{
            fontFamily: FONT_BODY, fontWeight: 800, fontSize: 10, letterSpacing: 1.5,
            textTransform: "uppercase", color: "rgba(255,255,255,.85)",
          }}>
            Énigme du {dateLisible}
          </span>
          <span style={{
            background: "rgba(255,255,255,.22)", borderRadius: 20, padding: "3px 10px",
            fontFamily: FONT_BODY, fontWeight: 800, fontSize: 10.5,
          }}>
            {data.categorie}
          </span>
        </div>
        <p style={{
          fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 19, lineHeight: 1.35, margin: 0,
        }}>
          {data.enigme}
        </p>
      </div>

      {/* Série de jours */}
      {data.serie?.current > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
          fontFamily: FONT_BODY, fontWeight: 800, fontSize: 12.5,
          color: data.serie.resolu_today ? COLORS.accent3 : COLORS.muted,
        }}>
          <Flame size={14} />
          {data.serie.current} jour{data.serie.current > 1 ? "s" : ""} d'affilée
          <span style={{ color: COLORS.muted, fontWeight: 700 }}>· record {data.serie.best}</span>
        </div>
      )}

      {/* Trouvé */}
      {data.trouve ? (
        <div style={{
          background: tint(COLORS.success, 10), border: `1.5px solid ${COLORS.success}`,
          borderRadius: 18, padding: 16, marginBottom: 18, animation: "sqpop .4s both",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
            <Check size={18} color={COLORS.success} strokeWidth={3} />
            <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 17, color: COLORS.success }}>
              Trouvé
            </span>
            <span style={{ marginLeft: "auto", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 20, ...gradientText(120) }}>
              {data.points} pts
            </span>
          </div>
          <p style={{ fontSize: 14, color: COLORS.text, margin: 0, fontWeight: 700 }}>
            {data.reponse}
          </p>
          <p style={{ fontSize: 12, color: COLORS.muted, margin: "6px 0 0" }}>
            {data.indices.length > 0
              ? `${data.indices.length} indice${data.indices.length > 1 ? "s" : ""} utilisé${data.indices.length > 1 ? "s" : ""}`
              : "Sans aucun indice"}
            {data.erreurs > 0 ? ` · ${data.erreurs} erreur${data.erreurs > 1 ? "s" : ""}` : ""}
          </p>
        </div>
      ) : (
        <>
          {/* Saisie */}
          <div style={{ display: "flex", gap: 8, marginBottom: 10, animation: rate ? "sqshake .4s both" : "none" }}>
            <input
              ref={champ}
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") proposer(); }}
              placeholder="Ta réponse…"
              style={inputStyle({ flex: 1, fontSize: 15 })}
            />
            <button
              onClick={proposer}
              disabled={!saisie.trim() || envoi}
              aria-label="Valider"
              style={{
                background: saisie.trim() ? gradient(110) : COLORS.cardAlt,
                color: saisie.trim() ? "#fff" : COLORS.muted,
                border: "none", borderRadius: 14, padding: "0 18px", cursor: saisie.trim() ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center",
              }}
            >
              <Send size={17} />
            </button>
          </div>

          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            fontFamily: FONT_BODY, fontSize: 12, color: COLORS.muted, marginBottom: 18,
          }}>
            <span>
              {data.erreurs > 0 ? `${data.erreurs} tentative${data.erreurs > 1 ? "s" : ""}` : "Aucune tentative"}
            </span>
            <span style={{ fontWeight: 800, color: COLORS.gold }}>
              {data.points_possibles} points en jeu
            </span>
          </div>

          {/* Indices */}
          {data.indices.map((ind, i) => (
            <div key={i} style={{
              display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", marginBottom: 8,
              background: COLORS.card, border: `1px solid ${COLORS.cardAlt}`, borderRadius: 14,
              animation: "sqrise .3s both",
            }}>
              <Lightbulb size={15} color={COLORS.accent3} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 13.5, lineHeight: 1.45, color: COLORS.text }}>{ind}</span>
            </div>
          ))}

          {data.indices_restants > 0 && (
            <button
              onClick={demanderIndice}
              style={{
                width: "100%", background: "transparent", border: `1.5px dashed ${COLORS.cardAlt}`,
                borderRadius: 14, padding: 13, cursor: "pointer", marginTop: 4,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                fontFamily: FONT_BODY, fontWeight: 800, fontSize: 13, color: COLORS.muted,
              }}
            >
              <Lightbulb size={14} />
              Demander un indice (−20 points) · {data.indices_restants} restant{data.indices_restants > 1 ? "s" : ""}
            </button>
          )}
        </>
      )}

      {erreur && <p style={{ color: COLORS.danger, fontSize: 13, marginTop: 10 }}>{erreur}</p>}

      {/* Classement du jour */}
      <p style={sectionLabel}>
        Ils ont trouvé
        <span style={{ color: COLORS.muted, fontWeight: 400, marginLeft: 6 }}>
          {data.trouvee}/{data.tentatives}
        </span>
      </p>
      {data.classement.length === 0 ? (
        <p style={{ fontSize: 13, color: COLORS.muted }}>
          Personne pour l'instant. À toi de jouer.
        </p>
      ) : (
        data.classement.map((r, i) => (
          <div key={r.pseudo} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 14,
            marginBottom: 6,
            background: r.pseudo === user?.pseudo ? tint(COLORS.gold, 8) : "transparent",
            border: `1px solid ${r.pseudo === user?.pseudo ? COLORS.gold : "transparent"}`,
            borderBottom: `1px solid ${r.pseudo === user?.pseudo ? COLORS.gold : COLORS.cardAlt}`,
          }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 13, color: COLORS.muted, width: 20 }}>
              {i + 1}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 14, color: COLORS.text }}>
                {r.pseudo}{r.pseudo === user?.pseudo ? " (toi)" : ""}
              </span>
              <span style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 11, color: COLORS.muted }}>
                {r.indices === 0 && r.erreurs === 0
                  ? "Du premier coup, sans indice"
                  : `${r.indices} indice${r.indices > 1 ? "s" : ""} · ${r.erreurs} erreur${r.erreurs > 1 ? "s" : ""}`}
              </span>
            </span>
            <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15, color: COLORS.gold }}>
              {r.points}
            </span>
          </div>
        ))
      )}

      {data.trouve && (
        <>
          <div style={{ height: 14 }} />
          <Button variant="secondary" onClick={() => onNavigate("home")}>Accueil</Button>
        </>
      )}
    </div>
  );
}

function EnTete({ onNavigate }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "2px 0 18px" }}>
      <button
        onClick={() => onNavigate("home")}
        aria-label="Retour"
        style={{
          width: 36, height: 36, borderRadius: 11, background: COLORS.soft, border: "none",
          color: COLORS.muted2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <ChevronLeft size={18} />
      </button>
      <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 24, margin: 0, color: COLORS.text }}>
        Énigme du jour
      </h2>
    </div>
  );
}
