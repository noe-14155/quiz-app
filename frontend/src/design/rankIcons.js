import { Users, Ticket, UserCheck, Medal, Trophy, Crown, Star } from "lucide-react";

/**
 * Une icône par rang, dans l'ordre Figurant → Hall of Fame.
 *
 * Partagée entre l'échelle des rangs et le classement : le même symbole
 * désigne toujours le même rang, ce qui le rend reconnaissable sans avoir à
 * lire son nom. Elle remplace le chiffre romain du palier, qui n'évoquait rien.
 */
export const RANK_ICONS = [Users, Ticket, UserCheck, Medal, Trophy, Crown, Star];

export function iconeDuRang(rankIndex) {
  return RANK_ICONS[Math.max(0, Math.min(rankIndex, RANK_ICONS.length - 1))];
}
