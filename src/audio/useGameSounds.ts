import { useEffect, useRef } from "react";

import { useAppSelector } from "@/data/redux/hooks";
import { playAttention, playGameOver, playNotify } from "@/audio/sfx";

/**
 * Sons portés par l'état de la partie (monté au niveau du jeu) : chaque
 * nouvelle notification selon sa gravité, une décision ou un prêt de
 * sauvetage qui attend le joueur, la faillite.
 */
export function useGameSounds(): void {
  const last = useAppSelector(
    (s) => s.notification.list[s.notification.list.length - 1],
  );
  const pendingDecision = useAppSelector((s) => !!s.events.pending);
  const pendingRescue = useAppSelector((s) => !!s.engine.pendingRescue);
  const gameOver = useAppSelector((s) => !!s.engine.gameOver);

  // Au montage (chargement d'une sauvegarde), la dernière notification est
  // déjà ancienne : on ne la sonorise pas.
  const lastSeenId = useRef(last?.id);
  useEffect(() => {
    if (!last || last.id === lastSeenId.current) return;
    lastSeenId.current = last.id;
    playNotify(last.type);
  }, [last]);

  useEffect(() => {
    if (pendingDecision || pendingRescue) playAttention();
  }, [pendingDecision, pendingRescue]);

  useEffect(() => {
    if (gameOver) playGameOver();
  }, [gameOver]);
}
