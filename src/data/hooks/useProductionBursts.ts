import { useEffect, useRef, useState } from "react";

import { ComponentKindId, ComponentType } from "@/data/interface";
import { useAppSelector } from "@/data/redux/hooks";

/** Composant qui vient de sortir, le temps de le mettre en scène. */
export interface ProductionBurst {
  /** Identifiant du composant : sert de `key` pour relancer l'animation. */
  id: number;
  type: ComponentType;
  kind: ComponentKindId;
  lucky: boolean;
}

/** Durée de vie d'un effet : celle de l'animation du « +1 ». */
export const PRODUCTION_BURST_MS = 1400;

// Âge maximal (heures de jeu) d'un composant pour qu'on le fête. Le rendu peut
// sauter un tick en vitesse rapide ; au-delà, c'est un composant chargé d'une
// sauvegarde, pas une production qu'on vient de voir naître.
const FRESH_WINDOW_HOURS = 3;

/**
 * Dernier composant sorti par employé (clé : id de l'employé), pendant
 * `PRODUCTION_BURST_MS`. Détection purement visuelle : on compare le stock
 * d'un rendu à l'autre, rien n'est ajouté à l'état de jeu ni à la sauvegarde.
 * Les composants déjà en stock à l'ouverture de l'écran ne sont pas fêtés.
 */
export const useProductionBursts = (): Record<number, ProductionBurst> => {
  const stock = useAppSelector((s) => s.component.stock);
  const nextId = useAppSelector((s) => s.component.nextComponentId);
  const time = useAppSelector((s) => s.engine.time);

  const lastSeenId = useRef(nextId - 1);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const [bursts, setBursts] = useState<Record<number, ProductionBurst>>({});

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  useEffect(() => {
    // Partie chargée ou relancée : les identifiants repartent plus bas.
    if (nextId - 1 < lastSeenId.current) {
      lastSeenId.current = nextId - 1;
      return;
    }
    const fresh = stock.filter(
      (c) =>
        c.id > lastSeenId.current && time - c.producedAt <= FRESH_WINDOW_HOURS,
    );
    lastSeenId.current = nextId - 1;
    if (fresh.length === 0) return;

    setBursts((prev) => {
      const next = { ...prev };
      for (const c of fresh) {
        next[c.producedBy] = {
          id: c.id,
          type: c.type,
          kind: c.kind,
          lucky: c.lucky === true,
        };
      }
      return next;
    });

    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setBursts((prev) => {
        const next = { ...prev };
        // Un effet plus récent a pu prendre la place : on ne retire que le sien.
        for (const c of fresh) {
          if (next[c.producedBy]?.id === c.id) delete next[c.producedBy];
        }
        return next;
      });
    }, PRODUCTION_BURST_MS);
    timers.current.add(timer);
  }, [stock, nextId, time]);

  return bursts;
};
