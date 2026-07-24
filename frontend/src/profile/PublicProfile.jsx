import { useEffect, useState } from "react";
import { ChevronLeft, Award, Crown, CalendarDays, TrendingUp, TrendingDown } from "lucide-react";
import {
  cardWrap, COLORS, FONT_DISPLAY, FONT_BODY, sectionLabel, tint,
  tierInfo, rankGradient, RANKS,
} from "../design/theme";
import { iconeDuRang } from "../design/rankIcons";
import Collapsible from "../components/Collapsible";
import Avatar from "../components/Avatar";
import { apiFetch } from "../api/client";

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin",
              "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function saisonLisible(code) {
  const [a, m] = code.split("-");
  return `${MOIS[parseInt(m, 10) - 1]} ${a}`;
}

/** Barre de réussite par thème — même présentation que l'écran Statistiques,
 *  pour qu'un profil consulté se lise exactement comme le sien. */
function BarreTheme({ t, couleur }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <span style={{
        fontFamily: FONT_BODY, fontWeight: 800, fontSize: 12.5, width: 110, flexShrink: 0,
        color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {t.nom}
      </span>
      <span style={{ flex: 1, height: 8, background: COLORS.cardAlt, borderRadius: 4, overflow: "hidden" }}>
        <span style={{ display: "block", height: "100%", width: `${t.pct}%`, background: couleur }} />
      </span>
      <span style={{
        fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 12.5, color: COLORS.muted,
        width: 60, textAlign: "right", flexShrink: 0,
      }}>
        {t.pct}% · {t.attempted}
      </span>
    </div>
  );
}

/** Bloc de chiffre : une valeur, un libellé. */
function Chiffre({ valeur, libelle, couleur }) {
  return (
    <div style={{
      flex: 1, textAlign: "center", padding: "12px 6px", borderRadius: 14,
      background: COLORS.card, border: `1px solid ${COLORS.cardAlt}`,
    }}>
      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 19, color: couleur || COLORS.text, margin: 0 }}>
        {valeur}
      </p>
      <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 10.5, color: COLORS.muted, margin: "2px 0 0" }}>
        {libelle}
      </p>
    </div>
  );
}

/**
 * Profil d'un joueur, consulté depuis le classement.
 *
 * Il répond à trois questions : où il en est cette saison, jusqu'où il est
 * monté par le passé, et ce qu'il a accompli. Les saisons étant remises à zéro
 * chaque mois, le palmarès est ce qui donne sa profondeur au profil — sans lui,
 * un ancien joueur en début de mois paraîtrait débutant.
 */
export default function PublicProfile({ onNavigate, pseudo }) {
  const [profil, setProfil] = useState(null);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    apiFetch(`/api/profile/${encodeURIComponent(pseudo)}/public`)
      .then(setProfil)
      .catch((e) => setErreur(e.message));
  }, [pseudo]);

  const actuel = profil ? tierInfo(profil.rank_tier) : null;
  const record = profil ? tierInfo(profil.best_tier_ever) : null;
  const IconeActuel = actuel ? iconeDuRang(actuel.rankIndex) : null;
  const IconeRecord = record ? iconeDuRang(record.rankIndex) : null;

  const themes = profil
    ? Object.entries(profil.stats_by_theme || {})
        .map(([nom, st]) => ({ nom, ...st }))
        .sort((a, b) => b.pct - a.pct)
    : [];

  // Même découpage que l'écran Statistiques : les trois meilleurs, les trois
  // moins bons, et rien entre les deux si le joueur a peu de thèmes.
  const forts = themes.slice(0, 3);
  const faibles = themes.length > 3 ? themes.slice(-3).reverse() : [];

  const membre = profil?.membre_depuis
    ? new Date(profil.membre_depuis).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    : null;

  return (
    <div style={cardWrap}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "2px 0 18px" }}>
        <button
          onClick={() => onNavigate("ranks")}
          aria-label="Retour au classement"
          style={{
            width: 36, height: 36, borderRadius: 11, background: COLORS.soft, border: "none",
            color: COLORS.muted2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <ChevronLeft size={18} />
        </button>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 24, margin: 0, color: COLORS.text }}>
          {pseudo}
        </h2>
      </div>

      {profil && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <Avatar face={profil.avatar_face} color={profil.avatar_color} size={58} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 20, margin: 0, color: COLORS.text }}>
              Niveau {profil.level}
            </p>
            <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 12.5, color: COLORS.muted, margin: "1px 0 0" }}>
              {profil.xp_total.toLocaleString("fr-FR")} XP
            </p>
          </div>
        </div>
      )}

      {erreur && <p style={{ color: COLORS.danger, fontSize: 13 }}>{erreur}</p>}
      {!profil && !erreur && <p style={{ color: COLORS.muted, fontSize: 14 }}>Chargement…</p>}

      {profil && (
        <>
          {/* Rang de la saison en cours */}
          <div style={{
            display: "flex", alignItems: "center", gap: 14, borderRadius: 20, padding: "16px 18px",
            color: "#fff", background: rankGradient(actuel.rank), marginBottom: 10,
            boxShadow: `0 14px 30px -20px ${actuel.rank.color2}`, animation: "sqrise .45s both",
          }}>
            <span style={{
              width: 52, height: 52, borderRadius: 17, flexShrink: 0,
              background: "rgba(255,255,255,.22)", boxShadow: "inset 0 0 0 2px rgba(255,255,255,.35)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <IconeActuel size={24} color="#fff" />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontFamily: FONT_BODY, fontWeight: 800, fontSize: 10, letterSpacing: 1.5,
                textTransform: "uppercase", margin: 0, color: "rgba(255,255,255,.85)",
              }}>
                Cette saison
              </p>
              <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 21, margin: "1px 0 0", lineHeight: 1 }}>
                {actuel.rank.name} {actuel.palierLabel}
              </p>
              <p style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 12.5, margin: "4px 0 0", color: "rgba(255,255,255,.9)" }}>
                {profil.rank_points.toLocaleString("fr-FR")} points
              </p>
            </div>
          </div>

          {/* Meilleur rang jamais atteint */}
          {profil.best_tier_ever > profil.rank_tier && (
            <div style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 16,
              background: tint(record.rank.color2, 9), border: `1px solid ${tint(record.rank.color2, 28)}`,
              marginBottom: 10,
            }}>
              <span style={{
                width: 34, height: 34, borderRadius: 11, flexShrink: 0, background: rankGradient(record.rank),
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <IconeRecord size={17} color="#fff" />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontFamily: FONT_BODY, fontWeight: 800, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: COLORS.muted }}>
                  Sommet atteint
                </span>
                <span style={{ display: "block", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15.5, color: COLORS.text }}>
                  {record.rank.name} {record.palierLabel}
                </span>
              </span>
              <Crown size={17} color={record.rank.color2} style={{ flexShrink: 0 }} />
            </div>
          )}

          {/* Chiffres clés */}
          <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
            <Chiffre valeur={profil.rank_points.toLocaleString("fr-FR")} libelle="Points" />
            <Chiffre valeur={profil.palmares.length} libelle="Saisons" />
            <Chiffre
              valeur={`${profil.achievements.length}/${profil.nb_achievements}`}
              libelle="Succès" couleur={COLORS.gold}
            />
          </div>

          {/* Palmarès des saisons passées */}
          {profil.palmares.length > 0 && (
            <>
              <p style={sectionLabel}>Saisons précédentes</p>
              {profil.palmares.map((s) => {
                const t = tierInfo(s.best_tier);
                const Icone = iconeDuRang(t.rankIndex);
                return (
                  <div key={s.season} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                    borderBottom: `1px solid ${COLORS.cardAlt}`,
                  }}>
                    <span style={{
                      width: 30, height: 30, borderRadius: 10, flexShrink: 0, background: rankGradient(t.rank),
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Icone size={15} color="#fff" />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 14, color: COLORS.text, textTransform: "capitalize" }}>
                        {saisonLisible(s.season)}
                      </span>
                      <span style={{ display: "block", fontFamily: FONT_BODY, fontWeight: 700, fontSize: 11, color: COLORS.muted }}>
                        {t.rank.name} {t.palierLabel}
                      </span>
                    </span>
                    <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 14, color: COLORS.gold, flexShrink: 0 }}>
                      {s.best_points.toLocaleString("fr-FR")}
                    </span>
                  </div>
                );
              })}
            </>
          )}

          {/* Succès et thèmes : repliés, pour que le haut du profil reste lisible.
              Dépliés, ils donnent le détail — le libellé seul ne dit pas ce
              qu'il a fallu accomplir. */}
          <div style={{ marginTop: 22 }}>
            <Collapsible
              title="Succès"
              count={`${profil.achievements.length}/${profil.nb_achievements}`}
            >
              {profil.achievements.length === 0 ? (
                <p style={{ fontSize: 12.5, color: COLORS.muted, lineHeight: 1.5 }}>
                  Aucun succès débloqué pour l'instant.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {profil.achievements.map((a) => (
                    <div key={a.code} style={{
                      display: "flex", alignItems: "center", gap: 11, padding: "10px 12px",
                      borderRadius: 14, background: tint(COLORS.gold, 7),
                      border: `1px solid ${tint(COLORS.gold, 22)}`,
                    }}>
                      <span style={{
                        width: 30, height: 30, borderRadius: 10, flexShrink: 0, background: rankGradient(RANKS[6]),
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Award size={15} color="#fff" />
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 14, color: COLORS.text }}>
                          {a.titre}
                        </span>
                        <span style={{ display: "block", fontFamily: FONT_BODY, fontSize: 11.5, color: COLORS.muted, marginTop: 1, lineHeight: 1.35 }}>
                          {a.description}
                        </span>
                      </span>
                      <span style={{
                        fontFamily: FONT_BODY, fontWeight: 800, fontSize: 10, letterSpacing: 0.8,
                        textTransform: "uppercase", color: COLORS.muted, flexShrink: 0,
                      }}>
                        {a.categorie}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Collapsible>

            <Collapsible title="Thèmes" count={themes.length || undefined}>
              {themes.length === 0 ? (
                <p style={{ fontSize: 12.5, color: COLORS.muted, lineHeight: 1.5 }}>
                  Pas encore assez de parties classées pour dégager des tendances.
                </p>
              ) : (
                <>
                  {forts.length > 0 && (
                    <>
                      <p style={{ ...sectionLabel, display: "flex", alignItems: "center", gap: 6, marginTop: 0 }}>
                        <TrendingUp size={13} color={COLORS.success} /> Ses points forts
                      </p>
                      {forts.map((t) => <BarreTheme key={t.nom} t={t} couleur={COLORS.success} />)}
                    </>
                  )}
                  {faibles.length > 0 && (
                    <>
                      <p style={{ ...sectionLabel, display: "flex", alignItems: "center", gap: 6 }}>
                        <TrendingDown size={13} color={COLORS.danger} /> À travailler
                      </p>
                      {faibles.map((t) => <BarreTheme key={t.nom} t={t} couleur={COLORS.danger} />)}
                    </>
                  )}
                  {forts.length === 0 && faibles.length === 0 &&
                    themes.map((t) => <BarreTheme key={t.nom} t={t} couleur={COLORS.gold} />)}
                </>
              )}
            </Collapsible>
          </div>

          {membre && (
            <p style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              fontSize: 11.5, color: COLORS.chevron, marginTop: 24,
            }}>
              <CalendarDays size={12} /> Joue depuis {membre}
            </p>
          )}
        </>
      )}
    </div>
  );
}
