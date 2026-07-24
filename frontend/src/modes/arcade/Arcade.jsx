import { useState, useEffect, useRef } from "react";
import { ChevronLeft, Flame, Timer, Trophy } from "lucide-react";
import {
  cardWrap, COLORS, FONT_DISPLAY, FONT_BODY, gradient, gradientText, sectionLabel, tint,
} from "../../design/theme";
import AnswerGrid from "../../components/AnswerGrid";
import TimerBar from "../../components/TimerBar";
import Button from "../../components/Button";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { feedbackBon, feedbackMauvais, feedbackFin, feedbackUrgence } from "../../design/feedback";

const CHRONO_DUREE = 60;

/**
 * Deux modes courts qui partagent le même écran de jeu :
 *  - Survie : on enchaîne jusqu'à la première erreur, la difficulté monte ;
 *  - Contre-la-montre : 60 secondes, un maximum de bonnes réponses.
 *
 * Les questions sont servies par lots pour qu'aucun aller-retour réseau ne
 * vienne casser le rythme — ce qui serait fatal au chronomètre.
 */
export default function Arcade({ screen, onNavigate }) {
  const { user } = useAuth();
  const mode = screen === "survie" ? "survie" : "chrono";
  const [phase, setPhase] = useState("intro");
  const [pool, setPool] = useState([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(null);
  const [temps, setTemps] = useState(CHRONO_DUREE);
  const [records, setRecords] = useState(null);
  const [resultat, setResultat] = useState(null);
  // Incrémenté à chaque partie : relance l'animation du chrono.
  const [manche, setManche] = useState(0);
  const [erreur, setErreur] = useState(null);
  const finRef = useRef(() => {});

  useEffect(() => {
    apiFetch("/api/arcade/records").then(setRecords).catch(() => {});
  }, []);

  // Chronomètre du contre-la-montre.
  useEffect(() => {
    if (phase !== "jeu" || mode !== "chrono") return;
    const debut = Date.now();
    const t = setInterval(() => {
      const reste = CHRONO_DUREE - Math.floor((Date.now() - debut) / 1000);
      setTemps(Math.max(0, reste));
      if (reste <= 5 && reste > 0) feedbackUrgence();
      if (reste <= 0) {
        clearInterval(t);
        finRef.current();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [phase, mode]);

  async function demarrer() {
    setErreur(null);
    try {
      const url = mode === "survie"
        ? "/api/arcade/survie/questions?palier=0"
        : "/api/arcade/chrono/questions";
      const r = await apiFetch(url);
      setPool(r.questions);
      setIndex(0); setScore(0); setAnswered(null);
      setTemps(CHRONO_DUREE);
      setManche((n) => n + 1);
      setPhase("jeu");
    } catch (e) { setErreur(e.message); }
  }

  async function terminer(scoreFinal) {
    setPhase("fin");
    feedbackFin(scoreFinal > 0);
    try {
      const r = await apiFetch("/api/arcade/finish", {
        method: "POST",
        body: JSON.stringify({ mode, score: scoreFinal }),
      });
      setResultat(r);
      apiFetch("/api/arcade/records").then(setRecords).catch(() => {});
    } catch (e) { setResultat({ score: scoreFinal, record: null, nouveau_record: false }); }
  }
  finRef.current = () => terminer(score);

  async function repondre(choix) {
    if (answered !== null) return;
    const q = pool[index];
    const bon = choix === q.bonne_reponse - 1;
    setAnswered(choix);
    bon ? feedbackBon() : feedbackMauvais();

    if (mode === "survie" && !bon) {
      setTimeout(() => terminer(score), 700);
      return;
    }
    const nouveauScore = bon ? score + 1 : score;
    setScore(nouveauScore);

    setTimeout(async () => {
      setAnswered(null);
      const suivant = index + 1;
      if (suivant < pool.length) {
        setIndex(suivant);
      } else if (mode === "survie") {
        // Lot suivant : la difficulté repart d'où on en est.
        try {
          const r = await apiFetch(`/api/arcade/survie/questions?palier=${nouveauScore}`);
          setPool(r.questions); setIndex(0);
        } catch (e) { terminer(nouveauScore); }
      } else {
        terminer(nouveauScore);
      }
    }, bon ? 380 : 700);
  }


  /** Meilleurs scores de tous les temps sur ce mode. */
  function TopDuJour() {
    const jour = records?.[mode]?.top || [];
    return (
      <>
        <p style={sectionLabel}>Meilleurs scores</p>
        {jour.length === 0 ? (
          <p style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.5 }}>
            Aucun score enregistré. Le premier prend la tête.
          </p>
        ) : (
          jour.map((t, i) => {
            const moi = user && t.pseudo === user.pseudo;
            const medaille = ["#FFC94D", "#C3CBD3", "#D9A066"][i];
            return (
              <div key={t.pseudo} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 14,
                background: moi ? tint(COLORS.gold, 8) : "transparent",
                border: `1px solid ${moi ? COLORS.gold : "transparent"}`,
                borderBottom: !moi && i < jour.length - 1 ? `1px solid ${COLORS.cardAlt}` : undefined,
              }}>
                <span style={{
                  width: 26, height: 26, borderRadius: 9, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: i < 3 ? medaille : "transparent",
                  color: i < 3 ? "#fff" : COLORS.muted,
                  fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 13,
                }}>
                  {i + 1}
                </span>
                <span style={{ flex: 1, fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15, color: COLORS.text }}>
                  {t.pseudo}{moi ? <span style={{ color: COLORS.gold }}> (toi)</span> : null}
                </span>
                <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15, color: COLORS.text }}>
                  {t.score}
                </span>
              </div>
            );
          })
        )}
      </>
    );
  }

  const titre = mode === "survie" ? "Survie" : "Contre-la-montre";
  const Icone = mode === "survie" ? Flame : Timer;
  const perso = records?.[mode]?.perso;

  // ---------- Introduction ----------
  if (phase === "intro") {
    return (
      <div style={cardWrap}>
        <EnTete titre={titre} onNavigate={onNavigate} />
        <div style={{
          borderRadius: 20, padding: "20px 18px", color: "#fff", marginBottom: 18,
          background: gradient(135), boxShadow: `0 14px 30px -18px ${COLORS.gold}8c`,
        }}>
          <Icone size={26} />
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 20, margin: "8px 0 4px" }}>{titre}</p>
          <p style={{ fontSize: 13, lineHeight: 1.5, color: "rgba(255,255,255,.9)", margin: 0 }}>
            {mode === "survie"
              ? "Enchaîne les bonnes réponses. Une seule erreur et c'est fini. La difficulté monte à mesure que tu tiens."
              : "60 secondes, un maximum de bonnes réponses. Pas de pénalité en cas d'erreur : enchaîne vite."}
          </p>
        </div>

        {perso !== null && perso !== undefined && (
          <div style={{
            display: "flex", alignItems: "center", gap: 12, background: COLORS.card,
            border: `1px solid ${COLORS.cardAlt}`, borderRadius: 16, padding: 14, marginBottom: 16,
          }}>
            <Trophy size={18} color={COLORS.gold} />
            <span style={{ flex: 1, fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, color: COLORS.text }}>
              Ton record
            </span>
            <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 20, color: COLORS.gold }}>
              {perso}
            </span>
          </div>
        )}

        {erreur && <p style={{ color: COLORS.danger, fontSize: 13, marginBottom: 12 }}>{erreur}</p>}
        <Button onClick={demarrer}>Commencer</Button>

        <TopDuJour />
      </div>
    );
  }

  // ---------- Fin ----------
  if (phase === "fin") {
    return (
      <div style={cardWrap}>
        <EnTete titre={titre} onNavigate={onNavigate} />
        <div style={{ textAlign: "center", paddingTop: 26, marginBottom: 24 }}>
          <p style={{ ...sectionLabel, margin: 0 }}>
            {mode === "survie" ? "Questions enchaînées" : "Bonnes réponses"}
          </p>
          <div style={{
            fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 92, lineHeight: 1, margin: "6px 0",
            ...gradientText(120), animation: "sqpop .55s both",
          }}>
            {resultat?.score ?? score}
          </div>
          {resultat?.nouveau_record && (
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 18, color: COLORS.gold, margin: 0 }}>
              Nouveau record
            </p>
          )}
          {resultat && !resultat.nouveau_record && resultat.record ? (
            <p style={{ fontSize: 13, color: COLORS.muted, margin: 0 }}>Ton record : {resultat.record}</p>
          ) : null}
        </div>
        <Button onClick={demarrer}>Rejouer</Button>
        <div style={{ height: 10 }} />
        <Button variant="secondary" onClick={() => onNavigate("home")}>Accueil</Button>
        <TopDuJour />
      </div>
    );
  }

  // ---------- Jeu ----------
  const q = pool[index];
  if (!q) return <div style={cardWrap}><p style={{ color: COLORS.muted }}>Chargement…</p></div>;

  return (
    <div style={cardWrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "2px 0 14px" }}>
        <button
          onClick={() => terminer(score)}
          style={{
            display: "flex", alignItems: "center", gap: 6, background: COLORS.soft, border: "none",
            borderRadius: 12, padding: "8px 13px", color: COLORS.muted2, cursor: "pointer",
            fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13,
          }}
        >
          Arrêter
        </button>
        <span style={{
          display: "flex", alignItems: "center", gap: 6,
          fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 17,
          color: mode === "chrono" && temps <= 10 ? COLORS.danger : COLORS.text,
        }}>
          {mode === "survie"
            ? <><Flame size={15} color={COLORS.accent3} /> {score}</>
            : <><Timer size={15} /> {temps}s</>}
        </span>
      </div>

      {mode === "chrono" && (
        <TimerBar duree={CHRONO_DUREE} cle={`manche-${manche}`}
                  danger={temps <= 10} style={{ marginBottom: 18 }} />
      )}

      <div style={{ display: "flex", gap: 7, marginBottom: 12 }}>
        <span style={{
          borderRadius: 20, padding: "5px 12px", fontFamily: FONT_BODY, fontWeight: 800, fontSize: 11,
          letterSpacing: 1, textTransform: "uppercase",
          background: tint(COLORS.gold, 12), color: COLORS.gold,
        }}>
          {q.theme}
        </span>
        {mode === "chrono" && (
          <span style={{
            borderRadius: 20, padding: "5px 12px", fontFamily: FONT_BODY, fontWeight: 800, fontSize: 11,
            letterSpacing: 1, textTransform: "uppercase",
            background: tint(COLORS.success, 12), color: COLORS.success,
          }}>
            {score} trouvée{score > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <h3 style={{
        fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 22, lineHeight: 1.22,
        margin: "0 0 20px", color: COLORS.text, animation: "sqrise .3s both",
      }}>
        {q.question}
      </h3>

      <AnswerGrid
        choix={q.choix}
        answered={answered}
        correctIndex={answered !== null ? q.bonne_reponse - 1 : null}
        onPick={repondre}
        revealCorrectness={answered !== null}
      />
    </div>
  );
}

function EnTete({ titre, onNavigate }) {
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
        {titre}
      </h2>
    </div>
  );
}
