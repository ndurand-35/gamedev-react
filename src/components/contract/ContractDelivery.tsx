import { FC, ReactElement, useMemo } from "react";

import {
  ComponentType,
  QUALITY_BADGE_CLASS,
  QUALITY_LABELS,
  StartedContract,
  qualityFromAverage,
} from "@/data/interface";
import { RequirementList } from "@/components/contract/RequirementList";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import {
  computeAverageQuality,
  computeContractPayout,
  deliverContract,
  formatPrice,
  selectBestComponents,
} from "@/data/utils";

interface ContractDeliveryProps {
  contract: StartedContract;
}

/**
 * Carte d'un contrat signé, en attente de livraison. Le joueur y arbitre le
 * moment de livrer : le stock du moment détermine la qualité moyenne — donc le
 * solde — et la prime d'anticipation s'éteint passé 70 % du délai.
 */
export const ContractDelivery: FC<ContractDeliveryProps> = ({
  contract,
}): ReactElement => {
  const dispatch = useAppDispatch();
  const time = useAppSelector((state) => state.engine.time);
  const stock = useAppSelector((state) => state.component.stock);

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

  const payout = useMemo(() => {
    const averageQuality = computeAverageQuality(selection.consumed);
    return {
      averageQuality,
      ...computeContractPayout(contract, averageQuality, time),
    };
  }, [selection.consumed, contract, time]);

  const hoursLeft = contract.startDate + contract.time - time;
  const daysLeft = Math.max(0, Math.round(hoursLeft / 24));
  const deadlineTone =
    hoursLeft <= 0
      ? "text-error"
      : hoursLeft < 24
        ? "text-warning"
        : payout.early
          ? "text-success"
          : "";

  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <div className="flex flex-row items-center gap-2">
          <p className="font-medium">{contract.name}</p>
          <span className="badge badge-ghost badge-sm">
            {contract.clientName}
          </span>
        </div>
        <p className={"text-sm " + deadlineTone}>
          {hoursLeft <= 0
            ? "Deadline dépassée"
            : `${daysLeft} jour${daysLeft > 1 ? "s" : ""} restant${daysLeft > 1 ? "s" : ""}`}
          {payout.early && hoursLeft > 0 && (
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

      <div className="flex flex-row items-center gap-4">
        <div className="flex flex-col items-end gap-1">
          {deliverable ? (
            <>
              <span
                className={`badge badge-sm ${QUALITY_BADGE_CLASS[qualityFromAverage(payout.averageQuality)]}`}
                title="Qualité moyenne du stock qui serait consommé"
              >
                {QUALITY_LABELS[qualityFromAverage(payout.averageQuality)]}
              </span>
              <span className="text-sm font-semibold text-success tabular-nums">
                {formatPrice(payout.reward)}
              </span>
            </>
          ) : (
            <span className="text-xs opacity-60 text-right max-w-40">
              Stock incomplet — produisez les composants manquants.
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => dispatch(deliverContract(contract.id))}
          disabled={!deliverable}
          className="btn btn-primary btn-sm"
          title={
            deliverable
              ? "Consomme le stock et encaisse le solde"
              : "Stock de composants insuffisant"
          }
        >
          Livrer
        </button>
      </div>
    </div>
  );
};
