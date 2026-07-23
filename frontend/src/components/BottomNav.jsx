import { Gamepad2, CalendarDays, Trophy, User } from "lucide-react";
import { COLORS, FONT_BODY, tint } from "../design/theme";

/**
 * Barre de navigation basse, toujours visible sur les quatre écrans principaux.
 *
 * Elle remplace un accueil devenu surchargé (neuf blocs cliquables empilés) :
 * chaque onglet a désormais un rôle unique, et le classement n'est plus caché
 * au fond d'un mode. C'est le repère standard sur mobile — on sait toujours où
 * l'on est et comment revenir.
 */
const ONGLETS = [
  { id: "home", label: "Jouer", Icone: Gamepad2 },
  { id: "du-jour", label: "Du jour", Icone: CalendarDays },
  { id: "ranks", label: "Classement", Icone: Trophy },
  { id: "profile", label: "Profil", Icone: User },
];

export const ONGLETS_PRINCIPAUX = ONGLETS.map((o) => o.id);

export default function BottomNav({ actif, onNavigate }) {
  // La barre n'est PAS en position fixe : elle est le dernier élément d'une
  // colonne pleine hauteur (voir App.jsx). Sur iPhone, `position: fixed` se
  // décale au rythme de la barre d'adresse de Safari, qui apparaît et disparaît
  // au défilement — la barre semblait alors « flotter » et sauter.
  return (
    <>
      <nav style={{
        flexShrink: 0, zIndex: 50,
        display: "flex", justifyContent: "center",
        background: COLORS.bg, borderTop: `1px solid ${COLORS.cardAlt}`,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}>
        <div style={{ display: "flex", width: "100%", maxWidth: 480 }}>
          {ONGLETS.map(({ id, label, Icone }) => {
            const on = actif === id;
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                style={{
                  flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  background: "none", border: "none", cursor: "pointer", padding: "10px 0 12px",
                  color: on ? COLORS.gold : COLORS.muted,
                }}
              >
                <span style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 44, height: 26, borderRadius: 13,
                  background: on ? tint(COLORS.gold, 12) : "transparent",
                  transition: "background .15s",
                }}>
                  <Icone size={18} />
                </span>
                <span style={{ fontFamily: FONT_BODY, fontWeight: on ? 800 : 700, fontSize: 10.5 }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
