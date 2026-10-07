import { createContext, useCallback, useContext, useEffect, useState } from "react";

// Light / dark / system, same model as the PF Audio App: the resolved theme is
// written to <html data-theme="..."> and src/styles/tokens.css keys off it.

// Light is the default. (Key is "-v2" so browsers that stored the earlier
// "system" default start on light as well.)
const STORAGE_KEY = "pf-leaders-theme-v2"; // "light" | "dark" | "system"
const ThemeContext = createContext(null);

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false;
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === "light" || stored === "dark" || stored === "system" ? stored : "light";
    } catch {
      return "light";
    }
  });

  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e) => setSystemDark(e.matches);
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  const resolvedTheme = preference === "system" ? (systemDark ? "dark" : "light") : preference;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // Storage unavailable — the choice just won't persist.
    }
  }, [preference]);

  const cycleTheme = useCallback(() => {
    setPreference((current) => (current === "light" ? "dark" : current === "dark" ? "system" : "light"));
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, resolvedTheme, setPreference, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
