import { useMemo } from "react";

import { COMPONENT_KINDS, ComponentKindId } from "@/data/interface";
import { useAppSelector } from "@/data/redux/hooks";
import { isProductionPerson } from "@/data/utils/production";
import { craftBlocker } from "@/data/utils/recipes";
import { gateShift } from "@/data/utils/traits";

/**
 * Pièces que personne au studio ne sait fabriquer aujourd'hui (seuil de
 * compétence ou technologie). Recalculé au jour, pas à l'heure.
 */
export const useUncraftableKinds = (): Set<ComponentKindId> => {
  const employes = useAppSelector((s) => s.employe.employeList);
  const day = useAppSelector((s) => Math.floor(s.engine.time / 24));
  return useMemo(() => {
    const time = day * 24;
    const producers = employes.filter(isProductionPerson);
    return new Set(
      COMPONENT_KINDS.filter(
        (k) =>
          !producers.some(
            (e) => craftBlocker(e, k.id, time, gateShift(e)) === null,
          ),
      ).map((k) => k.id),
    );
  }, [employes, day]);
};
