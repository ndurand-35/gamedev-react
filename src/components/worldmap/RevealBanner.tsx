import { FC, useEffect, useRef } from "react";
import { Sparks } from "iconoir-react";

import type { RevealBannerProps } from "@/data/utils/studios";

// ── MapMonde §7 — Bandeau de micro-révélation au déblocage (MYL-21, Stage 2) ─
// Récompense narrative non bloquante (coût d'asset = texte seul), déclenchée à la
// transition Verrouillé → Disponible. Voix du mentor du tutoriel (texte en v1).
//
// Bandeau 1 ligne, dimensionné sur la plus longue révélation (~70 car.) ; au-delà,
// fondu sur 2 lignes plutôt que troncature. Apparaît ~2,5 s puis se range (le
// composant appelle `onDismiss` en fin de séquence — le rangement dans le panneau
// d'aperçu §4.1 est orchestré côté parent au Stage 3).
//
// Motion :
//   • défaut          → slide + fondu (classe `reveal-banner--slide`).
//   • reduceMotion    → fondu seul, aucun déplacement (classe `reveal-banner--fade`).
// La media query prefers-reduced-motion (index.css) neutralise aussi le slide en
// dur, de sorte que le déplacement est supprimé même si l'appelant oublie le flag.
// Le glissé caméra §7 est, lui, géré par le lot globe (hors de ce composant).

const DISMISS_DELAY_MS = 2500;

export const RevealBanner: FC<RevealBannerProps> = ({
  text,
  reduceMotion = false,
  onDismiss,
}) => {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  // Auto-rangement après ~2,5 s (durée d'affichage §7). Le ref évite de relancer
  // le minuteur si l'appelant recrée `onDismiss` à chaque rendu.
  useEffect(() => {
    const t = setTimeout(() => onDismissRef.current(), DISMISS_DELAY_MS);
    return () => clearTimeout(t);
  }, [text]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`alert alert-success shadow-lg max-w-xl mx-auto ${
        reduceMotion ? "reveal-banner--fade" : "reveal-banner--slide"
      }`}
    >
      <Sparks width={20} height={20} className="shrink-0" />
      {/* 1 ligne ; déborde en 2 lignes (pas de troncature) si > ~70 car. */}
      <span className="text-sm leading-snug">{text}</span>
    </div>
  );
};
