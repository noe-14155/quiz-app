import { createContext, useContext, useState } from "react";
import { applyTheme, loadThemeSettings } from "./theme";

const ThemeSettingsContext = createContext(null);

export function ThemeSettingsProvider({ children }) {
  const initial = loadThemeSettings();
  const [mode, setModeState] = useState(initial.mode);
  const [accent, setAccentState] = useState(initial.accent);
  const [version, setVersion] = useState(0);

  // Applique le thème dès le premier rendu (avant même le premier paint)
  applyTheme(mode, accent);

  function setMode(newMode) {
    setModeState(newMode);
    applyTheme(newMode, accent);
    setVersion((v) => v + 1);
  }

  function setAccent(newAccent) {
    setAccentState(newAccent);
    applyTheme(mode, newAccent);
    setVersion((v) => v + 1);
  }

  return (
    <ThemeSettingsContext.Provider value={{ mode, accent, setMode, setAccent, version }}>
      {children}
    </ThemeSettingsContext.Provider>
  );
}

export function useThemeSettings() {
  return useContext(ThemeSettingsContext);
}
