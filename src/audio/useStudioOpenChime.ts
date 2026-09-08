import { useEffect, useRef } from "react";

import { useAppSelector } from "@/data/redux/hooks";
import { playStudioOpenSting } from "@/audio/sfx";

// ── MapMonde — Sting d'ouverture câblé sur le hook Stage 1 (MYL-22) ───────────
// On s'accroche EXACTEMENT au point d'extension exposé par le Stage 1 :
// `studio.pendingReveal` (id du dernier studio ouvert dont le « bandeau/son reste
// à jouer », cf. studioSlice). Quand il passe à un id non nul *nouveau*, on joue
// le sting de succès. C'est l'événement d'ouverture du thunk `unlockStudio`
// (toujours déclenché par un clic → la politique d'autoplay est satisfaite).
//
// On NE consomme PAS `pendingReveal` (pas de `clearStudioReveal` ici) : son
// rangement appartient au bandeau §7 / à l'UI (Stage 3). Un ref garde le dernier
// id sonorisé pour ne jamais rejouer le sting sur un simple remontage de composant
// tant que la révélation n'a pas changé.

/** Joue le sting d'ouverture à chaque nouveau studio armé dans `pendingReveal`. */
export function useStudioOpenChime(): void {
  const pendingReveal = useAppSelector((s) => s.studio.pendingReveal);
  const lastPlayedRef = useRef<string | null>(null);

  useEffect(() => {
    if (pendingReveal && pendingReveal !== lastPlayedRef.current) {
      lastPlayedRef.current = pendingReveal;
      playStudioOpenSting();
    }
    // Révélation rangée (Stage 3) → on réarme pour la prochaine ouverture.
    if (pendingReveal === null) {
      lastPlayedRef.current = null;
    }
  }, [pendingReveal]);
}
