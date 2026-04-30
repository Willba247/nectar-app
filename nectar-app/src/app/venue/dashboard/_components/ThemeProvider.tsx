"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("nectar-theme") as Theme | null;
    if (saved === "dark") {
      setTheme("dark");
      wrapperRef.current?.classList.add("dark");
    }
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      localStorage.setItem("nectar-theme", next);
      if (next === "dark") {
        wrapperRef.current?.classList.add("dark");
      } else {
        wrapperRef.current?.classList.remove("dark");
      }
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div ref={wrapperRef} className="contents">
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
