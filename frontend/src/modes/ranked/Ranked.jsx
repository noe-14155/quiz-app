import { useState, useEffect, useRef } from "react";
import { SkipForward, Check, X, Trophy } from "lucide-react";
import { cardWrap, COLORS, FONT_DISPLAY, FONT_BODY, tierInfo, tint, rankGradient, RANKS } from "../../design/theme";
import TopBar from "../../components/TopBar";
import Button from "../../components/Button";
import AnswerGrid from "../../components/AnswerGrid";
import QuitConfirmModal from "../../components/QuitConfirmModal";
import SearchLink from "../../components/SearchLink";
import QuizHeader, { QuizTopLine, QuizQuestion, Explanation } from "../../components/QuizHeader";
import BigScore from "../../components/BigScore";
import PageTitle from "../../components/PageTitle";
import Collapsible from "../../components/Collapsible";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

// Repli uniquement : les vraies valeurs viennent du serveur (/api/ranked/rules),
// qui les lit des réglages d'administration.
const DEFAULT_TIME_PER_QUESTION = 15;

function RankBadge({ tier, points, progress }) {
  const t = tierInfo(tier);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14, background: COLORS.card,
      border: `1px solid ${COLORS.cardAlt}`, borderRadius: 18, padding: 16,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 15, background: rankGradient(t.rank), flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 16, color: "#fff",
      }}>{t.palierLabel}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 800, margin: 0, color: COLORS.text }}>
            {t.rank.name} {t.palierLabel}
          </p>
          <p style={{ fontSize: 12, color: COLORS.gold, margin: 0, fontWeight: 800 }}>{points} pts</p>
        </div>
        <div style={{ height: 6, borderRadius: 4, background: COLORS.cardAlt, marginTop: 6, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: rankGradient(t.rank) }} />
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
  const [rules, setRules] = useState(null);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_TIME_PER_QUESTION);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [quitOpen, setQuitOpen] = useState(false);
  // Nombre de bonnes réponses de la partie, pour l'écran de résultats.
  const [correctCount, setCorrectCount] = useState(0);
  const timerRef = useRef(null);
  const tpq = rules?.time_per_question || DEFAULT_TIME_PER_QUESTION;

  // Charge les règles réellement appliquées dès l'écran de présentation.
  useEffect(() => {
    if (screen !== "ranked-setup" || !user) return;
    apiFetch("/api/ranked/rules").then(setRules).catch(() => {});
  }, [screen, user]);

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
      setCorrectCount(0);
      setIndex(0);
      setAnswered(null);
      setReveal(null);
      setTimeLeft(result.time_per_question || DEFAULT_TIME_PER_QUESTION);
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
      if (result.correct) setCorrectCount((n) => n + 1);
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
      setTimeLeft(tpq);
    }
  }

  function quitToHome() {
    setQuitOpen(false);
    setPhase("setup");
    onNavigate("home");
  }

  if (screen === "ranked-setup") {
    return (
      <div style={cardWrap}>
        <TopBar screen="ranked-setup" onNavigate={onNavigate} />
        <PageTitle subtitle="Chrono, points et rang en jeu.">Mode classé</PageTitle>
        {user && <RankBadge tier={user.rank_tier} points={user.rank_points} progress={user.rank_progress} />}
        <div style={{
          background: COLORS.card, border: `1px solid ${COLORS.cardAlt}`, borderRadius: 18,
          padding: 16, margin: "18px 0",
        }}>
          {[
            [`${rules?.nb_questions || 10} questions`, `${tpq}s chacune`, COLORS.muted],
            ["Bonne réponse", `+${rules?.gain_if_correct ?? "…"} pts`, COLORS.success],
            ["Mauvaise réponse", `−${rules?.loss_if_wrong ?? "…"} pts`, COLORS.danger],
            rules?.can_pass !== false
              ? ["Passer une question", `−${rules?.loss_if_pass ?? "…"} pts`, COLORS.muted]
              : ["Passer une question", "Interdit à ton rang", COLORS.danger],
          ].map(([label, value, color], i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "9px 0", borderBottom: i < 3 ? `1px solid ${COLORS.cardAlt}` : "none",
              fontFamily: FONT_BODY, fontWeight: 800, fontSize: 13.5, color: COLORS.text,
            }}>
              <span>{label}</span>
              <span style={{ color }}>{value}</span>
            </div>
          ))}
        </div>

        {rules?.scale && (
          <div style={{ marginBottom: 20 }}>
            <Collapsible title="Barème par rang">
              <div style={{ background: COLORS.card, borderRadius: 12, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", padding: "8px 12px", fontSize: 11, fontWeight: 700, color: COLORS.muted, borderBottom: `1px solid ${COLORS.cardAlt}` }}>
                  <span>Rang</span>
                  <span style={{ textAlign: "right", color: COLORS.success }}>Bonne</span>
                  <span style={{ textAlign: "right", color: COLORS.danger }}>Mauvaise</span>
                  <span style={{ textAlign: "center" }}>Passer</span>
                </div>
                {rules.scale.map((row) => {
                  const isCurrent = rules.current_rank ? row.rank === rules.current_rank : false;
                  return (
                    <div key={row.rank} style={{
                      display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", padding: "7px 12px", fontSize: 12,
                      borderBottom: `1px solid ${COLORS.cardAlt}`,
                      background: isCurrent ? tint(COLORS.gold, 10) : "transparent",
                    }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 800, color: COLORS.text }}>
                        <span style={{
                          width: 9, height: 9, borderRadius: 3, flexShrink: 0,
                          background: rankGradient(RANKS.find((r) => r.name === row.rank) || RANKS[0]),
                        }} />
                        {row.rank}
                      </span>
                      <span style={{ textAlign: "right", color: COLORS.success, fontWeight: 700 }}>+{row.gain}</span>
                      <span style={{ textAlign: "right", color: COLORS.danger, fontWeight: 700 }}>−{row.loss}</span>
                      <span style={{ display: "flex", justifyContent: "center", color: row.can_pass ? COLORS.muted : COLORS.danger }}>
                        {row.can_pass ? <Check size={14} /> : <X size={14} />}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize: 11, color: COLORS.muted, margin: "8px 2px 0", lineHeight: 1.5 }}>
                Plus tu montes, moins tu gagnes et plus tu perds. Passer devient impossible à partir de Génie.
                {rules.daily_decay ? ` À partir de Génie III, tu perds ${rules.daily_decay} points par jour d'inactivité (sans jamais retomber sous Génie).` : ""}
              </p>
            </Collapsible>
          </div>
        )}
        {error && <p style={{ color: COLORS.danger, fontSize: 13, margin: "0 0 12px" }}>{error}</p>}
        <Button onClick={start} disabled={loading}>
          {loading ? "Chargement..." : "Lancer une partie classée"}
        </Button>
        <button
          onClick={() => onNavigate("leaderboard")}
          style={{
            width: "100%", marginTop: 10, background: COLORS.soft, border: "none", borderRadius: 16,
            padding: 15, fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15, color: COLORS.text,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          <Trophy size={16} /> Voir le classement
        </button>
      </div>
    );
  }

  if (screen === "ranked-quiz") {
    const q = pool[index];
    const timePct = (timeLeft / tpq) * 100;
    return (
      <div style={cardWrap}>
        {quitOpen && <QuitConfirmModal onCancel={() => setQuitOpen(false)} onConfirm={quitToHome} />}
        <TopBar screen="ranked-quiz" onNavigate={onNavigate} onRequestQuit={() => setQuitOpen(true)} />
        <QuizTopLine index={index} total={pool.length} />
        <QuizHeader
          index={index}
          total={pool.length}
          rightLabel={`${timeLeft}s`}
          rightDanger={timeLeft <= 5}
          progressPct={Math.max(0, timePct)}
          tags={[
            { label: q.theme, color: COLORS.gold },
            {
              label: rules
                ? `+${rules.gain_if_correct} / −${rules.loss_if_wrong}`
                : `Niveau ${q.difficulte}`,
              color: COLORS.accent3,
            },
          ]}
        />
        <QuizQuestion>{q.question}</QuizQuestion>

        <AnswerGrid choix={q.choix} answered={answered === -1 ? -1 : answered} correctIndex={reveal ? reveal.bonne_reponse - 1 : null} onPick={answerQuestion} revealCorrectness={reveal !== null} />

        {answered === null && rules?.can_pass !== false && (
          <button
            onClick={pass}
            style={{
              width: "100%", marginTop: 14, background: "transparent",
              border: `1.5px dashed ${COLORS.cardAlt}`, color: COLORS.muted, borderRadius: 14,
              padding: 12, fontFamily: FONT_BODY, fontWeight: 800, fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <SkipForward size={14} /> Passer{rules?.loss_if_pass ? ` (−${rules.loss_if_pass} pts)` : ""}
          </button>
        )}

        {reveal && (
          <>
            <Explanation
              ok={reveal.delta_points >= 0}
              title={`${reveal.correct ? "Bonne réponse" : (answered === -1 ? "Passée" : "Raté")} · ${reveal.delta_points >= 0 ? "+" : ""}${reveal.delta_points} pts`}
              correctAnswer={reveal.correct ? null : q.choix[reveal.bonne_reponse - 1]}
              text={reveal.explication}
            >
              <div style={{ marginTop: 10 }}>
                <SearchLink question={q.question} reponse={q.choix[reveal.bonne_reponse - 1]} />
              </div>
            </Explanation>
            <div style={{ height: 14 }} />
            <Button onClick={next}>
              {index + 1 >= pool.length ? "Voir les résultats" : "Question suivante"}
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={cardWrap}>
      <TopBar screen="ranked-results" onNavigate={onNavigate} />
      <BigScore
        score={correctCount}
        total={pool.length}
        label="Partie classée"
        subtitle={user ? `${user.rank_points} points au total` : null}
      />
      {user && <RankBadge tier={user.rank_tier} points={user.rank_points} progress={user.rank_progress} />}
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <Button variant="secondary" onClick={() => onNavigate("home")} style={{ flex: 1 }}>Accueil</Button>
        <Button onClick={() => onNavigate("ranked-setup")} style={{ flex: 1 }}>Rejouer</Button>
      </div>
    </div>
  );
}
