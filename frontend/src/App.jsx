import { useState } from "react";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ThemeSettingsProvider, useThemeSettings } from "./design/ThemeContext";
import Home from "./Home";
import Login from "./Login";
import Chill from "./modes/chill/Chill";
import Ranked from "./modes/ranked/Ranked";
import Leaderboard from "./modes/ranked/Leaderboard";
import LocalChoice from "./modes/local/LocalChoice";
import Mise from "./modes/local/games/Mise";
import QuestionsMode from "./modes/local/games/QuestionsMode";
import Multi from "./modes/multi/Multi";
import { Profile, PublicProfile } from "./profile/Profile";

function Router() {
  const [screen, setScreen] = useState("home");
  const [viewedPseudo, setViewedPseudo] = useState(null);
  const { loading } = useAuth();

  function navigate(next) {
    setScreen(next);
  }

  function viewProfile(pseudo) {
    setViewedPseudo(pseudo);
    setScreen("public-profile");
  }

  if (loading) return null;

  if (screen === "home") return <Home screen={screen} onNavigate={navigate} />;
  if (screen === "login") return <Login screen={screen} onNavigate={navigate} />;

  if (screen.startsWith("chill-")) return <Chill screen={screen} onNavigate={navigate} />;
  if (screen.startsWith("ranked-")) return <Ranked screen={screen} onNavigate={navigate} />;
  if (screen === "leaderboard") return <Leaderboard screen={screen} onNavigate={navigate} onViewProfile={viewProfile} />;

  if (screen === "local-choice") return <LocalChoice screen={screen} onNavigate={navigate} />;
  if (screen.startsWith("mise-")) return <Mise screen={screen} onNavigate={navigate} />;
  if (screen.startsWith("questions-mode-")) return <QuestionsMode screen={screen} onNavigate={navigate} />;

  if (screen.startsWith("multi-")) return <Multi screen={screen} onNavigate={navigate} />;

  if (screen === "profile") return <Profile screen={screen} onNavigate={navigate} />;
  if (screen === "public-profile") return <PublicProfile screen={screen} onNavigate={navigate} pseudo={viewedPseudo} />;

  return <Home screen="home" onNavigate={navigate} />;
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
