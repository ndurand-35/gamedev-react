import { FC, ReactElement, memo, useMemo } from "react";

import { Contract, Recipe, StartedContract } from "@/data/interface";
import { countKinds } from "@/data/utils/recipes";
import { useUncraftableKinds } from "@/components/contract/useUncraftableKinds";
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
 * Ce que partagent la ligne et la tuile d'un contrat disponible : le stock
 * qui couvre chaque exigence, la durée en semaines et la signature.
 */
const useContractOffer = (contract: Contract) => {
  const dispatch = useAppDispatch();

  const money = useAppSelector((state) => state.company.money);
  const time = useAppSelector((state) => state.engine.time);
  const stock = useAppSelector((state) => state.component.stock);

  // Stock couvrant chaque exigence, par pièce.
  const heldByKind = useMemo<Recipe>(() => countKinds(stock), [stock]);
  // Pièces que personne au studio ne sait encore fabriquer : l'information
  // décisive avant de signer.
  const uncraftable = useUncraftableKinds();

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

  return { heldByKind, uncraftable, weeks, submit };
};

/**
 * Ligne de contrat disponible. Signer n'exige plus d'avoir le stock : on
 * encaisse l'acompte et on s'engage sur une deadline. La couverture du stock
 * n'est affichée qu'à titre indicatif — c'est au joueur d'estimer s'il pourra
 * produire à temps.
 */
export const ContractCard: FC<ContractCardProps> = memo(
  ({ contract, leadTimeHours }): ReactElement => {
    const { heldByKind, uncraftable, weeks, submit } =
      useContractOffer(contract);

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
            heldByKind={heldByKind}
            uncraftable={uncraftable}
          />
        </td>
        <td>
          <button
            onClick={submit}
            className="btn btn-primary btn-sm"
            data-tuto="contract-sign"
          >
            Signer
          </button>
        </td>
      </tr>
    );
  },
);

/**
 * Le même contrat en tuile, pour les écrans étroits où le tableau ne tient
 * pas : nom et client, puis délai et paiements, puis composants et signature.
 */
export const ContractTile: FC<ContractCardProps> = memo(
  ({ contract, leadTimeHours }): ReactElement => {
    const { heldByKind, uncraftable, weeks, submit } =
      useContractOffer(contract);

    return (
      <article className="toy-tile flex flex-col gap-3 p-3.5">
        <header className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-base leading-tight font-semibold">
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
          <span
            className="badge badge-neutral badge-sm shrink-0"
            title="Difficulté"
          >
            {contract.taskDifficulty}
          </span>
        </header>

        <dl className="grid grid-cols-3 gap-1.5 text-center">
          <div className="rounded-xl bg-base-200 px-2 py-1.5">
            <dt className="text-[11px] font-bold text-base-content/70">
              Délai
            </dt>
            <dd className="text-sm font-extrabold whitespace-nowrap tabular-nums">
              {weeks} sem.
            </dd>
          </div>
          <div className="rounded-xl bg-base-200 px-2 py-1.5">
            <dt className="text-[11px] font-bold text-base-content/70">
              Acompte
            </dt>
            <dd className="text-sm font-extrabold tabular-nums">
              {formatPrice(contract.priceDeposit)}
            </dd>
          </div>
          <div className="rounded-xl bg-base-200 px-2 py-1.5">
            <dt className="text-[11px] font-bold text-base-content/70">
              Solde
            </dt>
            <dd className="text-sm font-extrabold text-success tabular-nums">
              {formatPrice(contract.priceAdditional)}
            </dd>
          </div>
        </dl>

        <p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs font-bold text-base-content/70">
          <span>
            Malus de retard{" "}
            <span className="text-error tabular-nums">
              {formatPrice(contract.priceMalus)}
            </span>
          </span>
          {leadTimeHours !== undefined && (
            <span className="flex items-center gap-1">
              Estimation
              <LeadTimeCell
                leadTimeHours={leadTimeHours}
                contractHours={contract.time}
              />
            </span>
          )}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <RequirementList
            requirements={contract.requirements}
            heldByKind={heldByKind}
            uncraftable={uncraftable}
          />
          <button
            onClick={submit}
            className="btn btn-primary btn-sm ml-auto"
            data-tuto="contract-sign"
          >
            Signer
          </button>
        </div>
      </article>
    );
  },
);
