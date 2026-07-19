import { useState, useEffect, useRef } from "react";
import { CalendarDays, Trophy, Check, X as XIcon } from "lucide-react";
import { cardWrap, COLORS, FONT_DISPLAY, FONT_BODY } from "../../design/theme";
import TopBar from "../../components/TopBar";
import Button from "../../components/Button";
import AnswerGrid from "../../components/AnswerGrid";
import SearchLink from "../../components/SearchLink";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

const TIME_PER_QUESTION = 15; // secondes par question, comme le mode classé

export default function Daily({ screen, onNavigate }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [answered, setAnswered] = useState(null);
  const [result, setResult] = useState(null); // résultat final après soumission
  const [timeLeft, setTimeLeft] = useState(TIME_PER_QUESTION);
  const [showReview, setShowReview] = useState(false);
  const answeredRef = useRef(false);
  const goNextRef = useRef(() => {});

  useEffect(() => {
    apiFetch("/api/daily/today").then((d) => {
      setData(d);
      setAnswers(new Array(d.questions ? d.questions.length : 0).fill(null));
    }).catch((e) => setError(e.message));
  }, []);

  // Décompte par question. DOIT rester ici, en haut du composant avec les autres
  // hooks : placé après un `return` conditionnel, il violait la règle des hooks
  // de React et faisait planter la page (écran blanc). Il ne fait rien tant
  // qu'on n'est pas en phase de jeu (pas de data, déjà joué, ou résultat affiché).
  useEffect(() => {
    if (!data || result || data.already_played || !data.questions) return;
    setTimeLeft(TIME_PER_QUESTION);
    answeredRef.current = false;
    const started = Date.now();
    const t = setInterval(() => {
      const remaining = TIME_PER_QUESTION - Math.floor((Date.now() - started) / 1000);
      setTimeLeft(Math.max(0, remaining));
      if (remaining <= 0) {
        clearInterval(t);
        if (!answeredRef.current) {
          goNextRef.current(); // temps écoulé sans réponse : on avance
        }
      }
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, data, result]);

  if (error) return (
    <div style={cardWrap}><TopBar screen={screen} onNavigate={onNavigate} />
      <p style={{ color: COLORS.danger, fontSize: 13 }}>{error}</p></div>
  );
  if (!data) return (
    <div style={cardWrap}><TopBar screen={screen} onNavigate={onNavigate} />
      <p style={{ color: COLORS.muted, fontSize: 14 }}>Chargement du défi du jour…</p></div>
  );

  const dateLabel = new Date(data.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  function LeaderboardBlock({ lb }) {
    if (!lb || lb.length === 0) return <p style={{ fontSize: 13, color: COLORS.muted }}>Personne n'a encore joué aujourd'hui.</p>;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {lb.map((e, i) => (
          <div key={e.pseudo} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            background: i === 0 ? "rgba(59,130,246,0.12)" : COLORS.card,
            border: i === 0 ? `2px solid ${COLORS.gold}` : "2px solid transparent",
            borderRadius: 12, padding: "9px 14px",
          }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{i + 1}. {e.pseudo}{e.pseudo === user?.pseudo ? " (toi)" : ""}</span>
            <span style={{ fontWeight: 700, color: COLORS.gold, fontSize: 13 }}>{e.score}/{e.total}</span>
          </div>
        ))}
      </div>
    );
  }

  function CorrectionBlock({ details }) {
    if (!details) return null;
    return (
      <>
        <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 10px", textTransform: "uppercase" }}>Correction</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {details.map((d, i) => {
            const givenTxt = d.given !== null && d.given !== undefined ? d.choix[d.given] : "Pas de réponse";
            return (
              <div key={i} style={{
                background: COLORS.card, borderRadius: 12, padding: 14,
                borderLeft: `4px solid ${d.correct ? COLORS.success : COLORS.danger}`,
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                  {d.correct
                    ? <Check size={16} color={COLORS.success} style={{ flexShrink: 0, marginTop: 2 }} />
                    : <XIcon size={16} color={COLORS.danger} style={{ flexShrink: 0, marginTop: 2 }} />}
                  <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{i + 1}. {d.question}</span>
                </div>
                <p style={{ margin: "0 0 4px", fontSize: 13, color: COLORS.success }}>
                  Bonne réponse : <b>{d.choix[d.correct_index]}</b>
                </p>
                {!d.correct && (
                  <p style={{ margin: "0 0 6px", fontSize: 13, color: COLORS.danger }}>
                    Ta réponse : {givenTxt}
                  </p>
                )}
                {d.explication && (
                  <p style={{ margin: "6px 0 8px", fontSize: 13, lineHeight: 1.5, color: COLORS.muted }}>{d.explication}</p>
                )}
                <SearchLink question={d.question} reponse={d.choix[d.correct_index]} />
              </div>
            );
          })}
        </div>
      </>
    );
  }

  // --- Écran résultat (juste après soumission) ---
  if (result) {
    return (
      <div style={cardWrap}>
        <TopBar screen={screen} onNavigate={onNavigate} />
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <CalendarDays size={26} color={COLORS.gold} style={{ marginBottom: 6 }} />
          <p style={{ fontSize: 13, color: COLORS.muted, margin: 0, textTransform: "uppercase" }}>Défi du {dateLabel}</p>
          <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 38, fontWeight: 700, margin: "4px 0 0" }}>{result.score} / {result.total}</h2>
          {!result.recorded && <p style={{ fontSize: 12, color: COLORS.muted, margin: "6px 0 0" }}>
            {user ? "Tu avais déjà joué aujourd'hui — ce score n'est pas comptabilisé." : "Connecte-toi pour apparaître au classement."}
          </p>}
        </div>

        <CorrectionBlock details={result.details} />

        <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 10px", textTransform: "uppercase" }}>Classement du jour</p>
        <div style={{ marginBottom: 20 }}><LeaderboardBlock lb={result.leaderboard} /></div>
        <Button onClick={() => onNavigate("home")} style={{ width: "100%" }}>Accueil</Button>
      </div>
    );
  }

  // --- Déjà joué aujourd'hui ---
  if (data.already_played) {
    return (
      <div style={cardWrap}>
        <TopBar screen={screen} onNavigate={onNavigate} />
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <CalendarDays size={26} color={COLORS.gold} style={{ marginBottom: 6 }} />
          <p style={{ fontSize: 13, color: COLORS.muted, margin: 0, textTransform: "uppercase" }}>Défi du {dateLabel}</p>
          <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 30, fontWeight: 700, margin: "4px 0 0" }}>
            Ton score : {data.already_played.score}/{data.already_played.total}
          </h2>
          <p style={{ fontSize: 13, color: COLORS.muted, margin: "6px 0 0" }}>Reviens demain pour un nouveau défi !</p>
        </div>

        {data.review && (
          <>
            <Button variant="secondary" onClick={() => setShowReview((v) => !v)} style={{ width: "100%", marginBottom: 16 }}>
              {showReview ? "Masquer mes réponses" : "Revoir mes réponses"}
            </Button>
            {showReview && <CorrectionBlock details={data.review} />}
          </>
        )}

        <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 10px", textTransform: "uppercase" }}>Classement du jour</p>
        <div style={{ marginBottom: 20 }}><LeaderboardBlock lb={data.leaderboard} /></div>
        <Button variant="secondary" onClick={() => onNavigate("home")} style={{ width: "100%" }}>Accueil</Button>
      </div>
    );
  }

  // --- Jeu ---
  const q = data.questions[index];

  function pick(choiceIdx) {
    if (answered !== null) return;
    answeredRef.current = true;
    setAnswered(choiceIdx);
    const next = [...answers];
    next[index] = choiceIdx;
    setAnswers(next);
  }

  async function goNext() {
    if (index + 1 < data.questions.length) {
      setIndex(index + 1);
      setAnswered(null);
    } else {
      try {
        // answers peut avoir une valeur manquante (temps écoulé) → on comble à null
        const filled = data.questions.map((_, i) => (answers[i] === undefined ? null : answers[i]));
        const r = await apiFetch("/api/daily/submit", { method: "POST", body: JSON.stringify({ answers: filled }) });
        setResult(r);
      } catch (e) { setError(e.message); }
    }
  }

  const timePct = (timeLeft / TIME_PER_QUESTION) * 100;

  // Le timer (déclaré en haut) appelle goNext via cette ref, car goNext est
  // défini ici, après les hooks. On garde la ref à jour à chaque rendu.
  goNextRef.current = goNext;

  return (
    <div style={cardWrap}>
      <TopBar screen={screen} onNavigate={onNavigate} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: COLORS.muted, fontWeight: 700 }}>Défi du jour · {index + 1}/{data.questions.length}</span>
        <span style={{ fontSize: 12, color: COLORS.gold, fontWeight: 700 }}>{q.theme}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: COLORS.cardAlt, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${timePct}%`, background: timeLeft <= 5 ? COLORS.danger : COLORS.gold, transition: "width 0.25s linear" }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: timeLeft <= 5 ? COLORS.danger : COLORS.muted, minWidth: 28, textAlign: "right" }}>{timeLeft}s</span>
      </div>
      <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 700, lineHeight: 1.35, margin: "0 0 20px" }}>{q.question}</h3>

      <AnswerGrid choix={q.choix} answered={answered} onPick={pick} revealCorrectness={false} />

      {answered !== null && (
        <Button onClick={goNext} style={{ width: "100%", marginTop: 4 }}>
          {index + 1 < data.questions.length ? "Question suivante" : "Voir mon score"}
        </Button>
      )}
      <p style={{ fontSize: 11, color: COLORS.muted, textAlign: "center", margin: "14px 0 0" }}>
        Les bonnes réponses sont révélées à la fin — comme pour tout le monde aujourd'hui.
      </p>
    </div>
  );
}
