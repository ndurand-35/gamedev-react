import { ReactElement, useMemo, useState } from "react";

import { Crown, FireFlame, Xmark } from "iconoir-react";

import { MyTable } from "@/components/Table";

import {
  Building,
  ComponentType,
  Employe,
  LOW_MORALE_THRESHOLD,
  Marketing,
  PersonType,
  ProductionPerson,
  QA,
  jobLabel,
  buildingSeats,
} from "@/data/interface";
import { formatPrice } from "@/data/utils";
import {
  assignBuilding,
  assignComponentType,
  fired,
} from "@/data/redux/employeSlice";
import { clearEmployeProgress } from "@/data/redux/componentSlice";
import { paySeverance } from "@/data/redux/companySlice";
import { applyFiringShock } from "@/data/utils/morale";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { Row, createColumnHelper } from "@tanstack/react-table";
import { MoraleHearts } from "@/components/employe/MoraleIcon";
import {
  CAMPAIGN_PANEL_ID,
  CampaignPanel,
} from "@/components/employe/CampaignPanel";
import { FireConfirmModal } from "@/components/employe/FireConfirmModal";
import { EmployeAvatar } from "@/components/employe/EmployeAvatar";
import { COMPONENT_ICON, COMPONENT_TEXT_CLASS } from "@/components/component";

const openCampaignPanel = () =>
  (
    document.getElementById(CAMPAIGN_PANEL_ID) as HTMLDialogElement | null
  )?.showModal();

const isFondateur = (e: Employe): boolean => e.id === 1;

// Le fondateur figure dans la liste (affectation, bâtiment, moral) mais ne se
// licencie pas : pas de case à cocher pour lui, donc jamais dans un batch.
const canSelectRow = (row: Row<Employe>): boolean => !isFondateur(row.original);

export const EmployeList: React.FC = (): ReactElement => {
  const dispatch = useAppDispatch();
  const buildingList = useAppSelector((state) => state.company.buildingList);
  const employes = useAppSelector((state) => state.employe.employeList);

  const occupancyByBuilding = useMemo(() => {
    const map: Record<number, number> = {};
    for (const e of employes) {
      if (e.buildingId !== undefined) {
        map[e.buildingId] = (map[e.buildingId] ?? 0) + 1;
      }
    }
    return map;
  }, [employes]);

  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  // Cibles du licenciement en attente de confirmation (null = modale fermée).
  // Renseigné par le bouton 🔥 (unitaire) ou l'action « Licencier » (batch) ;
  // le licenciement effectif n'a lieu qu'à la confirmation de la modale.
  const [fireTargets, setFireTargets] = useState<Employe[] | null>(null);
  // Mémorise s'il faut purger la sélection après un licenciement batch.
  const [fireWasBatch, setFireWasBatch] = useState(false);

  const fireSelected = () => {
    if (selected.length === 0) return;
    setFireWasBatch(true);
    setFireTargets(selected);
  };

  // Sélection courante, dans l'ordre des données (les clés sont des index).
  const selected = useMemo(
    () =>
      Object.keys(rowSelection)
        .map((index) => employes[parseInt(index)])
        .filter((e): e is Employe => e != null),
    [rowSelection, employes],
  );
  // Affectation groupée : seuls les employés de production hors formation
  // reçoivent une tâche (même règle que la fiche).
  const assignable = selected.filter(
    (e): e is ProductionPerson =>
      e.personType === PersonType.PROD && !(e as ProductionPerson).trainingType,
  );
  const assignSelected = (type: ComponentType | null) => {
    for (const e of assignable) {
      dispatch(assignComponentType({ employeId: e.id, componentType: type }));
      if (type === null) dispatch(clearEmployeProgress(e.id));
    }
  };

  const bulkBar =
    selected.length > 0 ? (
      <div
        role="toolbar"
        aria-label="Actions sur la sélection"
        // Capsule flottante au-dessus du dock : la seule pièce « jouet » de
        // la liste, visible où que l'on soit dans le tableau.
        className="fixed bottom-24 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full border-[3px] border-ink bg-white py-1.5 pr-1.5 pl-5 whitespace-nowrap shadow-toy"
      >
        <span className="font-display text-base font-semibold">
          {selected.length} sélectionné{selected.length > 1 ? "s" : ""}
        </span>
        <div className="ml-3 flex items-center gap-1.5">
          <span className="mr-1 text-sm font-bold text-base-content/70">
            Affecter
            {assignable.length !== selected.length &&
              ` (${assignable.length} en production)`}{" "}
            :
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm rounded-full bg-base-200"
            disabled={assignable.length === 0}
            onClick={() => assignSelected(null)}
          >
            Libre
          </button>
          {Object.values(ComponentType).map((t) => {
            const Icon = COMPONENT_ICON[t];
            return (
              <button
                key={t}
                type="button"
                className="btn btn-ghost btn-sm gap-1.5 rounded-full bg-base-200"
                disabled={assignable.length === 0}
                onClick={() => assignSelected(t)}
              >
                <Icon
                  width={14}
                  height={14}
                  className={COMPONENT_TEXT_CLASS[t]}
                />
                {t}
              </button>
            );
          })}
          <button
            type="button"
            className="btn btn-ghost btn-sm rounded-full bg-error text-white hover:bg-error/90"
            onClick={fireSelected}
          >
            <FireFlame width={16} height={16} />
            Licencier
          </button>
          <button
            type="button"
            aria-label="Annuler la sélection"
            className="btn btn-ghost btn-sm btn-circle"
            onClick={() => setRowSelection({})}
          >
            <Xmark width={16} height={16} />
          </button>
        </div>
      </div>
    ) : null;

  // Orchestration de la confirmation : indemnité one-shot (Σ salaires) →
  // fired(id) → clearEmployeProgress(id) par employé (purge l'entrée orpheline
  // de productionProgress, bug latent corrigé ici). Fondateur exclu.
  const confirmFire = () => {
    const targets = (fireTargets ?? []).filter((e) => !isFondateur(e));
    if (targets.length === 0) return;
    const totalSalary = targets.reduce((sum, e) => sum + e.salary, 0);
    dispatch(paySeverance(totalSalary));
    // Ceux qui restent accusent le coup — avant `fired`, tant que le bâtiment
    // des partants est encore lisible.
    dispatch(applyFiringShock(targets.map((e) => e.id)));
    targets.forEach((e) => {
      dispatch(fired(e.id));
      dispatch(clearEmployeProgress(e.id));
    });
    if (fireWasBatch) setRowSelection({});
  };

  const columns = useMemo(() => {
    const columnHelper = createColumnHelper<Employe>();
    return [
      {
        header: "Employé",
        accessorFn: (row: Employe) => row.lastName + " " + row.firstName,
        enableColumnFilter: false,
        cell: (props: any) => {
          const e: Employe = props.row.original;
          return (
            <div className="flex min-w-48 items-center gap-3">
              <EmployeAvatar employe={e} size={34} />
              <div className="leading-tight">
                <div className="flex items-center gap-1.5 font-extrabold">
                  {e.firstName} {e.lastName}
                  {isFondateur(e) && (
                    <Crown
                      width={14}
                      height={14}
                      strokeWidth={2.2}
                      className="fill-sun text-ink"
                      aria-label="Fondateur"
                    />
                  )}
                </div>
                <div className="text-xs font-bold text-base-content/70">
                  {jobLabel(e)}
                  {e.pendingRaise && " · demande une augmentation"}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        header: "Bâtiment",
        accessorFn: (row: Employe) =>
          buildingList.find((b: Building) => b.id === row.buildingId)?.name ??
          "Sans bâtiment",
        cell: (info: any) => {
          const e: Employe = info.row.original;
          return (
            <select
              className="select select-xs"
              value={e.buildingId ?? ""}
              onChange={(ev) => {
                const v = ev.target.value;
                const buildingId = v === "" ? undefined : Number(v);
                const buildingPlace =
                  buildingId === undefined
                    ? undefined
                    : (() => {
                        const target = buildingList.find(
                          (b: Building) => b.id === buildingId,
                        );
                        return target ? buildingSeats(target) : undefined;
                      })();
                dispatch(
                  assignBuilding({
                    employeId: e.id,
                    buildingId,
                    buildingPlace,
                  }),
                );
              }}
              onClick={(ev) => ev.stopPropagation()}
            >
              <option value="">Sans bâtiment</option>
              {buildingList.map((b: Building) => {
                const occupants = occupancyByBuilding[b.id] ?? 0;
                const isCurrent = b.id === e.buildingId;
                const isFull = !isCurrent && occupants >= buildingSeats(b);
                return (
                  <option key={b.id} value={b.id} disabled={isFull}>
                    {b.name} ({occupants}/{buildingSeats(b)}){isFull ? " — complet" : ""}
                  </option>
                );
              })}
            </select>
          );
        },
      },
      {
        header: "Tâche",
        accessorFn: (row: Employe) =>
          (row as ProductionPerson).assignedComponentType ?? "",
        cell: (info: any) => {
          const e = info.row.original as ProductionPerson;
          // QA / Marketing ne s'assignent pas par ComponentType : libellé de
          // couverture (QA) ou accès au panneau campagne (Marketing).
          if (e.personType === PersonType.QA) {
            return (
              <span className="text-[13px] font-bold text-base-content/70">
                Détection de bugs
              </span>
            );
          }
          if (e.personType === PersonType.MARKETING) {
            return (
              <button
                type="button"
                className="btn btn-ghost btn-xs rounded-full bg-base-200"
                onClick={(ev) => {
                  ev.stopPropagation();
                  openCampaignPanel();
                }}
              >
                Gérer la campagne
              </button>
            );
          }
          return (
            <select
              className="select select-xs"
              value={e.assignedComponentType ?? ""}
              onChange={(ev) => {
                const v = ev.target.value;
                const next = v === "" ? null : (v as ComponentType);
                dispatch(
                  assignComponentType({
                    employeId: e.id,
                    componentType: next,
                  }),
                );
                if (next === null) {
                  dispatch(clearEmployeProgress(e.id));
                }
              }}
              onClick={(ev) => ev.stopPropagation()}
            >
              <option value="">Libre</option>
              {Object.values(ComponentType).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          );
        },
      },
      {
        id: "skills",
        header: "Compétences",
        enableColumnFilter: false,
        enableSorting: false,
        cell: (info: any) => {
          const e: Employe = info.row.original;
          const values: {
            key: string;
            label: string;
            value: number;
            tick: string;
          }[] =
            e.personType === PersonType.PROD
              ? [
                  {
                    key: "c",
                    label: "Code",
                    value: (e as ProductionPerson).codeStat,
                    tick: "bg-code",
                  },
                  {
                    key: "v",
                    label: "Visuel",
                    value: (e as ProductionPerson).visualStat,
                    tick: "bg-visuel",
                  },
                  {
                    key: "u",
                    label: "UX",
                    value: (e as ProductionPerson).uxStat,
                    tick: "bg-ux",
                  },
                ]
              : e.personType === PersonType.QA
                ? [
                    {
                      key: "t",
                      label: "Test",
                      value: (e as QA).testStat,
                      tick: "bg-success",
                    },
                    {
                      key: "b",
                      label: "Détection de bugs",
                      value: (e as QA).bugDetectionStat,
                      tick: "bg-success",
                    },
                  ]
                : [
                    {
                      key: "m",
                      label: "Communication",
                      value: (e as Marketing).communicationStat,
                      tick: "bg-secondary",
                    },
                    {
                      key: "g",
                      label: "Gestion de campagne",
                      value: (e as Marketing).campaignManagementStat,
                      tick: "bg-secondary",
                    },
                  ];
          const best = Math.max(...values.map((v) => v.value));
          return (
            <span className="flex gap-3 text-[13px] tabular-nums">
              {values.map((v) => (
                <span
                  key={v.key}
                  title={`${v.label} : ${v.value}`}
                  className={
                    "inline-flex items-center gap-1 " +
                    (v.value === best
                      ? "font-extrabold"
                      : "font-bold text-base-content/60")
                  }
                >
                  <span className={`h-3.5 w-1.5 rounded-sm ${v.tick}`} />
                  {Math.round(v.value)}
                </span>
              ))}
            </span>
          );
        },
      },
      columnHelper.accessor("morale", {
        header: "Moral",
        cell: (info) => {
          const v = Math.round(info.getValue());
          return (
            <span className="flex items-center gap-2">
              <MoraleHearts morale={v} size={13} showValue={false} />
              <span
                className={
                  "text-[13px] font-extrabold tabular-nums " +
                  (v < LOW_MORALE_THRESHOLD ? "text-error" : "")
                }
              >
                {v}
              </span>
            </span>
          );
        },
      }),
      columnHelper.accessor("salary", {
        header: "Salaire / mois",
        cell: (info) => (
          <span className="block text-right font-bold whitespace-nowrap tabular-nums">
            {formatPrice(Math.round(info.getValue()))} €
          </span>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: (props) =>
          !isFondateur(props.row.original) && (
            <div className="tooltip" data-tip="Licencier">
              <button
                aria-label="Licencier"
                className="row-action btn btn-xs btn-square"
                onClick={(ev) => {
                  ev.stopPropagation();
                  setFireWasBatch(false);
                  setFireTargets([props.row.original]);
                }}
              >
                <FireFlame />
              </button>
            </div>
          ),
      }),
    ];
  }, [buildingList, occupancyByBuilding, dispatch]);

  return (
    <div className="space-y-4">
      <div>
        <MyTable
          columns={columns}
          defaultData={employes}
          title={
            employes.length + " Employé" + (employes.length > 1 ? "s" : "")
          }
          isRowSelectable={canSelectRow}
          rowSelection={rowSelection}
          setRowSelection={setRowSelection}
          action={<></>}
          toolbar={bulkBar}
        />
      </div>
      <CampaignPanel />
      <FireConfirmModal
        targets={fireTargets}
        onConfirm={confirmFire}
        onClose={() => setFireTargets(null)}
      />
    </div>
  );
};
