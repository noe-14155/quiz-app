import { useState } from "react";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ThemeSettingsProvider, useThemeSettings } from "./design/ThemeContext";
import NetworkGuard from "./components/NetworkGuard";
import BottomNav, { ONGLETS_PRINCIPAUX } from "./components/BottomNav";
import Home from "./Home";
import Login from "./Login";
import Chill from "./modes/chill/Chill";
import Ranked from "./modes/ranked/Ranked";
import Ranks from "./modes/ranked/Ranks";
import LocalChoice from "./modes/local/LocalChoice";
import Mise from "./modes/local/games/Mise";
import QuestionsMode from "./modes/local/games/QuestionsMode";
import Daily from "./modes/daily/Daily";
import DuJour from "./modes/daily/DuJour";
import Arcade from "./modes/arcade/Arcade";
import Duel from "./modes/duel/Duel";
import Enigme from "./modes/enigme/Enigme";
import { Profile, PublicProfile } from "./profile/Profile";
import Stats from "./profile/Stats";
import Achievements from "./profile/Achievements";
import Admin from "./admin/Admin";

function Router() {
  const [screen, setScreen] = useState("home");
  const [viewedPseudo, setViewedPseudo] = useState(null);
  const { loading } = useAuth();

  function navigate(next) {
    setScreen(next);
  }

  // Certains écrans naviguent avec un argument (ex: ouvrir le profil d'un joueur).
  function navigateWithArg(next, arg) {
    if (next === "public-profile" && arg) {
      setViewedPseudo(arg);
      setScreen("public-profile");
      return;
    }
    setScreen(next);
  }

  function viewProfile(pseudo) {
    setViewedPseudo(pseudo);
    setScreen("public-profile");
  }

  if (loading) return null;

  // Le bandeau de perte de connexion doit être visible depuis N'IMPORTE QUEL
  // écran : on isole donc la cascade de routage et on l'enveloppe.
  // La barre basse n'apparaît que sur les écrans « racine » : pendant une
  // partie, elle serait une invitation à quitter au mauvais moment.
  const surOnglet = ONGLETS_PRINCIPAUX.includes(screen);

  // Colonne pleine hauteur : le contenu défile À L'INTÉRIEUR, la barre basse
  // reste collée en bas sans dépendre de `position: fixed` — la seule façon
  // fiable d'éviter qu'elle ne saute sur iPhone quand la barre d'adresse de
  // Safari se rétracte.
  return (
    <div style={{
      // 100vh d'abord : sur les navigateurs qui ignorent dvh, la règle suivante
      // est simplement écartée et la hauteur reste correcte. Sans ce repli, le
      // conteneur n'aurait aucune hauteur et le contenu serait inaccessible.
      height: "100vh", maxHeight: "100dvh", minHeight: "100dvh",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <NetworkGuard />
      <div style={{
        flex: 1, minHeight: 0,
        overflowY: "auto", overflowX: "hidden",
        WebkitOverflowScrolling: "touch",   // inertie de défilement sur iOS
        overscrollBehaviorY: "contain",     // le corps ne défile pas derrière
      }}>
        {ecran()}
      </div>
      {surOnglet && <BottomNav actif={screen} onNavigate={navigate} />}
    </div>
  );

  function ecran() {
  if (screen === "home") return <Home onNavigate={navigate} />;
  if (screen === "du-jour") return <DuJour onNavigate={navigate} />;
  if (screen === "login") return <Login screen={screen} onNavigate={navigate} />;

  if (screen.startsWith("chill-")) return <Chill screen={screen} onNavigate={navigate} />;
  if (screen.startsWith("ranked-")) return <Ranked screen={screen} onNavigate={navigate} />;
  if (screen === "ranks") return <Ranks onNavigate={navigateWithArg} />;

  if (screen === "local-choice") return <LocalChoice screen={screen} onNavigate={navigate} />;
  if (screen === "daily") return <Daily screen={screen} onNavigate={navigate} />;
  if (screen === "survie" || screen === "chrono") return <Arcade screen={screen} onNavigate={navigate} />;
  if (screen === "duel") return <Duel onNavigate={navigate} />;
  if (screen === "enigme") return <Enigme onNavigate={navigate} />;
  if (screen.startsWith("mise-")) return <Mise screen={screen} onNavigate={navigate} />;
  if (screen.startsWith("questions-mode-")) return <QuestionsMode screen={screen} onNavigate={navigate} />;


  if (screen === "profile") return <Profile screen={screen} onNavigate={navigate} />;
  if (screen === "stats") return <Stats onNavigate={navigate} />;
  if (screen === "succes") return <Achievements onNavigate={navigate} />;
  if (screen === "public-profile") return <PublicProfile screen={screen} onNavigate={navigate} pseudo={viewedPseudo} />;
  if (screen === "admin") return <Admin screen={screen} onNavigate={navigate} />;

  return <Home screen="home" onNavigate={navigate} />;
  }
}

export default function App() {
  return (
    <ThemeSettingsProvider>
      <AuthProvider>
        <RouterWithThemeKey />
      </AuthProvider>
    </ThemeSettingsProvider>
  );
}

// La clé basée sur "version" force React à tout redémonter après un
// changement de thème, pour que chaque style inline relise la couleur à jour.
function RouterWithThemeKey() {
  const { version } = useThemeSettings();
  return <Router key={version} />;
}
