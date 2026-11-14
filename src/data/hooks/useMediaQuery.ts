import { useCallback, useSyncExternalStore } from "react";

/**
 * Vrai tant que la requête média correspond (ex. « (min-width: 768px) »).
 * Sert quand une vue doit être rendue d'une seule façon selon l'écran — une
 * seule cible pour le tutoriel, pas de double rendu masqué en CSS.
 */
export const useMediaQuery = (query: string): boolean => {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
};
