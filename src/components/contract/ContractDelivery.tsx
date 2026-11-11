import { FC, ReactElement, useMemo } from "react";

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
          })
        : null,
    [hasAdvisor, contract, stock, producing, productionProgress, time],
  );

  const hoursLeft = contract.startDate + contract.time - time;
  const daysLeft = Math.max(0, Math.round(hoursLeft / 24));
  // La fenêtre de prime est un fait du contrat, pas un conseil : affichée
  // même sans compétence.
  const early =
    time - contract.startDate < contract.time * EARLY_DELIVERY_RATIO;
  const deadlineTone =
    hoursLeft <= 0
      ? "text-error"
      : hoursLeft < 24
        ? "text-warning"
        : early
          ? "text-success"
          : "";

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-row items-center gap-2">
            <p className="font-medium">{contract.name}</p>
            <ClientBadge
              clientId={contract.clientId}
              name={contract.clientName}
              loyaltyBonus={contract.loyaltyBonus}
            />
          </div>
          <p className={"text-sm " + deadlineTone}>
            {hoursLeft <= 0
              ? "Deadline dépassée"
              : `${daysLeft} jour${daysLeft > 1 ? "s" : ""} restant${daysLeft > 1 ? "s" : ""}`}
            {early && hoursLeft > 0 && (
              <span className="ml-2 badge badge-xs badge-success">
                bonus livraison anticipée
              </span>
            )}
          </p>
          <div className="mt-1">
            <RequirementList
              requirements={contract.requirements}
              heldByType={heldByType}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => dispatch(deliverContract(contract.id))}
          disabled={!deliverable}
          className="btn btn-primary btn-sm self-start sm:self-auto"
          title={
            deliverable
              ? "Consomme le stock et encaisse le solde"
              : "Stock de composants insuffisant"
          }
        >
          Livrer
        </button>
      </div>

      {advice && (
        <DeliveryAdvisor advice={advice} priceMalus={contract.priceMalus} />
      )}
    </div>
  );
};
