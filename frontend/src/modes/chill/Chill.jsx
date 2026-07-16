import { useState } from "react";
import { Star } from "lucide-react";
import { cardWrap, COLORS, FONT_DISPLAY } from "../../design/theme";
import TopBar from "../../components/TopBar";
import Button from "../../components/Button";
import AnswerGrid from "../../components/AnswerGrid";
import QuitConfirmModal from "../../components/QuitConfirmModal";
import { apiFetch } from "../../api/client";

const THEMES = [
  "Cinéma/Séries", "Géographie", "Histoire", "Pays", "Acteurs/Célébrités",
  "Anecdotes", "Sciences & Nature", "Sport", "Art & Littérature", "Gastronomie", "Technologie & Internet",
];

export default function Chill({ screen, onNavigate }) {
  const [phase, setPhase] = useState("setup"); // setup | quiz | results
  const [themes, setThemes] = useState(THEMES);
  const [diff, setDiff] = useState(3);
  const [nb, setNb] = useState(10);
  const [pool, setPool] = useState([]);
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState(null);
  const [reveal, setReveal] = useState(null); // { correct, bonne_reponse, explication }
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [quitOpen, setQuitOpen] = useState(false);

  function toggleTheme(t) {
    setThemes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch(
        `/api/chill/questions?themes=${encodeURIComponent(themes.join(","))}&difficulte_max=${diff}&nb=${nb}`
      );
      setPool(result.questions);
      setIndex(0);
      setScore(0);
      setAnswered(null);
      setReveal(null);
      setPhase("quiz");
      onNavigate("chill-quiz");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function pick(choiceIdx) {
    if (answered !== null) return;
    setAnswered(choiceIdx);
    const q = pool[index];
    try {
      const result = await apiFetch("/api/chill/answer", {
        method: "POST",
        body: JSON.stringify({ question_id: q.id, choice: choiceIdx, answer_text: q.choix[choiceIdx] }),
      });
      setReveal(result);
      if (result.correct) setScore((s) => s + 1);
    } catch (e) {
      setError(e.message);
    }
  }

  function next() {
    if (index + 1 >= pool.length) {
      setPhase("results");
      onNavigate("chill-results");
    } else {
      setIndex((i) => i + 1);
      setAnswered(null);
      setReveal(null);
    }
  }

  function quitToHome() {
    setQuitOpen(false);
    setPhase("setup");
    onNavigate("home");
  }

  if (phase === "setup" || screen === "chill-setup") {
    return (
      <div style={cardWrap}>
        <TopBar screen="chill-setup" onNavigate={onNavigate} />
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 700, margin: "0 0 4px" }}>Mode chill</h2>
        <p style={{ color: COLORS.muted, margin: "0 0 20px", fontSize: 14 }}>Choisis tes thèmes, la difficulté et le nombre de questions.</p>

        <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: 0.5 }}>Thèmes</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {THEMES.map((t) => {
            const active = themes.includes(t);
            return (
              <button key={t} onClick={() => toggleTheme(t)} style={{
                padding: "8px 16px", borderRadius: 999,
                border: active ? `2px solid ${COLORS.gold}` : `2px solid ${COLORS.cardAlt}`,
                background: active ? "rgba(59,130,246,0.12)" : COLORS.card,
                color: active ? COLORS.gold : COLORS.text, fontWeight: 700, fontSize: 13, cursor: "pointer",
              }}>{t}</button>
            );
          })}
        </div>

        <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: 0.5 }}>Difficulté</p>
        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setDiff(n)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
              <Star size={28} color={COLORS.gold} fill={n <= diff ? COLORS.gold : "none"} />
            </button>
          ))}
        </div>

        <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 10px" }}>
          Questions : <span style={{ color: COLORS.text, fontWeight: 700 }}>{nb}</span>
        </p>
        <input type="range" min={3} max={15} value={nb} onChange={(e) => setNb(Number(e.target.value))}
          style={{ width: "100%", accentColor: COLORS.gold, marginBottom: 20 }} />

        {error && <p style={{ color: COLORS.danger, fontSize: 13, margin: "0 0 12px" }}>{error}</p>}
        <Button onClick={start} disabled={themes.length === 0 || loading} style={{ width: "100%" }}>
          {loading ? "Chargement..." : "Commencer"}
        </Button>
      </div>
    );
  }

  if (phase === "quiz") {
    const q = pool[index];
    return (
      <div style={cardWrap}>
        {quitOpen && <QuitConfirmModal onCancel={() => setQuitOpen(false)} onConfirm={quitToHome} />}
        <TopBar screen="chill-quiz" onNavigate={onNavigate} onRequestQuit={() => setQuitOpen(true)} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontSize: 13, color: COLORS.muted, fontWeight: 700 }}>Question {index + 1} / {pool.length}</span>
          <div style={{ display: "flex", gap: 2 }}>
            {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={14} color={COLORS.gold} fill={n <= q.difficulte ? COLORS.gold : "none"} />)}
          </div>
        </div>
        <p style={{ fontSize: 12, color: COLORS.gold, fontWeight: 700, margin: "0 0 8px", textTransform: "uppercase" }}>{q.theme}</p>
        <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 700, lineHeight: 1.35, margin: "0 0 20px" }}>{q.question}</h3>

        <AnswerGrid choix={q.choix} answered={answered} correctIndex={reveal ? q.choix.indexOf(reveal.bonne_reponse_text) : null} onPick={pick} revealCorrectness={reveal !== null} />

        {reveal && (
          <>
            <div style={{ background: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: COLORS.muted }}>{reveal.explication}</p>
            </div>
            <Button onClick={next} style={{ width: "100%" }}>
              {index + 1 >= pool.length ? "Voir les résultats" : "Suivant"}
            </Button>
          </>
        )}
      </div>
    );
  }

  // results
  return (
    <div style={cardWrap}>
      <TopBar screen="chill-results" onNavigate={onNavigate} />
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 6px", textTransform: "uppercase" }}>Résultat</p>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 38, fontWeight: 700, margin: 0 }}>{score} / {pool.length}</h2>
      </div>
      <Button onClick={() => setPhase("setup")} style={{ width: "100%" }}>Rejouer</Button>
    </div>
  );
}
