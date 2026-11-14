import { FC, ReactElement, useMemo } from "react";
import { Hourglass } from "iconoir-react";

import { ComponentType, StartedContract } from "@/data/interface";
import { ClientBadge } from "@/components/contract/ClientBadge";
import { DeliveryAdvisor } from "@/components/contract/DeliveryAdvisor";
import { RequirementList } from "@/components/contract/RequirementList";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import {
  EARLY_DELIVERY_RATIO,
  FOUNDER_ID,
  adviseDelivery,
  deliverContract,
  hasFounderSkill,
  selectBestComponents,
} from "@/data/utils";

interface ContractDeliveryProps {
  contract: StartedContract;
}

/**
 * Carte d'un contrat signé, en attente de livraison. Le joueur y arbitre le
 * moment de livrer : le stock du moment détermine la qualité moyenne — donc le
 * solde — et la prime d'anticipation s'éteint passé 70 % du délai. Le
 * `DeliveryAdvisor` chiffre les deux branches, mais seulement une fois la
 * compétence « Arbitrage de livraison » apprise par le fondateur : par défaut
 * le joueur arbitre seul, avec les faits (délai, stock, prime).
 */
export const ContractDelivery: FC<ContractDeliveryProps> = ({
  contract,
}): ReactElement => {
  const dispatch = useAppDispatch();
  const time = useAppSelector((state) => state.engine.time);
  const stock = useAppSelector((state) => state.component.stock);
  const employes = useAppSelector((state) => state.employe.employeList);
  const buildings = useAppSelector((state) => state.company.buildingList);
  const productionProgress = useAppSelector(
    (state) => state.component.productionProgress,
  );
  const acquiredSkills = useAppSelector((state) => state.research.acquired);
  const founderResearching = useAppSelector(
    (state) => state.research.current !== null,
  );
  const hasAdvisor = hasFounderSkill(acquiredSkills, "delivery_advisor");

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

  // Le fondateur en formation ne produit pas : la projection doit l'ignorer,
  // comme `produceComponents`.
  const producing = useMemo(
    () =>
      founderResearching
        ? employes.filter((e) => e.id !== FOUNDER_ID)
        : employes,
    [employes, founderResearching],
  );

  const advice = useMemo(
    () =>
      hasAdvisor
        ? adviseDelivery({
            contract,
            stock,
            employes: producing,
            productionProgress,
            time,
            buildings,
          })
        : null,
    [
      hasAdvisor,
      contract,
      stock,
      producing,
      productionProgress,
      time,
      buildings,
    ],
  );

  const hoursLeft = contract.startDate + contract.time - time;
  const daysLeft = Math.max(0, Math.round(hoursLeft / 24));
  // La fenêtre de prime est un fait du contrat, pas un conseil : affichée
  // même sans compétence.
  const early =
    time - contract.startDate < contract.time * EARLY_DELIVERY_RATIO;
  const deadlineChip =
    hoursLeft <= 0
      ? "bg-error text-white"
      : hoursLeft < 24
        ? "bg-warning text-white"
        : "bg-base-200";

  return (
    <article className="toy-tile flex flex-col gap-3 p-4">
      <header className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg leading-tight font-semibold">
            {contract.name}
          </h3>
          <div className="mt-1">
            <ClientBadge
              clientId={contract.clientId}
              name={contract.clientName}
              loyaltyBonus={contract.loyaltyBonus}
            />
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold ${deadlineChip}`}
          >
            <Hourglass width={12} height={12} strokeWidth={2.4} />
            {hoursLeft <= 0
              ? "Délai dépassé"
              : `${daysLeft} jour${daysLeft > 1 ? "s" : ""}`}
          </span>
          {early && hoursLeft > 0 && (
            <span className="rounded-full bg-success/12 px-2.5 py-0.5 text-xs font-extrabold text-success">
              Prime d'anticipation
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <RequirementList
          requirements={contract.requirements}
          heldByType={heldByType}
        />
        <button
          type="button"
          onClick={() => dispatch(deliverContract(contract.id))}
          disabled={!deliverable}
          data-tuto="contract-deliver"
          className="btn btn-primary"
          title={deliverable ? undefined : "Stock de composants insuffisant"}
        >
          Livrer
        </button>
      </div>

      {advice && (
        <DeliveryAdvisor advice={advice} priceMalus={contract.priceMalus} />
      )}
    </article>
  );
};
