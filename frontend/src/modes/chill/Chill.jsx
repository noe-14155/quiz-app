import { useState } from "react";
import { Star } from "lucide-react";
import { cardWrap, COLORS, FONT_BODY, sectionLabel } from "../../design/theme";
import TopBar from "../../components/TopBar";
import Button from "../../components/Button";
import AnswerGrid from "../../components/AnswerGrid";
import QuitConfirmModal from "../../components/QuitConfirmModal";
import SearchLink from "../../components/SearchLink";
import QuizHeader, { QuizTopLine, QuizQuestion, Explanation } from "../../components/QuizHeader";
import BigScore from "../../components/BigScore";
import Pill from "../../components/Pill";
import PageTitle from "../../components/PageTitle";
import { apiFetch } from "../../api/client";

const THEMES = [
  "Cinéma/Séries", "Géographie", "Histoire", "Pays", "Acteurs/Célébrités",
  "Anecdotes", "Sciences & Nature", "Sport", "Art & Littérature", "Gastronomie", "Technologie & Internet",
];

// Règle d'architecture (voir CLAUDE.md §8) : l'écran affiché est piloté
// UNIQUEMENT par la prop "screen" venant du parent. Aucun état interne
// parallèle du type "phase" — avoir deux sources de vérité pour "quel écran
// afficher" a déjà causé des bugs de navigation (bouton Retour désynchronisé).
const DIFF_LABELS = { 1: "Très facile", 2: "Facile", 3: "Moyen", 4: "Difficile", 5: "Expert" };

export default function Chill({ screen, onNavigate }) {
  const [themes, setThemes] = useState(THEMES);
  const [diff, setDiff] = useState(3);
  const [exactOnly, setExactOnly] = useState(false);
  const [nb, setNb] = useState(10);
  const [pool, setPool] = useState([]);
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState(null);
  const [reveal, setReveal] = useState(null);
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
        `/api/chill/questions?themes=${encodeURIComponent(themes.join(","))}&difficulte_max=${diff}&nb=${nb}` +
          (exactOnly ? `&exact_difficulte=${diff}` : "")
      );
      // Garde-fou : sans questions, passer à l'écran de quiz planterait le
      // rendu (lecture de pool[0] sur un tableau vide) et l'écran semblerait
      // simplement figé au clic. On reste sur le réglage avec un message clair.
      if (!result.questions || result.questions.length === 0) {
        setError("Aucune question ne correspond à ces thèmes et cette difficulté. Essaie d'élargir la sélection.");
        return;
      }
      setPool(result.questions);
      setIndex(0);
      setScore(0);
      setAnswered(null);
      setReveal(null);
      onNavigate("chill-quiz");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function pick(choiceIdx) {
    if (answered !== null) return;
    const q = pool[index];
    if (!q) return;
    setAnswered(choiceIdx);

    // Révélation INSTANTANÉE : la bonne réponse est déjà dans q (le mode chill
    // la renvoie avec les questions), donc aucun aller-retour réseau à attendre
    // avant d'afficher vert ou rouge.
    const correctIdx = q.bonne_reponse - 1;
    const isCorrect = choiceIdx === correctIdx;
    setReveal({ correct: isCorrect, correct_index: correctIdx, explication: q.explication });
    if (isCorrect) setScore((s) => s + 1);

    // L'XP est enregistrée en arrière-plan : elle ne doit jamais retarder
    // l'affichage. Un échec réseau ne coûte que l'XP de cette question.
    apiFetch("/api/chill/answer", {
      method: "POST",
      body: JSON.stringify({ question_id: q.id, choice: choiceIdx, choix: q.choix }),
    }).catch(() => {});
  }

  function next() {
    if (index + 1 >= pool.length) {
      onNavigate("chill-results");
    } else {
      setIndex((i) => i + 1);
      setAnswered(null);
      setReveal(null);
      setError(null);
    }
  }

  function quitToHome() {
    setQuitOpen(false);
    onNavigate("home");
  }

  // ---------- SETUP ----------
  if (screen === "chill-setup") {
    return (
      <div style={cardWrap}>
        <TopBar screen="chill-setup" onNavigate={onNavigate} />
        <PageTitle subtitle="Choisis tes thèmes, la difficulté et le nombre de questions.">Mode chill</PageTitle>

        <p style={{ ...sectionLabel, marginTop: 0 }}>Thèmes</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {THEMES.map((t) => (
            <Pill key={t} active={themes.includes(t)} onClick={() => toggleTheme(t)}>{t}</Pill>
          ))}
        </div>

        <p style={sectionLabel}>Difficulté</p>
        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setDiff(n)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
              <Star size={28} color={COLORS.gold} fill={n <= diff ? COLORS.gold : "none"} />
            </button>
          ))}
        </div>

        <button
          onClick={() => setExactOnly((v) => !v)}
          style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
            background: "none", border: "none", cursor: "pointer", padding: "0 0 20px", fontFamily: FONT_BODY,
          }}
        >
          <span style={{
            width: 48, height: 28, borderRadius: 20, flexShrink: 0, position: "relative",
            background: exactOnly ? COLORS.gold : COLORS.cardAlt, transition: "background 0.15s",
          }}>
            <span style={{
              position: "absolute", top: 3, left: exactOnly ? 23 : 3, width: 22, height: 22,
              borderRadius: "50%", background: "#fff", transition: "left 0.15s", boxShadow: "0 2px 5px rgba(0,0,0,.2)",
            }} />
          </span>
          <span style={{ fontSize: 13, color: COLORS.text, fontWeight: 800 }}>
            Cette difficulté uniquement
            <span style={{ display: "block", fontSize: 11, color: COLORS.muted, fontWeight: 400 }}>
              {exactOnly ? `Seulement les questions à ${diff} étoile${diff > 1 ? "s" : ""}` : `Toutes les questions jusqu'à ${diff} étoile${diff > 1 ? "s" : ""}`}
            </span>
          </span>
        </button>

        <p style={{ ...sectionLabel, marginBottom: 8 }}>
          Questions : <span style={{ color: COLORS.gold }}>{nb}</span>
        </p>
        <input type="range" min={3} max={15} value={nb} onChange={(e) => setNb(Number(e.target.value))}
          style={{ width: "100%", accentColor: COLORS.gold, marginBottom: 20 }} />

        {error && <p style={{ color: COLORS.danger, fontSize: 13, margin: "0 0 12px" }}>{error}</p>}
        <Button onClick={start} disabled={themes.length === 0 || loading}>
          {loading ? "Chargement..." : "Commencer"}
        </Button>
      </div>
    );
  }

  // ---------- QUIZ ----------
  if (screen === "chill-quiz") {
    const q = pool[index];
    // Filet de sécurité : si on arrive ici sans question chargée (ex: retour
    // arrière inattendu), on renvoie vers le réglage au lieu de planter.
    if (!q) {
      return (
        <div style={cardWrap}>
          <TopBar screen="chill-setup" onNavigate={onNavigate} />
          <p style={{ color: COLORS.muted, fontSize: 14, marginBottom: 16 }}>Aucune question chargée.</p>
          <Button onClick={() => onNavigate("chill-setup")}>Revenir aux réglages</Button>
        </div>
      );
    }
    return (
      <div style={cardWrap}>
        {quitOpen && <QuitConfirmModal onCancel={() => setQuitOpen(false)} onConfirm={quitToHome} />}
        <TopBar screen="chill-quiz" onNavigate={onNavigate} onRequestQuit={() => setQuitOpen(true)} />
        <QuizTopLine index={index} total={pool.length} />
        <QuizHeader
          index={index}
          total={pool.length}
          rightLabel="Chill"
          progressPct={(index / pool.length) * 100}
          tags={[
            { label: q.theme, color: COLORS.gold },
            { label: DIFF_LABELS[q.difficulte] || `Niveau ${q.difficulte}`, color: COLORS.accent3 },
          ]}
        />
        <QuizQuestion>{q.question}</QuizQuestion>

        <AnswerGrid choix={q.choix} answered={answered} correctIndex={reveal ? reveal.correct_index : null} onPick={pick} revealCorrectness={reveal !== null} />

        {error && <p style={{ color: COLORS.danger, fontSize: 13, margin: "0 0 12px" }}>{error}</p>}

        {reveal && (
          <>
            <Explanation
              ok={reveal.correct}
              title={reveal.correct ? "Bonne réponse" : "Raté"}
              correctAnswer={reveal.correct ? null : q.choix[reveal.correct_index]}
              text={reveal.explication}
            >
              <div style={{ marginTop: 10 }}>
                <SearchLink question={q.question} reponse={q.choix[reveal.correct_index]} />
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

  // ---------- RESULTS ----------
  return (
    <div style={cardWrap}>
      <TopBar screen="chill-results" onNavigate={onNavigate} />
      <BigScore score={score} total={pool.length} subtitle="Mode chill — aucun impact sur ton rang." />
      <Button onClick={() => onNavigate("chill-setup")}>Rejouer</Button>
      <div style={{ height: 10 }} />
      <Button variant="secondary" onClick={() => onNavigate("home")}>Accueil</Button>
    </div>
  );
}
