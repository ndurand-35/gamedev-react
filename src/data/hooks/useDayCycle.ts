import { useEffect, useRef } from "react";

import { useAppSelector } from "@/data/redux/hooks";
import { GAME_SPEEDS } from "@/data/utils/constant";
import { nightLevel } from "@/data/utils/dayCycle";

/**
 * Part de l'effet gardée selon la vitesse : en ×3 une journée dure à peine
 * plus d'une seconde, le cycle clignoterait. En pause, on garde l'ambiance
 * de la dernière vitesse jouée.
 */
const amplitudeForSpeed = (speed: number): number | null => {
  if (speed === GAME_SPEEDS.PAUSE) return null;
  if (speed <= GAME_SPEEDS.X3) return 0;
  if (speed <= GAME_SPEEDS.X2) return 0.5;
  return 1;
};

/**
 * Publie l'intensité de la nuit dans `--night` sur la racine du document : le
 * CSS (`night-wash`, ciel étoilé, lampes) s'y accroche. Remis à zéro en
 * quittant la partie, pour que le menu principal reste en plein jour.
 */
export const useDayCycle = () => {
  const time = useAppSelector((s) => s.engine.time);
  const speed = useAppSelector((s) => s.engine.gameSpeed);
  const amplitude = useRef(1);
  amplitude.current = amplitudeForSpeed(speed) ?? amplitude.current;
  const level = nightLevel(time) * amplitude.current;

  useEffect(() => {
    document.documentElement.style.setProperty("--night", String(level));
  }, [level]);

  useEffect(
    () => () => {
      document.documentElement.style.removeProperty("--night");
    },
    [],
  );
};
