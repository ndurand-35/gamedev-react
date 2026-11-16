import { FC, ReactElement, useMemo } from "react";
import { Hourglass } from "iconoir-react";

import { StartedContract } from "@/data/interface";
import { ClientBadge } from "@/components/contract/ClientBadge";
import { DeliveryAdvisor } from "@/components/contract/DeliveryAdvisor";
import { RequirementList } from "@/components/contract/RequirementList";
import { requirementsToRecipe } from "@/data/utils/recipes";
import { useAppSelector } from "@/data/redux/hooks";
import {
  deadlineLabel,
  useContractDelivery,
} from "@/components/contract/useContractDelivery";
import { FOUNDER_ID, adviseDelivery, hasFounderSkill } from "@/data/utils";

interface ContractDeliveryProps {
  contract: StartedContract;
}

/**
 * Carte d'un contrat signé, en attente de livraison : délai, stock couvert,
 * prime d'anticipation (éteinte passé 70 % du délai) et bouton Livrer. Le
 * `DeliveryAdvisor` dit quand le contrat sera livrable, une fois la
 * compétence « Arbitrage de livraison » apprise par le fondateur : par défaut
 * le joueur juge seul, avec les faits (délai, stock, prime).
 */
export const ContractDelivery: FC<ContractDeliveryProps> = ({
  contract,
}): ReactElement => {
  const { deliverable, heldByKind, hoursLeft, daysLeft, early, deliver } =
    useContractDelivery(contract);
  const time = useAppSelector((state) => state.engine.time);
  const stock = useAppSelector((state) => state.component.stock);
  const employes = useAppSelector((state) => state.employe.employeList);
  const buildings = useAppSelector((state) => state.company.buildingList);
  const productionProgress = useAppSelector(
    (state) => state.component.productionProgress,
  );
  const productionJobs = useAppSelector(
    (state) => state.component.productionJobs,
  );
  const signed = useAppSelector((state) => state.task.taskList);
  const acquiredSkills = useAppSelector((state) => state.research.acquired);
  const founderResearching = useAppSelector(
    (state) => state.research.current !== null,
  );
  const hasAdvisor = hasFounderSkill(acquiredSkills, "delivery_advisor");

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
            productionJobs,
            time,
            buildings,
            // Les autres contrats signés passent avant ou après celui-ci,
            // selon leur échéance : les postes en Auto servent l'urgent.
            ...(() => {
              const others = signed
                .filter((c) => c.id !== contract.id)
                .sort((a, b) => a.startDate + a.time - (b.startDate + b.time));
              return {
                demand: others.map((c) => requirementsToRecipe(c.requirements)),
                priority: others.filter(
                  (c) =>
                    c.startDate + c.time < contract.startDate + contract.time,
                ).length,
              };
            })(),
          })
        : null,
    // La prévision rejoue l'atelier sur des semaines : recalculée quand le
    // stock ou l'effectif bougent, pas à chaque heure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasAdvisor, contract, stock, producing, productionJobs, buildings, signed],
  );

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
            {deadlineLabel(hoursLeft, daysLeft)}
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
          heldByKind={heldByKind}
        />
        <button
          type="button"
          onClick={deliver}
          disabled={!deliverable}
          data-tuto="contract-deliver"
          className="btn btn-primary"
          title={deliverable ? undefined : "Stock de composants insuffisant"}
        >
          Livrer
        </button>
      </div>

      {advice && (
        <DeliveryAdvisor
          advice={advice}
          time={time}
          priceMalus={contract.priceMalus}
        />
      )}
    </article>
  );
};
