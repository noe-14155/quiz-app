"""Mode multi en temps réel — les endpoints.

Six routes, aucune n'a besoin de savoir « où en est » la partie : elles le
demandent à `service.etat_temporel`, qui le déduit de l'horodatage de départ
(voir le module de service pour le raisonnement complet).

Le sondage remplace ici les WebSockets, et ce n'est pas un pis-aller : une
WebSocket est coupée dès que l'écran du téléphone se verrouille, alors qu'un
sondage reprend tout seul. Le volume est dérisoire — dans le salon, une requête
toutes les deux secondes par joueur ; en jeu, une par question et par joueur.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth.router import get_current_user
from app.core import dates
from app.core.db import get_connection
from app.modes.admin.service import is_mode_enabled
from app.modes.multi import service
from app.profile import achievements
from app.profile.activity import log_event
from app.profile.xp import award_xp, xp_for_difficulty
from app.questions import service as questions_service

router = APIRouter(prefix="/api/multi", tags=["multi"])


def _require_enabled():
    if not is_mode_enabled("mode_multi_enabled"):
        raise HTTPException(status_code=403, detail="Le mode multi est temporairement désactivé")


def _partie_ou_404(conn, code: str):
    partie = service.partie_par_code(conn, code)
    if not partie:
        conn.close()
        raise HTTPException(status_code=404, detail="Partie introuvable")
    return partie


def _finaliser(conn, partie):
    """Une fois la dernière question passée : XP et succès, une seule fois.

    Le garde-fou est le `WHERE xp_versee = 0` : plusieurs clients constatent la
    fin de la partie à la même seconde, mais un seul `UPDATE` modifie une ligne.
    Celui-là distribue, les autres n'ont rien à faire — pas de verrou à poser,
    pas de tâche de fond à écrire.
    """
    modifiees = conn.execute(
        "UPDATE multi_parties SET xp_versee = 1 WHERE code = ? AND xp_versee = 0",
        (partie["code"],),
    ).rowcount
    conn.commit()
    if not modifiees:
        return

    gagnants = conn.execute(
        "SELECT r.pseudo, j.user_id, SUM(r.juste) AS bonnes "
        "FROM multi_reponses r JOIN multi_joueurs j "
        "  ON j.code = r.code AND j.pseudo = r.pseudo "
        "WHERE r.code = ? GROUP BY r.pseudo",
        (partie["code"],),
    ).fetchall()
    for g in gagnants:
        if g["user_id"] and g["bonnes"]:
            # Difficulté moyenne 3 : le multi mélange les niveaux, et l'XP y est
            # secondaire (c'est un mode qui se joue pour la partie elle-même).
            award_xp(g["user_id"], xp_for_difficulty(3) * int(g["bonnes"]))
            achievements.evaluer(g["user_id"], g["pseudo"])


def _etat_complet(conn, partie, user):
    etat = service.etat_temporel(partie)
    if etat["statut"] == "termine":
        _finaliser(conn, partie)
    liste = service.joueurs(conn, partie["code"])
    return {
        "code": partie["code"],
        "hote": partie["hote"],
        "je_suis_hote": partie["hote"] == user["pseudo"],
        "je_participe": any(j["pseudo"] == user["pseudo"] for j in liste),
        "joueurs": liste,
        "nb_joueurs": len(liste),
        "min_joueurs": service.MIN_JOUEURS,
        "max_joueurs": service.MAX_JOUEURS,
        "started_at": partie["started_at"],
        # Horloge de référence : le client s'en sert pour calculer son décalage
        # une fois pour toutes, puis raisonne en local. Sans cela, un téléphone
        # dont l'heure avance de 20 secondes verrait la partie en avance.
        "serveur_now": dates.horodatage(),
        **etat,
        "nb_reponses": service.nb_reponses(conn, partie["code"], etat["index"])
                       if etat["statut"] == "en_cours" else 0,
        "classement": service.classement(conn, partie["code"])
                      if etat["statut"] in ("en_cours", "termine") else [],
    }


class CreationPayload(BaseModel):
    nb_questions: int = 10
    duree_question: int = 15
    themes: Optional[List[str]] = None
    difficulte_max: int = 5


@router.post("/create")
def create(payload: CreationPayload, user=Depends(get_current_user)):
    """Crée la partie, tire les questions tout de suite, et inscrit l'hôte.

    Les questions sont figées ICI : c'est ce qui permet ensuite de tout déduire
    du temps sans jamais avoir à décider quoi que ce soit en cours de route.
    """
    _require_enabled()
    if payload.nb_questions not in service.NB_QUESTIONS_POSSIBLES:
        raise HTTPException(status_code=422, detail="Nombre de questions non proposé")
    if payload.duree_question not in service.DUREES_POSSIBLES:
        raise HTTPException(status_code=422, detail="Durée non proposée")

    questions = questions_service.fetch_questions(
        themes=payload.themes or None,
        difficulte_max=max(1, min(5, payload.difficulte_max)),
        limit=payload.nb_questions, hide_answer=False, allow_repeat=True,
    )
    if len(questions) < payload.nb_questions:
        raise HTTPException(status_code=503, detail="Pas assez de questions pour ces réglages")

    conn = get_connection()
    code = None
    for _ in range(12):
        candidat = service.code_aleatoire()
        if not service.partie_par_code(conn, candidat):
            code = candidat
            break
    if code is None:
        conn.close()
        raise HTTPException(status_code=503, detail="Impossible de créer une partie, réessaie.")

    service.enregistrer_partie(conn, code, user["pseudo"], questions, payload.duree_question)
    conn.execute(
        "INSERT INTO multi_joueurs (code, pseudo, user_id, avatar_face, avatar_color, rejoint_at) "
        "VALUES (?,?,?,?,?,?)",
        (code, user["pseudo"], user["id"], user["avatar_face"], user["avatar_color"],
         dates.horodatage()),
    )
    conn.commit()
    log_event("multi_start", user_id=user["id"], pseudo=user["pseudo"])
    etat = _etat_complet(conn, service.partie_par_code(conn, code), user)
    conn.close()
    return etat


@router.post("/{code}/join")
def join(code: str, user=Depends(get_current_user)):
    """Rejoindre le salon. Impossible une fois la partie lancée : tout le monde
    joue les mêmes questions au même moment, un retardataire n'aurait aucune
    chance et fausserait le classement."""
    _require_enabled()
    conn = get_connection()
    partie = _partie_ou_404(conn, code)
    if partie["started_at"]:
        conn.close()
        raise HTTPException(status_code=409, detail="La partie a déjà commencé")

    liste = service.joueurs(conn, partie["code"])
    if any(j["pseudo"] == user["pseudo"] for j in liste):
        etat = _etat_complet(conn, partie, user)  # déjà là : on renvoie l'état, sans erreur
        conn.close()
        return etat
    if len(liste) >= service.MAX_JOUEURS:
        conn.close()
        raise HTTPException(status_code=409, detail=f"Salon complet ({service.MAX_JOUEURS} joueurs)")

    conn.execute(
        "INSERT OR IGNORE INTO multi_joueurs (code, pseudo, user_id, avatar_face, avatar_color, rejoint_at) "
        "VALUES (?,?,?,?,?,?)",
        (partie["code"], user["pseudo"], user["id"], user["avatar_face"], user["avatar_color"],
         dates.horodatage()),
    )
    conn.commit()
    etat = _etat_complet(conn, partie, user)
    conn.close()
    return etat


@router.post("/{code}/start")
def start(code: str, user=Depends(get_current_user)):
    """Lance la partie : écrit l'unique horodatage dont tout découle.

    `WHERE started_at IS NULL` rend l'opération atomique — si l'hôte tape deux
    fois, la seconde ne décale pas la partie de ceux qui jouent déjà.
    """
    _require_enabled()
    conn = get_connection()
    partie = _partie_ou_404(conn, code)
    if partie["hote"] != user["pseudo"]:
        conn.close()
        raise HTTPException(status_code=403, detail="Seul l'hôte peut lancer la partie")
    if len(service.joueurs(conn, partie["code"])) < service.MIN_JOUEURS:
        conn.close()
        raise HTTPException(status_code=409, detail=f"Il faut au moins {service.MIN_JOUEURS} joueurs")

    conn.execute(
        "UPDATE multi_parties SET started_at = ? WHERE code = ? AND started_at IS NULL",
        (dates.horodatage(), partie["code"]),
    )
    conn.commit()
    etat = _etat_complet(conn, service.partie_par_code(conn, partie["code"]), user)
    conn.close()
    return etat


@router.get("/{code}")
def etat(code: str, user=Depends(get_current_user)):
    """L'état complet, sondé toutes les deux secondes dans le salon et une fois
    par question en jeu."""
    _require_enabled()
    conn = get_connection()
    partie = _partie_ou_404(conn, code)
    resultat = _etat_complet(conn, partie, user)
    conn.close()
    return resultat


@router.get("/{code}/question/{index}")
def question(code: str, index: int, user=Depends(get_current_user)):
    """La question `index`, sans sa réponse. Servie au plus tôt pendant la
    révélation de la précédente (voir service.peut_lire_question)."""
    _require_enabled()
    conn = get_connection()
    partie = _partie_ou_404(conn, code)
    etat_t = service.etat_temporel(partie)
    if not service.peut_lire_question(etat_t, index):
        conn.close()
        raise HTTPException(status_code=409, detail="Cette question n'est pas encore disponible")
    q = service.question_publique(partie, index)
    conn.close()
    if q is None:
        raise HTTPException(status_code=404, detail="Question introuvable")
    return {"index": index, "question": q, "duree_question": partie["duree_question"]}


class ReponsePayload(BaseModel):
    question_index: int
    choix: int


@router.post("/{code}/answer")
def answer(code: str, payload: ReponsePayload, user=Depends(get_current_user)):
    """Enregistre une réponse.

    Deux vérifications, toutes deux de simples soustractions :
      - la fenêtre de cette question est-elle ouverte en ce moment ?
      - ce joueur a-t-il déjà répondu (clé primaire composite) ?

    Le temps de réponse est mesuré CÔTÉ SERVEUR, à partir de la position dans la
    fenêtre : le client ne peut donc pas s'attribuer un bonus de vitesse en
    trafiquant un chronomètre local.
    """
    _require_enabled()
    conn = get_connection()
    partie = _partie_ou_404(conn, code)
    etat_t = service.etat_temporel(partie)

    if not any(j["pseudo"] == user["pseudo"] for j in service.joueurs(conn, partie["code"])):
        conn.close()
        raise HTTPException(status_code=403, detail="Tu ne participes pas à cette partie")
    if not service.fenetre_ouverte(etat_t, payload.question_index):
        conn.close()
        raise HTTPException(status_code=409, detail="Trop tard (ou trop tôt) pour cette question")
    if not 0 <= payload.choix <= 3:
        conn.close()
        raise HTTPException(status_code=422, detail="Choix invalide")

    ms = partie["duree_question"] * 1000 - etat_t["reste_ms"]
    q = service.question_complete(partie, payload.question_index)
    juste = payload.choix == q["bonne_reponse"] - 1
    points = service.points_pour(ms, partie["duree_question"]) if juste else 0

    # INSERT OR IGNORE : la première réponse fait foi, les doublons éventuels
    # (double tap, requête rejouée) sont sans effet.
    conn.execute(
        "INSERT OR IGNORE INTO multi_reponses "
        "(code, question_index, pseudo, choix, ms, juste, points, answered_at) "
        "VALUES (?,?,?,?,?,?,?,?)",
        (partie["code"], payload.question_index, user["pseudo"], payload.choix,
         int(ms), 1 if juste else 0, points, dates.horodatage()),
    )
    conn.commit()
    # On relit ce qui a réellement été enregistré : en cas de doublon, c'est la
    # première réponse qui compte, pas celle qu'on vient de calculer.
    ligne = conn.execute(
        "SELECT choix, points, ms FROM multi_reponses "
        "WHERE code = ? AND question_index = ? AND pseudo = ?",
        (partie["code"], payload.question_index, user["pseudo"]),
    ).fetchone()
    total = service.nb_reponses(conn, partie["code"], payload.question_index)
    nb_joueurs = len(service.joueurs(conn, partie["code"]))
    conn.close()
    # La justesse n'est PAS renvoyée : elle n'apparaît qu'à la révélation, en
    # même temps pour tout le monde.
    return {
        "enregistre": True,
        "choix": ligne["choix"],
        "ms": ligne["ms"],
        "nb_reponses": total,
        "nb_joueurs": nb_joueurs,
    }


@router.get("/{code}/reveal/{index}")
def reveal(code: str, index: int, user=Depends(get_current_user)):
    """Correction d'une question + classement cumulé. Refusé tant que la
    fenêtre de réponse n'est pas fermée."""
    _require_enabled()
    conn = get_connection()
    partie = _partie_ou_404(conn, code)
    etat_t = service.etat_temporel(partie)
    if not service.reveal_disponible(etat_t, index):
        conn.close()
        raise HTTPException(status_code=409, detail="La correction n'est pas encore disponible")
    detail = service.detail_question(conn, partie, index)
    if detail is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Question introuvable")
    detail["classement"] = service.classement(conn, partie["code"])
    detail["derniere"] = index == partie["nb_questions"] - 1
    conn.close()
    return detail


@router.get("")
def mes_parties(user=Depends(get_current_user)):
    """Les parties récentes du joueur, pour retrouver un salon quitté par
    mégarde (l'onglet fermé pendant qu'on cherche le code à dicter)."""
    _require_enabled()
    conn = get_connection()
    rows = conn.execute(
        "SELECT p.code, p.hote, p.nb_questions, p.started_at, p.created_at "
        "FROM multi_parties p JOIN multi_joueurs j ON j.code = p.code "
        "WHERE j.pseudo = ? ORDER BY p.created_at DESC LIMIT 10",
        (user["pseudo"],),
    ).fetchall()
    out = []
    for r in rows:
        partie = service.partie_par_code(conn, r["code"])
        etat_t = service.etat_temporel(partie)
        ligne = {**dict(r), "statut": etat_t["statut"],
                 "nb_joueurs": len(service.joueurs(conn, r["code"]))}
        if etat_t["statut"] == "termine":
            cl = service.classement(conn, r["code"])
            moi = next((c for c in cl if c["pseudo"] == user["pseudo"]), None)
            ligne["ma_position"] = moi["position"] if moi else None
            ligne["mes_points"] = moi["points"] if moi else 0
            ligne["vainqueur"] = cl[0]["pseudo"] if cl else None
        out.append(ligne)
    conn.close()
    return {"parties": out}
