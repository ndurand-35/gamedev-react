import { FC, ReactElement, memo, useMemo } from "react";

import { ComponentType, Contract, StartedContract } from "@/data/interface";
import { ClientBadge } from "@/components/contract/ClientBadge";
import { RequirementList } from "@/components/contract/RequirementList";
import { setMoney } from "@/data/redux/companySlice";
import { acceptContract } from "@/data/redux/taskSlice";
import { ensureCompetitor } from "@/data/redux/competitorSlice";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { EARLY_DELIVERY_RATIO, formatPrice, hourToWeek } from "@/data/utils";

interface ContractCardProps {
  contract: Contract;
  /**
   * Heures estimées avant de pouvoir livrer (compétence « Estimation de
   * délai ») : `undefined` sans la compétence (colonne absente), `null` si les
   * composants ne seront pas réunis dans le délai.
   */
  leadTimeHours?: number | null;
}

/** Cellule d'estimation : le délai estimé comparé au délai du contrat. */
const LeadTimeCell = ({
  leadTimeHours,
  contractHours,
}: {
  leadTimeHours: number | null;
  contractHours: number;
}): ReactElement => {
  if (leadTimeHours === null) {
    return <span className="text-error text-sm">hors délai</span>;
  }
  if (leadTimeHours === 0) {
    return <span className="text-success text-sm">stock prêt</span>;
  }
  const days = Math.ceil(leadTimeHours / 24);
  // Vert tant que la prime d'avance reste atteignable, orange sinon.
  const tone =
    leadTimeHours < contractHours * EARLY_DELIVERY_RATIO
      ? "text-success"
      : "text-warning";
  return (
    <span className={"text-sm tabular-nums whitespace-nowrap " + tone}>
      ~{days} jour{days > 1 ? "s" : ""}
    </span>
  );
};

/**
 * Ligne de contrat disponible. Signer n'exige plus d'avoir le stock : on
 * encaisse l'acompte et on s'engage sur une deadline. La couverture du stock
 * n'est affichée qu'à titre indicatif — c'est au joueur d'estimer s'il pourra
 * produire à temps.
 */
export const ContractCard: FC<ContractCardProps> = memo(
  ({ contract, leadTimeHours }): ReactElement => {
    const dispatch = useAppDispatch();

    const money = useAppSelector((state) => state.company.money);
    const time = useAppSelector((state) => state.engine.time);
    const stock = useAppSelector((state) => state.component.stock);

    // Stock couvrant chaque exigence (quantité au-dessus de la qualité
    // minimale demandée), indexé par type pour le rendu à position fixe.
    const heldByType = useMemo(() => {
      const held: Record<ComponentType, number> = {
        [ComponentType.CODE]: 0,
        [ComponentType.VISUEL]: 0,
        [ComponentType.UX]: 0,
      };
      for (const req of contract.requirements) {
        held[req.type] = stock.filter(
          (c) =>
            c.type === req.type &&
            (req.minQuality == null || c.quality >= req.minQuality),
        ).length;
      }
      return held;
    }, [stock, contract.requirements]);

    const weeks = Number(hourToWeek(contract.time));

    const submit = () => {
      dispatch(setMoney(money + contract.priceDeposit));

      const newAcceptedContract: StartedContract = {
        ...contract,
        startDate: time,
      };
      dispatch(acceptContract(newAcceptedContract));
      // Normalement déjà au marché ; un inconnu de passage y entre ici.
      dispatch(
        ensureCompetitor({
          id: contract.clientId,
          name: contract.clientName,
          image: contract.clientImage,
        }),
      );
    };

    return (
      <tr>
        <td className="font-medium">{contract.name}</td>
        <td>
          <ClientBadge
            clientId={contract.clientId}
            name={contract.clientName}
            loyaltyBonus={contract.loyaltyBonus}
          />
        </td>
        <td>
          <div className="badge badge-neutral badge-sm">
            {contract.taskDifficulty}
          </div>
        </td>
        <td className="tabular-nums whitespace-nowrap">
          {weeks} semaine{weeks > 1 ? "s" : ""}
        </td>
        {leadTimeHours !== undefined && (
          <td>
            <LeadTimeCell
              leadTimeHours={leadTimeHours}
              contractHours={contract.time}
            />
          </td>
        )}
        <td className="tabular-nums text-right">
          {formatPrice(contract.priceDeposit)}
        </td>
        <td className="tabular-nums text-right text-success">
          {formatPrice(contract.priceAdditional)}
        </td>
        <td className="tabular-nums text-right text-error">
          {formatPrice(contract.priceMalus)}
        </td>
        <td>
          <RequirementList
            requirements={contract.requirements}
            heldByType={heldByType}
          />
        </td>
        <td>
          <button
            onClick={submit}
            className="btn btn-primary btn-sm"
            title="Encaisse l'acompte et ouvre la deadline"
          >
            Signer
          </button>
        </td>
      </tr>
    );
  },
);
