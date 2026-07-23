import { useState } from "react";
import { Flag, Check } from "lucide-react";
import { COLORS, FONT_BODY } from "../design/theme";
import { apiFetch } from "../api/client";

const MOTIFS = [
  { code: "reponse_fausse", label: "La bonne réponse est fausse" },
  { code: "explication", label: "L'explication est incorrecte" },
  { code: "ambigue", label: "Plusieurs réponses possibles" },
  { code: "faute", label: "Faute d'orthographe ou de formulation" },
  { code: "autre", label: "Autre" },
];

/**
 * Bouton discret « Signaler cette question », affiché après la révélation.
 * Les questions ayant été générées en masse, certaines sont perfectibles :
 * ce retour des joueurs remonte directement dans l'administration.
 */
export default function ReportButton({ questionId }) {
  const [ouvert, setOuvert] = useState(false);
  const [envoye, setEnvoye] = useState(false);

  async function envoyer(code) {
    setEnvoye(true);
    setOuvert(false);
    try {
      await apiFetch("/api/report", {
        method: "POST",
        body: JSON.stringify({ question_id: questionId, reason: code }),
      });
    } catch (e) { /* le signalement est secondaire, on n'alerte pas le joueur */ }
  }

  if (envoye) {
    return (
      <p style={{
        display: "flex", alignItems: "center", gap: 6, margin: "10px 0 0",
        fontFamily: FONT_BODY, fontWeight: 700, fontSize: 12, color: COLORS.success,
      }}>
        <Check size={13} /> Merci, c'est signalé.
      </p>
    );
  }

  if (!ouvert) {
    return (
      <button
        onClick={() => setOuvert(true)}
        style={{
          display: "flex", alignItems: "center", gap: 6, background: "none", border: "none",
          padding: "10px 0 0", cursor: "pointer",
          fontFamily: FONT_BODY, fontWeight: 700, fontSize: 12, color: COLORS.muted,
        }}
      >
        <Flag size={12} /> Signaler cette question
      </button>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: 12, color: COLORS.muted, margin: "0 0 8px" }}>
        Qu'est-ce qui ne va pas ?
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {MOTIFS.map((m) => (
          <button
            key={m.code}
            onClick={() => envoyer(m.code)}
            style={{
              textAlign: "left", background: COLORS.soft, border: `1px solid ${COLORS.cardAlt}`,
              borderRadius: 12, padding: "9px 12px", cursor: "pointer",
              fontFamily: FONT_BODY, fontWeight: 700, fontSize: 12.5, color: COLORS.text,
            }}
          >
            {m.label}
          </button>
        ))}
        <button
          onClick={() => setOuvert(false)}
          style={{
            background: "none", border: "none", padding: "4px 0", cursor: "pointer",
            fontFamily: FONT_BODY, fontWeight: 700, fontSize: 12, color: COLORS.muted,
          }}
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
