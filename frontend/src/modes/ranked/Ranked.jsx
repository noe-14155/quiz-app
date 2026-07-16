import { useState, useEffect, useRef } from "react";
import { Clock, SkipForward } from "lucide-react";
import { cardWrap, COLORS, FONT_DISPLAY, tierInfo } from "../../design/theme";
import TopBar from "../../components/TopBar";
import Button from "../../components/Button";
import AnswerGrid from "../../components/AnswerGrid";
import QuitConfirmModal from "../../components/QuitConfirmModal";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

const TIME_PER_QUESTION = 15;

function RankBadge({ tier, points }) {
  const t = tierInfo(tier);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, background: COLORS.card, borderRadius: 14, padding: 16 }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: t.rank.color, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 700, margin: 0 }}>{t.rank.name} {t.palierLabel}</p>
        <div style={{ height: 6, borderRadius: 3, background: COLORS.cardAlt, marginTop: 6, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${points}%`, background: t.rank.color }} />
        </div>
      </div>
    </div>
  );
}

export default function Ranked({ screen, onNavigate }) {
  const { user, refreshProfile } = useAuth();
  const [phase, setPhase] = useState("setup");
  const [partyId, setPartyId] = useState(null);
  const [pool, setPool] = useState([]);
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState(null);
  const [reveal, setReveal] = useState(null);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_QUESTION);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [quitOpen, setQuitOpen] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (phase !== "quiz" || answered !== null) {
      clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          answerQuestion(null); // temps écoulé = équivalent d'une réponse fausse
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, index, answered]);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch("/api/ranked/start", { method: "POST" });
      setPartyId(result.party_id);
      setPool(result.questions);
      setIndex(0);
      setAnswered(null);
      setReveal(null);
      setTimeLeft(TIME_PER_QUESTION);
      setPhase("quiz");
      onNavigate("ranked-quiz");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function answerQuestion(choiceIdx) {
    if (answered !== null) return;
    setAnswered(choiceIdx === null ? -1 : choiceIdx);
    const q = pool[index];
    try {
      const result = await apiFetch("/api/ranked/answer", {
        method: "POST",
        body: JSON.stringify({ party_id: partyId, question_id: q.id, choice: choiceIdx }),
      });
      setReveal(result);
      await refreshProfile();
    } catch (e) {
      setError(e.message);
    }
  }

  function pass() {
    answerQuestion(null);
  }

  function next() {
    if (index + 1 >= pool.length) {
      setPhase("results");
      onNavigate("ranked-results");
    } else {
      setIndex((i) => i + 1);
      setAnswered(null);
      setReveal(null);
      setTimeLeft(TIME_PER_QUESTION);
    }
  }

  function quitToHome() {
    setQuitOpen(false);
    setPhase("setup");
    onNavigate("home");
  }

  if (phase === "setup" || screen === "ranked-setup") {
    return (
      <div style={cardWrap}>
        <TopBar screen="ranked-setup" onNavigate={onNavigate} />
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 700, margin: "0 0 16px" }}>Mode classé</h2>
        {user && <RankBadge tier={user.rank_tier} points={user.rank_points} />}
        <ul style={{ fontSize: 13, color: COLORS.muted, margin: "20px 0", paddingLeft: 18, lineHeight: 1.8 }}>
          <li>10 questions, {TIME_PER_QUESTION}s chacune</li>
          <li>Bonne réponse : +12 points</li>
          <li>Mauvaise réponse : le malus augmente avec ton rang</li>
          <li>Passer une question coûte moins cher qu'une mauvaise réponse</li>
        </ul>
        {error && <p style={{ color: COLORS.danger, fontSize: 13, margin: "0 0 12px" }}>{error}</p>}
        <Button onClick={start} disabled={loading} style={{ width: "100%" }}>
          {loading ? "Chargement..." : "Lancer une partie classée"}
        </Button>
      </div>
    );
  }

  if (phase === "quiz") {
    const q = pool[index];
    const timePct = (timeLeft / TIME_PER_QUESTION) * 100;
    return (
      <div style={cardWrap}>
        {quitOpen && <QuitConfirmModal onCancel={() => setQuitOpen(false)} onConfirm={quitToHome} />}
        <TopBar screen="ranked-quiz" onNavigate={onNavigate} onRequestQuit={() => setQuitOpen(true)} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: COLORS.muted, fontWeight: 700 }}>Question {index + 1} / {pool.length}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: timeLeft <= 5 ? COLORS.danger : COLORS.muted }}>
            <Clock size={14} /><span style={{ fontSize: 13, fontWeight: 700 }}>{timeLeft}s</span>
          </div>
        </div>
        <div style={{ height: 5, borderRadius: 3, background: COLORS.cardAlt, marginBottom: 18, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.max(0, timePct)}%`, background: timeLeft <= 5 ? COLORS.danger : COLORS.gold, transition: "width 1s linear" }} />
        </div>
        <p style={{ fontSize: 12, color: COLORS.gold, fontWeight: 700, margin: "0 0 8px", textTransform: "uppercase" }}>{q.theme}</p>
        <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 700, lineHeight: 1.35, margin: "0 0 20px" }}>{q.question}</h3>

        <AnswerGrid choix={q.choix} answered={answered === -1 ? -1 : answered} correctIndex={reveal ? reveal.bonne_reponse - 1 : null} onPick={answerQuestion} revealCorrectness={reveal !== null} />

        {answered === null && (
          <button onClick={pass} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: COLORS.muted, cursor: "pointer", fontWeight: 700, fontSize: 13, margin: "8px auto 0" }}>
            <SkipForward size={14} /> Passer
          </button>
        )}

        {reveal && (
          <>
            <div style={{ background: COLORS.card, borderRadius: 14, padding: 16, margin: "16px 0" }}>
              <p style={{ margin: "0 0 8px", fontSize: 14, lineHeight: 1.6, color: COLORS.muted }}>{reveal.explication}</p>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: reveal.delta_points >= 0 ? COLORS.success : COLORS.danger }}>
                {reveal.delta_points >= 0 ? "+" : ""}{reveal.delta_points} points
              </p>
            </div>
            <Button onClick={next} style={{ width: "100%" }}>
              {index + 1 >= pool.length ? "Voir les résultats" : "Suivant"}
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={cardWrap}>
      <TopBar screen="ranked-results" onNavigate={onNavigate} />
      <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 700, margin: "0 0 18px", textAlign: "center" }}>Partie terminée</h2>
      {user && <RankBadge tier={user.rank_tier} points={user.rank_points} />}
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <Button variant="secondary" onClick={() => onNavigate("home")} style={{ flex: 1 }}>Accueil</Button>
        <Button onClick={() => setPhase("setup")} style={{ flex: 1 }}>Rejouer</Button>
      </div>
    </div>
  );
}
