import { ReactElement, useMemo, useState } from "react";

import { Search, UserPlus, WarningTriangle } from "iconoir-react";

import {
  Candidate,
  ComponentType,
  PersonType,
  ProductionPerson,
  Specialty,
} from "@/data/interface";
import { hireCandidate } from "@/data/redux/recruitmentThunks";
import { CandidateSearchModal } from "@/components/employe/CandidateSearchModal";
import {
  selectRecruitmentCap,
  selectRemainingSlots,
} from "@/data/redux/selectors";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { createColumnHelper } from "@tanstack/react-table";
import { MyTable } from "@/components/Table";
import { ComponentTypeBadge } from "@/components/component";
import { RoleBadge } from "@/components/employe/RoleBadge";
import { HireNegotiationModal } from "@/components/employe/HireNegotiationModal";
import { CandidateCard } from "@/components/studio";
import { formatPrice } from "@/data/utils";

const SpecialtyBadge = ({ specialty }: { specialty: Specialty }) => {
  if (specialty === "FULLSTACK") {
    return <span className="badge badge-ghost badge-sm">Fullstack</span>;
  }
  return <ComponentTypeBadge type={specialty as ComponentType} variant="badge" />;
};

// Production : badge de spécialité (Code/Visuel/UX/Fullstack). QA / Marketing :
// badge de rôle coloré. Affichés au même endroit (cf. spec UX §2).
const CandidateRoleBadge = ({ candidate }: { candidate: Candidate }) => {
  if (candidate.personType === PersonType.PROD) {
    return (
      <SpecialtyBadge
        specialty={(candidate as ProductionPerson).specialty ?? "FULLSTACK"}
      />
    );
  }
  return <RoleBadge personType={candidate.personType} />;
};

// Temps restant avant qu'un candidat ne quitte le vivier (heures de jeu).
const remainingLabel = (hours: number): string => {
  if (hours <= 0) return "Expiré";
  if (hours < 24) return `${Math.ceil(hours)} h`;
  return `${Math.ceil(hours / 24)} j`;
};

export const PoleEmploye: React.FC = (): ReactElement => {
  const dispatch = useAppDispatch();
  const candidateList = useAppSelector((state) => state.employe.candidateList);
  const time = useAppSelector((state) => state.engine.time);
  // Plafond de recrutement (cross-slice : cap = somme des places des bâtiments).
  const recruitmentCap = useAppSelector(selectRecruitmentCap);
  const remainingSlots = useAppSelector(selectRemainingSlots);
  const capReached = remainingSlots <= 0;

  // Commande de recherche : formulaire déporté dans une modale.
  const [searchOpen, setSearchOpen] = useState(false);

  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  // Id du candidat en cours d'entretien / négociation (null = modale fermée).
  // On garde l'id et on relit l'objet live pour refléter `revealedStats`.
  const [negotiatingId, setNegotiatingId] = useState<number | null>(null);
  const negotiating =
    candidateList.find((c) => c.id === negotiatingId) ?? null;

  const hireSelected = () => {
    const ids = Object.keys(rowSelection)
      .map((index) => candidateList[parseInt(index)]?.id)
      .filter((id): id is number => id != null);
    // Garde-fou plafond : on s'arrête net dès qu'une embauche est refusée
    // faute de place (le thunk relit le plafond à chaque appel + pousse le toast).
    for (const id of ids) {
      const result = dispatch(hireCandidate(id));
      if (!result.ok) break;
    }
    setRowSelection({});
  };

  const columns = useMemo(() => {
    const columnHelper = createColumnHelper<Candidate>();
    return [
      {
        header: "Nom",
        accessorFn: (row: Candidate) => row.lastName + " " + row.firstName,
        enableColumnFilter: false,
        cell: (props: any) => (
          <div className="group relative flex items-center space-x-3">
            <div className="avatar avatar-placeholder">
              <div className="bg-neutral text-neutral-content rounded-full w-8">
                <span className="text-xs uppercase">
                  {props.row.original.firstName[0]}
                  {props.row.original.lastName[0]}
                </span>
              </div>
            </div>
            <div className="font-bold">
              {props.row.original.firstName} {props.row.original.lastName}
            </div>
            {/* Aperçu carte candidat au survol (panneau table inchangé) */}
            <div className="pointer-events-none absolute left-0 top-full z-50 mt-1 opacity-0 transition-opacity duration-100 group-hover:opacity-100">
              <CandidateCard
                candidate={props.row.original as Candidate}
                style={{
                  filter: "drop-shadow(0 6px 16px rgba(0,0,0,0.3))",
                }}
              />
            </div>
          </div>
        ),
      },
      {
        header: "Rôle",
        accessorFn: (row: Candidate) =>
          row.personType === PersonType.PROD
            ? (row as ProductionPerson).specialty ?? "FULLSTACK"
            : row.personType,
        cell: (info: any) => (
          <CandidateRoleBadge candidate={info.row.original as Candidate} />
        ),
      },
      {
        header: "Salaire attendu",
        accessorFn: (row: Candidate) => row.expectedSalary ?? row.salary,
        cell: (info: any) => {
          const c = info.row.original as Candidate;
          const value = c.expectedSalary ?? c.salary;
          return (
            <span className="tabular-nums">
              {c.revealedStats ? (
                formatPrice(value) + " / Mois"
              ) : (
                <span className="opacity-70">≈ {formatPrice(value)} / Mois</span>
              )}
            </span>
          );
        },
      },
      {
        header: "Entretien",
        accessorFn: (row: Candidate) => (row.revealedStats ? "Fait" : "Requis"),
        cell: (info: any) => {
          const c = info.row.original as Candidate;
          return c.revealedStats ? (
            <span className="badge badge-success badge-sm badge-outline">
              Profil vérifié
            </span>
          ) : (
            <span className="badge badge-warning badge-sm badge-outline">
              Entretien requis
            </span>
          );
        },
      },
      {
        header: "Disponible",
        accessorFn: (row: Candidate) =>
          row.expiresAt == null ? Infinity : row.expiresAt - time,
        enableColumnFilter: false,
        cell: (info: any) => {
          const expiresAt = (info.row.original as Candidate).expiresAt;
          if (expiresAt == null) return <span className="opacity-60">—</span>;
          const left = expiresAt - time;
          return (
            <span
              className={
                "badge badge-sm badge-outline " +
                (left <= 24 ? "badge-error" : "badge-ghost")
              }
              title="Temps restant avant que le candidat quitte le vivier"
            >
              {remainingLabel(left)}
            </span>
          );
        },
      },
      columnHelper.display({
        header: "Action",
        cell: (props) => (
          <div className="tooltip" data-tip="Entretien / Négociation">
            <button
              aria-label="Entretien et négociation"
              className="btn btn-xs btn-info btn-square"
              onClick={(ev) => {
                ev.stopPropagation();
                setNegotiatingId(props.row.original.id);
              }}
            >
              <UserPlus />
            </button>
          </div>
        ),
      }),
    ];
  }, [dispatch, time]);

  return (
    <div className="space-y-4">
      {/* Feedback plafond recrutement §6.1 : places restantes toujours visibles,
          et message d'orientation quand l'effectif a atteint le plafond. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm">
          Places de recrutement :{" "}
          <strong className="tabular-nums">{Math.max(0, remainingSlots)}</strong>{" "}
          <span className="opacity-60">/ {recruitmentCap}</span>
        </span>
        {/* Le vivier ne se remplit plus tout seul : c'est le joueur qui commande
            (et paie) une recherche ciblée. */}
        <button
          className="btn btn-sm btn-primary gap-1"
          onClick={() => setSearchOpen(true)}
        >
          <Search width={16} height={16} /> Lancer une recherche
        </button>
      </div>
      {capReached && (
        <div className="alert alert-warning py-2 text-sm">
          <WarningTriangle width={18} height={18} />
          <span>
            Plafond d'effectif atteint — loue un nouveau bâtiment pour recruter
            davantage.
          </span>
        </div>
      )}

      <div className="overflow-x-auto">
        <MyTable
          columns={columns}
          defaultData={candidateList}
          title={
            candidateList.length +
            " Candidat" +
            (candidateList.length > 1 ? "s" : "")
          }
          isRowSelectable={true}
          rowSelection={rowSelection}
          setRowSelection={setRowSelection}
          action={
            Object.keys(rowSelection).length > 0 ? (
              <button
                className="btn btn-xs btn-info"
                onClick={hireSelected}
                disabled={capReached}
                aria-disabled={capReached}
                title={
                  capReached
                    ? "Plafond d'effectif atteint — loue un nouveau bâtiment"
                    : undefined
                }
              >
                <UserPlus />
                <p>Embaucher (à l'aveugle)</p>
              </button>
            ) : (
              <></>
            )
          }
        />
      </div>
      <HireNegotiationModal
        candidate={negotiating}
        onClose={() => setNegotiatingId(null)}
      />
      <CandidateSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </div>
  );
};
