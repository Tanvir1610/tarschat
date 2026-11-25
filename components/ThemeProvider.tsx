"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemePreference = "light" | "dark" | "system";
const STORAGE_KEY = "tars-theme";

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: "light" | "dark";
  setPreference: (t: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);


function apply(resolved: "light" | "dark") {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", resolved === "dark" ? "#080b16" : "#f3f5fb");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("dark");

  // Read saved preference after mount (the inline script in <head> already
  // applied the right class, so there is no flash)
  useEffect(() => {
    let saved: ThemePreference = "system";
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "light" || v === "dark" || v === "system") saved = v;
    } catch {}
    setPreferenceState(saved);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      const next =
        preference === "system" ? (mq.matches ? "dark" : "light") : preference;
      setResolved(next);
      apply(next);
    };
    update();
    if (preference !== "system") return;
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [preference]);

  const setPreference = useCallback((t: ThemePreference) => {
    setPreferenceState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {}
  }, []);

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}

// Runs before first paint to avoid a light→dark flash
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');var d=t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

