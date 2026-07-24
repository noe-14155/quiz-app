import { COLORS } from "../design/theme";

/**
 * Barre de compte à rebours.
 *
 * Animée par une SEULE animation CSS lancée au démarrage, et non par une mise à
 * jour de la largeur chaque seconde depuis JavaScript. Deux raisons :
 *
 *  - `width` force le navigateur à recalculer la mise en page à chaque image ;
 *    `transform: scaleX()` est traité par le compositeur, donc fluide ;
 *  - un `setInterval` dérive de quelques millisecondes à chaque tour. La
 *    transition CSS repartait avant d'avoir fini, ce qui produisait le
 *    saccadement visible.
 *
 * Le chiffre des secondes continue d'être rafraîchi par JavaScript : lui n'a
 * pas besoin d'être fluide, il change une fois par seconde.
 *
 * `cle` doit changer à chaque nouveau départ pour relancer l'animation.
 */
export default function TimerBar({ duree, cle, danger = false, hauteur = 8, style }) {
  return (
    <div style={{
      height: hauteur, borderRadius: hauteur / 2, background: COLORS.cardAlt,
      overflow: "hidden", ...style,
    }}>
      <div
        key={cle}
        style={{
          height: "100%", width: "100%", borderRadius: hauteur / 2,
          background: danger ? COLORS.danger : `linear-gradient(90deg, ${COLORS.gold}, ${COLORS.accent2})`,
          transformOrigin: "left center",
          animation: `sqdrain ${duree}s linear forwards`,
          willChange: "transform",
        }}
      />
    </div>
  );
}
