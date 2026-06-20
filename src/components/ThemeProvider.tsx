"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // We still need to avoid hydration mismatch, so we keep `mounted`
  // but we can compute initial state directly.
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Read persisted preference or default to dark
    const saved = (localStorage.getItem("tripsync-theme") as Theme | null) ?? "dark";
    if (saved !== theme) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(saved);
    }
    applyTheme(saved);
    setMounted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyTheme(t: Theme) {
    const root = document.documentElement;
    if (t === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("tripsync-theme", next);
    applyTheme(next);
  }

  // Prevent rendering children until theme is applied (avoids flash)
  if (!mounted) {
    return (
      <div className="dark">
        <ThemeContext.Provider value={{ theme: "dark", toggleTheme }}>
          {children}
        </ThemeContext.Provider>
      </div>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
