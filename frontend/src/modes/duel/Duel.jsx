import { useState, useEffect } from "react";
import { ChevronLeft, Swords, Copy, Check, Clock } from "lucide-react";
import {
  cardWrap, COLORS, FONT_DISPLAY, FONT_BODY, gradient, gradientText, sectionLabel, tint,
} from "../../design/theme";
import AnswerGrid from "../../components/AnswerGrid";
import Button from "../../components/Button";
import { inputStyle } from "../../components/PageTitle";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { feedbackFin } from "../../design/feedback";

/**
 * Duel asynchrone : deux joueurs, les mêmes questions, mais chacun joue quand
 * il veut. Le résultat n'apparaît qu'une fois les deux passages faits.
 */
export default function Duel({ onNavigate }) {
  const { user } = useAuth();
  const [vue, setVue] = useState("accueil");   // accueil | jeu | resultat
  const [mesDuels, setMesDuels] = useState([]);
  const [code, setCode] = useState("");
  const [saisie, setSaisie] = useState("");
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [reponses, setReponses] = useState([]);
  const [answered, setAnswered] = useState(null);
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [copie, setCopie] = useState(false);

  useEffect(() => { charger(); }, []);

  async function charger() {
    try { setMesDuels((await apiFetch("/api/duel")).duels); } catch (e) { /* silencieux */ }
  }

  async function creer() {
    setErreur(null);
    try {
      const r = await apiFetch("/api/duel/create", { method: "POST" });
      setCode(r.code);
      await lancer(r.code);
    } catch (e) { setErreur(e.message); }
  }

  async function lancer(c) {
    setErreur(null);
    try {
      const r = await apiFetch(`/api/duel/${c}/questions`);
      setCode(c);
      setQuestions(r.questions);
      setReponses(new Array(r.questions.length).fill(null));
      setIndex(0); setAnswered(null);
      setVue("jeu");
    } catch (e) { setErreur(e.message); }
  }

  async function rejoindre() {
    const c = saisie.trim().toUpperCase();
    if (c.length < 4) return;
    await lancer(c);
  }

  function repondre(choix) {
    if (answered !== null) return;
    setAnswered(choix);
    const suite = [...reponses];
    suite[index] = choix;
    setReponses(suite);
    setTimeout(() => {
      if (index + 1 < questions.length) {
        setIndex(index + 1);
        setAnswered(null);
      } else {
        envoyer(suite);
      }
    }, 320);
  }

  async function envoyer(finales) {
    try {
      const r = await apiFetch(`/api/duel/${code}/submit`, {
        method: "POST",
        body: JSON.stringify({ answers: finales }),
      });
      setResultat(r);
      feedbackFin(r.score >= questions.length / 2);
      setVue("resultat");
      charger();
    } catch (e) { setErreur(e.message); setVue("accueil"); }
  }

  function copier() {
    try {
      navigator.clipboard.writeText(code);
      setCopie(true);
      setTimeout(() => setCopie(false), 1800);
    } catch (e) { /* certains navigateurs refusent hors HTTPS */ }
  }

  // ---------- Jeu ----------
  if (vue === "jeu") {
    const q = questions[index];
    if (!q) return <div style={cardWrap}><p style={{ color: COLORS.muted }}>Chargement…</p></div>;
    return (
      <div style={cardWrap}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "2px 0 14px" }}>
          <span style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: 12, color: COLORS.muted }}>
            Duel {code}
          </span>
          <span style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: 12, color: COLORS.muted }}>
            {index + 1} / {questions.length}
          </span>
        </div>
        <div style={{ height: 8, borderRadius: 5, background: COLORS.cardAlt, marginBottom: 18, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(index / questions.length) * 100}%`, background: gradient(90), transition: "width .25s" }} />
        </div>
        <span style={{
          display: "inline-block", borderRadius: 20, padding: "5px 12px", marginBottom: 12,
          fontFamily: FONT_BODY, fontWeight: 800, fontSize: 11, letterSpacing: 1, textTransform: "uppercase",
          background: tint(COLORS.gold, 12), color: COLORS.gold,
        }}>
          {q.theme}
        </span>
        <h3 style={{
          fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 22, lineHeight: 1.22,
          margin: "0 0 20px", color: COLORS.text, animation: "sqrise .3s both",
        }}>
          {q.question}
        </h3>
        <AnswerGrid choix={q.choix} answered={answered} onPick={repondre} revealCorrectness={false} />
        <p style={{ fontSize: 11, color: COLORS.muted, textAlign: "center", margin: "14px 0 0" }}>
          Les réponses sont dévoilées à la fin, comme pour ton adversaire.
        </p>
      </div>
    );
  }

  // ---------- Résultat ----------
  if (vue === "resultat" && resultat) {
    const moi = resultat.resultats?.find((r) => r.pseudo === user?.pseudo);
    const autre = resultat.resultats?.find((r) => r.pseudo !== user?.pseudo);
    let verdict = null;
    if (resultat.termine && moi && autre) {
      verdict = moi.score > autre.score ? "Tu gagnes" : moi.score < autre.score ? "Tu perds" : "Égalité";
    }
    return (
      <div style={cardWrap}>
        <EnTete titre="Duel" onNavigate={() => { setVue("accueil"); onNavigate("duel"); }} />
        <div style={{ textAlign: "center", paddingTop: 20, marginBottom: 22 }}>
          <p style={{ ...sectionLabel, margin: 0 }}>Ton score</p>
          <div style={{
            fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 84, lineHeight: 1, margin: "6px 0",
            ...gradientText(120), animation: "sqpop .55s both",
          }}>
            {resultat.score}<span style={{ fontSize: 36 }}>/{resultat.total}</span>
          </div>
          {verdict && (
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 22, color: COLORS.text, margin: 0 }}>
              {verdict}
            </p>
          )}
          {!resultat.termine && (
            <p style={{ fontSize: 13, color: COLORS.muted, margin: "6px 0 0", lineHeight: 1.5 }}>
              En attente de ton adversaire. Partage le code <b style={{ color: COLORS.gold }}>{code}</b> —
              le résultat s'affichera quand il aura joué.
            </p>
          )}
        </div>

        {resultat.termine && resultat.resultats && (
          <div style={{ marginBottom: 20 }}>
            {resultat.resultats.map((r) => (
              <div key={r.pseudo} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "11px 13px", borderRadius: 14, marginBottom: 7,
                background: r.pseudo === user?.pseudo ? tint(COLORS.gold, 8) : COLORS.card,
                border: `1px solid ${r.pseudo === user?.pseudo ? COLORS.gold : COLORS.cardAlt}`,
              }}>
                <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 14.5, color: COLORS.text }}>
                  {r.pseudo}{r.pseudo === user?.pseudo ? " (toi)" : ""}
                </span>
                <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 16, color: COLORS.gold }}>
                  {r.score}
                </span>
              </div>
            ))}
          </div>
        )}

        <Button variant="secondary" onClick={() => { setVue("accueil"); setResultat(null); }}>
          Retour aux duels
        </Button>
      </div>
    );
  }

  // ---------- Accueil des duels ----------
  return (
    <div style={cardWrap}>
      <EnTete titre="Duels" onNavigate={() => onNavigate("home")} />

      <div style={{
        borderRadius: 20, padding: "18px", color: "#fff", marginBottom: 18,
        background: gradient(135), boxShadow: `0 14px 30px -18px ${COLORS.gold}8c`,
      }}>
        <Swords size={24} />
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 19, margin: "8px 0 4px" }}>
          Défie un ami
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: "rgba(255,255,255,.9)", margin: 0 }}>
          Mêmes questions pour vous deux, mais chacun joue quand il veut. Le résultat s'affiche
          quand vous avez terminé tous les deux.
        </p>
      </div>

      {erreur && <p style={{ color: COLORS.danger, fontSize: 13, marginBottom: 12 }}>{erreur}</p>}

      <Button onClick={creer}>Créer un duel</Button>

      <p style={sectionLabel}>Rejoindre avec un code</p>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={saisie}
          onChange={(e) => setSaisie(e.target.value.toUpperCase())}
          placeholder="ABCDE"
          maxLength={5}
          style={inputStyle({ flex: 1, letterSpacing: 4, textAlign: "center", fontSize: 20 })}
        />
        <button
          onClick={rejoindre}
          disabled={saisie.trim().length < 4}
          style={{
            background: saisie.trim().length < 4 ? COLORS.cardAlt : gradient(110),
            color: saisie.trim().length < 4 ? COLORS.muted : "#fff",
            border: "none", borderRadius: 14, padding: "0 20px",
            fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15,
            cursor: saisie.trim().length < 4 ? "not-allowed" : "pointer",
          }}
        >
          Jouer
        </button>
      </div>

      {code && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginTop: 14, padding: "12px 14px",
          background: COLORS.card, border: `1px solid ${COLORS.cardAlt}`, borderRadius: 16,
        }}>
          <span style={{ flex: 1, fontFamily: FONT_BODY, fontSize: 13, color: COLORS.muted }}>
            Ton code à partager
          </span>
          <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 20, letterSpacing: 3, color: COLORS.text }}>
            {code}
          </span>
          <button onClick={copier} aria-label="Copier" style={{
            background: COLORS.soft, border: "none", borderRadius: 11, padding: 9,
            color: COLORS.text, cursor: "pointer", flexShrink: 0,
          }}>
            {copie ? <Check size={15} color={COLORS.success} /> : <Copy size={15} />}
          </button>
        </div>
      )}

      {mesDuels.length > 0 && (
        <>
          <p style={sectionLabel}>Mes duels</p>
          {mesDuels.map((d) => (
            <div key={d.code} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "11px 13px",
              borderRadius: 14, marginBottom: 7,
              background: COLORS.card, border: `1px solid ${COLORS.cardAlt}`,
              cursor: d.joue ? "default" : "pointer",
            }} onClick={() => { if (!d.joue) lancer(d.code); }}>
              <span style={{
                fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 13, letterSpacing: 2,
                color: COLORS.muted, width: 54,
              }}>
                {d.code}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 14, color: COLORS.text }}>
                  {d.adversaire || "En attente d'un adversaire"}
                </span>
                <span style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 11, color: COLORS.muted }}>
                  {!d.joue ? "À toi de jouer" : d.termine ? "Terminé" : "En attente de l'adversaire"}
                </span>
              </span>
              {d.termine ? (
                <span style={{
                  fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 14,
                  color: d.mon_score > d.score_adversaire ? COLORS.success
                       : d.mon_score < d.score_adversaire ? COLORS.danger : COLORS.muted,
                }}>
                  {d.mon_score} – {d.score_adversaire}
                </span>
              ) : (
                <Clock size={15} color={COLORS.muted} />
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function EnTete({ titre, onNavigate }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "2px 0 18px" }}>
      <button
        onClick={onNavigate}
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
