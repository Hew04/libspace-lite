"use client";

import { useEffect, useState } from "react";

export const FLAVOURS = [
  { id: "latte", label: "Latte", base: "#eff1f5", accent: "#8839ef" },
  { id: "frappe", label: "Frappé", base: "#303446", accent: "#ca9ee6" },
  { id: "macchiato", label: "Macchiato", base: "#24273a", accent: "#c6a0f6" },
  { id: "mocha", label: "Mocha", base: "#1e1e2e", accent: "#cba6f7" },
] as const;

export const THEME_KEY = "libspace:theme";

/**
 * Runs before first paint (inlined in <head>) so the saved flavour is applied
 * without a flash. Falls back to Latte / Mocha from the OS preference.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'mocha':'latte'}document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','latte')}})();`;

export function ThemeSwitcher({ showLabel = true }: { showLabel?: boolean }) {
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    setCurrent(document.documentElement.getAttribute("data-theme") ?? "latte");
  }, []);

  function choose(id: string) {
    document.documentElement.setAttribute("data-theme", id);
    try {
      localStorage.setItem(THEME_KEY, id);
    } catch {}
    setCurrent(id);
  }

  const label = FLAVOURS.find((f) => f.id === current)?.label;

  return (
    <div>
      {showLabel && <div className="flavour-label hide-collapsed">Theme · {label ?? "…"}</div>}
      <div className="flavours" role="group" aria-label="Colour theme" style={{ marginTop: 6 }}>
        {FLAVOURS.map((f) => (
          <button
            key={f.id}
            type="button"
            className="flavour"
            aria-pressed={current === f.id}
            title={`Catppuccin ${f.label}`}
            onClick={() => choose(f.id)}
            style={{ ["--sw-base" as string]: f.base, ["--sw-accent" as string]: f.accent }}
          >
            <span className="swatch" />
            <span className="sr-only">Catppuccin {f.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
