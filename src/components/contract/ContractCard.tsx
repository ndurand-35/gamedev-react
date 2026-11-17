import { FC, ReactElement, memo, useMemo, useState } from "react";

import { Contract, ContractTerms, Recipe } from "@/data/interface";
import { countKinds } from "@/data/utils/recipes";
import { useUncraftableKinds } from "@/components/contract/useUncraftableKinds";
import { ClientBadge } from "@/components/contract/ClientBadge";
import { RequirementList } from "@/components/contract/RequirementList";
import { setMoney } from "@/data/redux/companySlice";
import { acceptContract } from "@/data/redux/taskSlice";
import { ensureCompetitor } from "@/data/redux/competitorSlice";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { formatPrice, hourToWeek } from "@/data/utils";
import {
  CONTRACT_TERMS,
  applyContractTerms,
  earlyWindowHours,
  negotiableTerms,
  signContract,
} from "@/data/utils/task";

interface ContractCardProps {
  contract: Contract;
  /**
   * Heures estimées avant de pouvoir livrer (compétence « Estimation de
   * délai ») : `undefined` sans la compétence (colonne absente), `null` si les
   * composants ne seront pas réunis dans le délai le plus long négociable.
   */
  leadTimeHours?: number | null;
}

type LeadTone = "success" | "warning" | "error";

/**
 * Estimation rapportée aux termes d'une formule : vert si la prime d'avance
 * reste atteignable, orange dans les temps, rouge hors délai.
 */
const leadTone = (
  leadTimeHours: number | null,
  offer: Contract & { terms: ContractTerms },
): LeadTone => {
  if (leadTimeHours === null || leadTimeHours > offer.time) return "error";
  return leadTimeHours < earlyWindowHours(offer) ? "success" : "warning";
};

const TONE_TEXT: Record<LeadTone, string> = {
  success: "text-success",
  warning: "text-warning",
  error: "text-error",
};

const TONE_DOT: Record<LeadTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-error",
};

/** Cellule d'estimation : le délai estimé comparé à la formule choisie. */
const LeadTimeCell = ({
  leadTimeHours,
  tone,
}: {
  leadTimeHours: number | null;
  tone: LeadTone;
}): ReactElement => {
  if (tone === "error") {
    return <span className="text-error text-sm">hors délai</span>;
  }
  if (leadTimeHours === 0) {
    return <span className="text-success text-sm">stock prêt</span>;
  }
  const days = Math.ceil((leadTimeHours ?? 0) / 24);
  return (
    <span
      className={"text-sm tabular-nums whitespace-nowrap " + TONE_TEXT[tone]}
    >
      ~{days} jour{days > 1 ? "s" : ""}
    </span>
  );
};

/**
 * Ce que partagent la ligne et la tuile d'un contrat disponible : le stock
 * qui couvre chaque exigence, la formule négociée (et les termes qui en
 * découlent), la durée en semaines et la signature.
 */
const useContractOffer = (
  contract: Contract,
  leadTimeHours: number | null | undefined,
) => {
  const dispatch = useAppDispatch();

  const money = useAppSelector((state) => state.company.money);
  const time = useAppSelector((state) => state.engine.time);
  const stock = useAppSelector((state) => state.component.stock);

  // Stock couvrant chaque exigence, par pièce.
  const heldByKind = useMemo<Recipe>(() => countKinds(stock), [stock]);
  // Pièces que personne au studio ne sait encore fabriquer : l'information
  // décisive avant de signer.
  const uncraftable = useUncraftableKinds();

  const options = negotiableTerms(contract);
  const [terms, setTerms] = useState<ContractTerms>("standard");
  const offer = useMemo(
    () => ({ ...applyContractTerms(contract, terms), terms }),
    [contract, terms],
  );
  const toneOf = (t: ContractTerms): LeadTone | undefined =>
    leadTimeHours === undefined
      ? undefined
      : leadTone(leadTimeHours, {
          ...applyContractTerms(contract, t),
          terms: t,
        });

  const weeks = Number(hourToWeek(offer.time));

  const submit = () => {
    dispatch(setMoney(money + contract.priceDeposit));
    dispatch(acceptContract(signContract(contract, terms, time)));
    // Normalement déjà au marché ; un inconnu de passage y entre ici.
    dispatch(
      ensureCompetitor({
        id: contract.clientId,
        name: contract.clientName,
        image: contract.clientImage,
      }),
    );
  };

  return {
    heldByKind,
    uncraftable,
    weeks,
    submit,
    options,
    terms,
    setTerms,
    offer,
    toneOf,
  };
};

/** Résumé d'une formule, en infobulle. */
const termsTitle = (t: ContractTerms): string => {
  const spec = CONTRACT_TERMS[t];
  const pct = (f: number) =>
    f === 1
      ? "inchangé"
      : `${f > 1 ? "+" : "−"}${Math.round(Math.abs(f - 1) * 100)} %`;
  return (
    `Délai ${pct(spec.time)}, solde ${pct(spec.additional)}, malus ${pct(spec.malus)}` +
    (spec.earlyBonus ? "" : ", sans prime d'avance")
  );
};

/**
 * Choix de la formule avant signature. Avec l'estimation de délai, chaque
 * formule prend la couleur de l'estimation rapportée à sa propre deadline.
 */
const TermsPicker: FC<{
  options: ContractTerms[];
  terms: ContractTerms;
  onChange: (terms: ContractTerms) => void;
  toneOf: (terms: ContractTerms) => LeadTone | undefined;
}> = ({ options, terms, onChange, toneOf }) => {
  if (options.length < 2) return null;
  return (
    <div className="join" role="radiogroup" aria-label="Formule du contrat">
      {options.map((t) => {
        const tone = toneOf(t);
        const active = t === terms;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(t)}
            title={termsTitle(t)}
            className={
              "btn join-item btn-xs gap-1 " +
              (active ? "btn-neutral" : "btn-ghost")
            }
          >
            {tone && (
              <span
                aria-hidden="true"
                className={`size-1.5 rounded-full ${TONE_DOT[tone]}`}
              />
            )}
            {CONTRACT_TERMS[t].label}
          </button>
        );
      })}
    </div>
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
    const {
      heldByKind,
      uncraftable,
      weeks,
      submit,
      options,
      terms,
      setTerms,
      offer,
      toneOf,
    } = useContractOffer(contract, leadTimeHours);
    const tone = toneOf(terms);

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
        {leadTimeHours !== undefined && tone && (
          <td>
            <LeadTimeCell leadTimeHours={leadTimeHours} tone={tone} />
          </td>
        )}
        <td className="tabular-nums text-right">
          {formatPrice(contract.priceDeposit)}
        </td>
        <td className="tabular-nums text-right text-success">
          {formatPrice(offer.priceAdditional)}
        </td>
        <td className="tabular-nums text-right text-error">
          {formatPrice(offer.priceMalus)}
        </td>
        <td>
          <RequirementList
            requirements={contract.requirements}
            heldByKind={heldByKind}
            uncraftable={uncraftable}
          />
        </td>
        <td>
          <div className="flex flex-col items-end gap-1.5">
            <TermsPicker
              options={options}
              terms={terms}
              onChange={setTerms}
              toneOf={toneOf}
            />
            <button
              onClick={submit}
              className="btn btn-primary btn-sm"
              data-tuto="contract-sign"
            >
              Signer
            </button>
          </div>
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
    const {
      heldByKind,
      uncraftable,
      weeks,
      submit,
      options,
      terms,
      setTerms,
      offer,
      toneOf,
    } = useContractOffer(contract, leadTimeHours);
    const tone = toneOf(terms);

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
              {formatPrice(offer.priceAdditional)}
            </dd>
          </div>
        </dl>

        <p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs font-bold text-base-content/70">
          <span>
            Malus de retard{" "}
            <span className="text-error tabular-nums">
              {formatPrice(offer.priceMalus)}
            </span>
          </span>
          {leadTimeHours !== undefined && tone && (
            <span className="flex items-center gap-1">
              Estimation
              <LeadTimeCell leadTimeHours={leadTimeHours} tone={tone} />
            </span>
          )}
        </p>

        <TermsPicker
          options={options}
          terms={terms}
          onChange={setTerms}
          toneOf={toneOf}
        />

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
