import { useMemo } from "react";

import { ComponentType, StartedContract } from "@/data/interface";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import {
  EARLY_DELIVERY_RATIO,
  deliverContract,
  selectBestComponents,
} from "@/data/utils";

/**
 * Ce que partagent les cartes d'un contrat signé (page Contrats, colonne de
 * l'Accueil) : le stock qui le couvre, le délai, la prime et la livraison.
 */
export const useContractDelivery = (contract: StartedContract) => {
  const dispatch = useAppDispatch();
  const time = useAppSelector((state) => state.engine.time);
  const stock = useAppSelector((state) => state.component.stock);

  // Sélection sur le stock RÉEL : c'est elle qui doit décider si le bouton est
  // actif, puisque c'est exactement ce que `deliverContract` consommera.
  const selection = useMemo(
    () => selectBestComponents(stock, contract.requirements),
    [stock, contract.requirements],
  );
  const deliverable = selection.missing.length === 0;

  // Ce que le stock couvre déjà, par type : la sélection ne remonte que le
  // manque, le reste est donc réputé disponible.
  const heldByType = useMemo(() => {
    const held: Record<ComponentType, number> = {
      [ComponentType.CODE]: 0,
      [ComponentType.VISUEL]: 0,
      [ComponentType.UX]: 0,
    };
    for (const req of contract.requirements) {
      const missing = selection.missing.find((m) => m.type === req.type);
      held[req.type] = req.quantity - (missing?.quantity ?? 0);
    }
    return held;
  }, [contract.requirements, selection.missing]);

  const hoursLeft = contract.startDate + contract.time - time;
  const daysLeft = Math.max(0, Math.round(hoursLeft / 24));
  // La fenêtre de prime est un fait du contrat, pas un conseil : affichée
  // même sans compétence.
  const early =
    time - contract.startDate < contract.time * EARLY_DELIVERY_RATIO;
  const deliver = () => dispatch(deliverContract(contract.id));

  return { deliverable, heldByType, hoursLeft, daysLeft, early, deliver };
};

/** « 3 jours », « 1 jour », « Délai dépassé ». */
export const deadlineLabel = (hoursLeft: number, daysLeft: number): string =>
  hoursLeft <= 0
    ? "Délai dépassé"
    : `${daysLeft} jour${daysLeft > 1 ? "s" : ""}`;
