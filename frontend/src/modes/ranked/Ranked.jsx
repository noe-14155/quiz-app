import { useState, useEffect, useRef } from "react";
import { SkipForward } from "lucide-react";
import { cardWrap, COLORS, FONT_DISPLAY, FONT_BODY, tierInfo, tint, rankGradient, RANKS } from "../../design/theme";
import TopBar from "../../components/TopBar";
import Button from "../../components/Button";
import AnswerGrid from "../../components/AnswerGrid";
import QuitConfirmModal from "../../components/QuitConfirmModal";
import SearchLink from "../../components/SearchLink";
import ReportButton from "../../components/ReportButton";
import QuizHeader, { QuizTopLine, QuizQuestion, Explanation } from "../../components/QuizHeader";
import BigScore from "../../components/BigScore";
import PageTitle from "../../components/PageTitle";
import Collapsible from "../../components/Collapsible";
import RankLadder from "../../components/RankLadder";
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
  const [ladder, setLadder] = useState(null);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_TIME_PER_QUESTION);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [quitOpen, setQuitOpen] = useState(false);
  // Nombre de bonnes réponses de la partie, pour l'écran de résultats.
  const [correctCount, setCorrectCount] = useState(0);
  // Somme des points gagnés/perdus sur la partie : c'est le bilan que le
  // joueur attend, maintenant que le barème n'est plus affiché à l'avance.
  const [deltaTotal, setDeltaTotal] = useState(null);
  const timerRef = useRef(null);
  const tpq = rules?.time_per_question || DEFAULT_TIME_PER_QUESTION;

  // Charge les règles réellement appliquées dès l'écran de présentation.
  useEffect(() => {
    if (screen !== "ranked-setup" || !user) return;
    apiFetch("/api/ranked/rules").then(setRules).catch(() => {});
    // L'échelle des rangs se consulte ici (elle a quitté l'onglet Classement).
    apiFetch("/api/ranked/ladder").then(setLadder).catch(() => {});
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
      setDeltaTotal(null);
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
      setDeltaTotal((d) => (d ?? 0) + result.delta_points);
      await refreshProfile();
    } catch (e) {
      setError(e.message);
    }
  }

  function pass() {
    answerQuestion(null);
  }

  const [newAchievements, setNewAchievements] = useState([]);

  async function next() {
    if (index + 1 >= pool.length) {
      setPhase("results");
      onNavigate("ranked-results");
      // Fin de partie : consolide le score et débloque les succès éventuels.
      try {
        const r = await apiFetch("/api/ranked/finish", {
          method: "POST",
          body: JSON.stringify({ party_id: partyId, correct: correctCount, total: pool.length }),
        });
        setNewAchievements(r.achievements || []);
      } catch (e) { /* sans incidence sur la partie */ }
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
        {newAchievements.length > 0 && (
        <div style={{
          background: tint(COLORS.gold, 10), border: `1.5px solid ${COLORS.gold}`,
          borderRadius: 16, padding: 14, marginBottom: 14,
        }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 14, color: COLORS.gold, margin: "0 0 6px" }}>
            {newAchievements.length > 1 ? "Nouveaux succès" : "Nouveau succès"}
          </p>
          {newAchievements.map((a) => (
            <p key={a.code} style={{ fontSize: 13, color: COLORS.text, margin: "3px 0 0", fontWeight: 700 }}>
              {a.titre} <span style={{ color: COLORS.muted, fontWeight: 400 }}>— {a.description}</span>
            </p>
          ))}
        </div>
      )}
      {user && <RankBadge tier={user.rank_tier} points={user.rank_points} progress={user.rank_progress} />}
        {/* Progression + échelle : c'est ici que le rang se consulte désormais,
            le classement general n'affichant plus que le haut du tableau. */}
        {ladder && (
          <div style={{ marginTop: 18 }}>
            <Collapsible title="L'échelle des rangs">
              <RankLadder ladder={ladder.ladder} ranks={RANKS} />
              {ladder.next && (
                <p style={{ fontSize: 12.5, color: COLORS.muted, marginTop: 12, lineHeight: 1.5 }}>
                  Plus que {ladder.next.remaining.toLocaleString("fr-FR")} points avant {ladder.next.rank}.
                </p>
              )}
            </Collapsible>
          </div>
        )}

        <div style={{
          background: COLORS.card, border: `1px solid ${COLORS.cardAlt}`, borderRadius: 18,
          padding: 16, margin: "6px 0 18px",
        }}>
          <p style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: 13.5, color: COLORS.text, margin: "0 0 12px" }}>
            {rules?.nb_questions || 10} questions · {tpq} secondes chacune
          </p>

          {rules?.bareme && (
            <div style={{
              display: "flex", alignItems: "center", gap: 16, padding: "16px 18px",
              borderRadius: 16, background: tint(COLORS.gold, 8),
            }}>
              <span style={{
                fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 38, color: COLORS.gold,
                lineHeight: 0.9, flexShrink: 0,
              }}>
                {rules.bareme.sur_dix}
                <span style={{ fontSize: 18 }}>/10</span>
              </span>
              <span style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: 13, color: COLORS.muted2, lineHeight: 1.45 }}>
                Le niveau attendu à ton rang.<br />
                Au-dessus tu montes, en dessous tu chutes.
              </span>
            </div>
          )}
        </div>

        <Button onClick={start} disabled={loading}>
          {loading ? "Chargement..." : "Lancer une partie classée"}
        </Button>

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
            { label: `Niveau ${q.difficulte}`, color: COLORS.accent3 },
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
            <SkipForward size={14} /> Passer
          </button>
        )}

        {reveal && (
          <>
            <Explanation
              ok={reveal.delta_points >= 0}
              title={reveal.correct ? "Bonne réponse" : (answered === -1 ? "Passée" : "Raté")}
              correctAnswer={reveal.correct ? null : q.choix[reveal.bonne_reponse - 1]}
              text={reveal.explication}
            >
              <div style={{ marginTop: 10 }}>
                <SearchLink question={q.question} reponse={q.choix[reveal.bonne_reponse - 1]} />
                <ReportButton questionId={q.id} />
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
        subtitle={deltaTotal !== null
          ? `${deltaTotal >= 0 ? "+" : ""}${deltaTotal} points${user ? ` · ${user.rank_points.toLocaleString("fr-FR")} au total` : ""}`
          : (user ? `${user.rank_points.toLocaleString("fr-FR")} points au total` : null)}
      />
      {newAchievements.length > 0 && (
        <div style={{
          background: tint(COLORS.gold, 10), border: `1.5px solid ${COLORS.gold}`,
          borderRadius: 16, padding: 14, marginBottom: 14,
        }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 14, color: COLORS.gold, margin: "0 0 6px" }}>
            {newAchievements.length > 1 ? "Nouveaux succès" : "Nouveau succès"}
          </p>
          {newAchievements.map((a) => (
            <p key={a.code} style={{ fontSize: 13, color: COLORS.text, margin: "3px 0 0", fontWeight: 700 }}>
              {a.titre} <span style={{ color: COLORS.muted, fontWeight: 400 }}>— {a.description}</span>
            </p>
          ))}
        </div>
      )}
      {user && <RankBadge tier={user.rank_tier} points={user.rank_points} progress={user.rank_progress} />}
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <Button variant="secondary" onClick={() => onNavigate("home")} style={{ flex: 1 }}>Accueil</Button>
        <Button onClick={() => onNavigate("ranked-setup")} style={{ flex: 1 }}>Rejouer</Button>
      </div>
    </div>
  );
}
