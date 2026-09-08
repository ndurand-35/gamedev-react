import { useEffect, useState } from "react";

// ── MapMonde — Préférence « réduire les animations » (MYL-19, Stage 2) ───────
// Câblage moteur du §7 : l'appelant supprime le glissé/auto-rotation caméra et
// le slide quand `true` (il garde le fondu). L'habillage du bandeau vient du lot
// UI (MYL-21). Sûr en environnement sans `matchMedia` (jsdom/SSR → false).

const QUERY = "(prefers-reduced-motion: reduce)";

const hasMatchMedia = (): boolean =>
  typeof window !== "undefined" && typeof window.matchMedia === "function";

/** Reflète la préférence système, réactif aux changements à chaud. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() =>
    hasMatchMedia() ? window.matchMedia(QUERY).matches : false,
  );

  useEffect(() => {
    if (!hasMatchMedia()) return;
    const mql = window.matchMedia(QUERY);
    const onChange = () => setReduced(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
