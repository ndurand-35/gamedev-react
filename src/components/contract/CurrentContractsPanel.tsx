import { FC, ReactElement } from "react";
import { NavLink } from "react-router-dom";
import { NavArrowRight, Page } from "iconoir-react";

import { ComponentType, StartedContract } from "@/data/interface";
import { KindPill } from "@/components/component";
import { kindFamily, kindLabel } from "@/data/utils/recipes";
import {
  deadlineLabel,
  useContractDelivery,
} from "@/components/contract/useContractDelivery";
import { useAppSelector } from "@/data/redux/hooks";
import { formatPrice } from "@/data/utils";

/** Pastille et jauge du type, dans sa couleur. */
const TYPE_FILL: Record<ComponentType, string> = {
  [ComponentType.CODE]: "bg-code",
  [ComponentType.VISUEL]: "bg-visuel",
  [ComponentType.UX]: "bg-ux",
};

/**
 * Un contrat signé, en carte de mission : bandeau du délai, client, gain à la
 * livraison, une jauge par composant demandé et le bouton Livrer. Le
 * conseiller de livraison reste sur la page Contrats.
 */
const MissionCard: FC<{ contract: StartedContract }> = ({
  contract,
}): ReactElement => {
  const { deliverable, heldByKind, hoursLeft, daysLeft, early, deliver } =
    useContractDelivery(contract);

  // Le bandeau vire à l'alerte quand le délai presse.
  const strip =
    hoursLeft <= 0
      ? "bg-error text-white"
      : hoursLeft < 24
        ? "bg-warning text-white"
        : "bg-sun text-ink";

  return (
    <article className="shrink-0 overflow-hidden rounded-[1.1rem] border-2 border-ink bg-white">
      <div
        className={`flex items-center justify-between gap-2 border-b-2 border-ink px-3.5 py-1.5 ${strip}`}
      >
        <span className="font-display text-xs font-bold tracking-wider uppercase">
          Contrat en cours
        </span>
        <span className="text-xs font-extrabold whitespace-nowrap">
          {hoursLeft <= 0
            ? deadlineLabel(hoursLeft, daysLeft)
            : `Plus que ${deadlineLabel(hoursLeft, daysLeft)}`}
        </span>
      </div>

      <div className="flex flex-col gap-3 p-3.5">
        <div>
          <h3 className="font-display text-lg leading-tight font-semibold">
            {contract.name}
          </h3>
          <p className="mt-0.5 text-xs font-bold text-base-content/70">
            {contract.clientName}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full border-2 border-ink px-2.5 py-0.5 text-xs font-extrabold tabular-nums">
            +{formatPrice(contract.priceAdditional)} €
          </span>
          {early && hoursLeft > 0 && (
            <span className="rounded-full bg-success/12 px-2.5 py-0.5 text-xs font-extrabold text-success">
              Prime d'anticipation
            </span>
          )}
        </div>

        <ul className="flex flex-col gap-2">
          {contract.requirements.map((req) => {
            const label = kindLabel(req.kind);
            const fill = TYPE_FILL[kindFamily(req.kind)];
            const held = Math.min(heldByKind[req.kind] ?? 0, req.quantity);
            return (
              <li
                key={req.kind}
                className="flex items-center gap-2 text-sm font-extrabold"
              >
                <KindPill kind={req.kind} size={22} />
                <span className="w-24 shrink-0 truncate" title={label}>
                  {label}
                </span>
                <span
                  role="progressbar"
                  aria-label={`${label} : ${held} sur ${req.quantity}`}
                  aria-valuenow={held}
                  aria-valuemin={0}
                  aria-valuemax={req.quantity}
                  className="h-3 min-w-0 flex-1 overflow-hidden rounded-full border-2 border-ink bg-base-300"
                >
                  <span
                    className={`block h-full ${fill}`}
                    style={{ width: `${(held / req.quantity) * 100}%` }}
                  />
                </span>
                <span className="w-12 shrink-0 text-right tabular-nums">
                  {held}/{req.quantity}
                </span>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={deliver}
          disabled={!deliverable}
          className="btn btn-success w-full font-display text-base text-white"
          title={deliverable ? undefined : "Stock de composants insuffisant"}
        >
          Livrer le contrat
        </button>
      </div>
    </article>
  );
};

/**
 * Colonne de droite de l'Accueil : les contrats signés, du plus pressé au
 * moins pressé, pour livrer sans quitter le studio.
 */
export const CurrentContractsPanel: FC = (): ReactElement => {
  const taskList = useAppSelector((state) => state.task.taskList);
  const available = useAppSelector(
    (state) => state.task.availableContractList.length,
  );
  const sorted = [...taskList].sort(
    (a, b) => a.startDate + a.time - (b.startDate + b.time),
  );

  return (
    <aside
      aria-label="Contrats en cours"
      className="toy-frame flex min-h-0 flex-col"
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
          Contrats
          <span className="rounded-full border-2 border-ink bg-base-200 px-2 font-sans text-xs font-extrabold">
            {taskList.length}
          </span>
        </h2>
        <NavLink
          to="/game/product/contract"
          className="btn btn-ghost btn-sm gap-1 rounded-full"
        >
          Tous
          <NavArrowRight width={14} height={14} strokeWidth={2.4} />
        </NavLink>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[1.1rem] border-2 border-dashed border-base-content/25 px-4 py-6 text-center">
            <Page
              width={28}
              height={28}
              strokeWidth={2}
              className="text-base-content/50"
            />
            <p className="text-sm font-bold text-base-content/70">
              Aucun contrat signé.
            </p>
            <NavLink
              to="/game/product/contract"
              className="btn btn-primary btn-sm"
            >
              {available > 0
                ? `${available} contrat${available > 1 ? "s" : ""} disponible${available > 1 ? "s" : ""}`
                : "Voir les contrats"}
            </NavLink>
          </div>
        ) : (
          sorted.map((c) => <MissionCard key={c.id} contract={c} />)
        )}
      </div>
    </aside>
  );
};
