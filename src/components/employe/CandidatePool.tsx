import { ReactElement, useEffect, useRef, useState } from "react";

import { UserPlus, WarningTriangle, Xmark } from "iconoir-react";

import {
  Candidate,
  CandidateStatKey,
  ComponentType,
  PersonType,
  STAT_KEY_BY_TYPE,
} from "@/data/interface";
import { hireCandidate } from "@/data/redux/recruitmentThunks";
import { CandidateCvCard } from "@/components/employe/CandidateCvCard";
import { selectRemainingSlots } from "@/data/redux/selectors";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { useFounderSkill } from "@/data/hooks/useFounderSkill";
import { HireNegotiationModal } from "@/components/employe/HireNegotiationModal";
import { SearchRole } from "@/data/utils/recruitment";
import { candidateStats, statRange } from "@/data/utils/candidateStats";
import {
  ROLE_GROUP_LABEL,
  ROLE_ORDER,
  roleOf,
} from "@/components/employe/searchDossier";

// ─────────────────────────────────────────────────────────────────────────────
// Candidats d'un dossier : un groupe par poste (au sein d'un groupe, tous
// portent les mêmes stats, alignées d'une carte à l'autre), tri, sélection
// pour l'embauche à l'aveugle, entretien et négociation.
// ─────────────────────────────────────────────────────────────────────────────

type SortKey = CandidateStatKey | "average" | "salary" | "expires";

// Un spécialiste se compare d'abord sur sa stat ; les autres sur leur moyenne.
const defaultSort = (group: SearchRole): SortKey =>
  group === "FULLSTACK" ||
  group === PersonType.QA ||
  group === PersonType.MARKETING
    ? "average"
    : STAT_KEY_BY_TYPE[group as ComponentType];

interface CandidatePoolProps {
  candidates: Candidate[];
}

export const CandidatePool = ({
  candidates,
}: CandidatePoolProps): ReactElement => {
  const dispatch = useAppDispatch();
  const time = useAppSelector((state) => state.engine.time);
  const capReached = useAppSelector(selectRemainingSlots) <= 0;
  // Sans entretien, le salaire attendu d'un candidat est inconnu — sauf si le
  // fondateur sait lire un CV (compétence « Lecture de CV »).
  const hasCvReading = useFounderSkill("cv_reading");

  const [sortBy, setSortBy] = useState<Partial<Record<SearchRole, SortKey>>>(
    {},
  );

  // Sélection par id ; un candidat parti du vivier (embauché, expiré) en sort.
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const selected = selectedIds.filter((id) =>
    candidates.some((c) => c.id === id),
  );
  const toggle = (id: number) =>
    setSelectedIds((ids) =>
      ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id],
    );

  // Id du candidat en cours d'entretien / négociation (null = modale fermée).
  // On garde l'id et on relit l'objet live pour refléter `revealedStats`.
  const [negotiatingId, setNegotiatingId] = useState<number | null>(null);
  const negotiating = candidates.find((c) => c.id === negotiatingId) ?? null;

  // L'entretien mené par le fondateur ferme la modale le temps de bloquer
  // l'écran ; à la fin, on la rouvre sur le profil désormais révélé.
  const interview = useAppSelector((state) => state.employe.interview);
  const interviewedId = useRef<number | null>(null);
  useEffect(() => {
    if (interview) {
      interviewedId.current = interview.candidateId;
      return;
    }
    const id = interviewedId.current;
    interviewedId.current = null;
    if (id != null && candidates.some((c) => c.id === id)) {
      setNegotiatingId(id);
    }
  }, [interview, candidates]);

  const hireSelected = () => {
    // Garde-fou plafond : on s'arrête net dès qu'une embauche est refusée
    // faute de place (le thunk relit le plafond à chaque appel + pousse le toast).
    for (const id of selected) {
      const result = dispatch(hireCandidate(id));
      if (!result.ok) break;
    }
    setSelectedIds([]);
  };

  // Valeur triée en ordre croissant. Une stat non vérifiée compte pour le
  // milieu de sa fourchette ; un salaire inconnu passe en fin de liste sans
  // trahir d'ordre entre les inconnus (tri stable).
  const sortScore = (c: Candidate, key: SortKey): number => {
    if (key === "expires") {
      return c.expiresAt == null ? Infinity : c.expiresAt - time;
    }
    if (key === "salary") {
      return c.revealedStats || hasCvReading
        ? (c.expectedSalary ?? c.salary)
        : Infinity;
    }
    const levels = candidateStats(c)
      .filter((s) => key === "average" || s.key === key)
      .map((s) => {
        if (c.revealedStats) return s.value;
        const [lo, hi] = statRange(c, s);
        return (lo + hi) / 2;
      });
    if (levels.length === 0) return Infinity;
    return -levels.reduce((a, b) => a + b, 0) / levels.length;
  };

  const groups = ROLE_ORDER.map((role) => ({
    role,
    list: candidates.filter((c) => roleOf(c) === role),
  })).filter((g) => g.list.length > 0);
  // Un dossier ne contient en général qu'un poste : le titre de groupe
  // n'apparaît que s'il y en a plusieurs.
  const showGroupTitles = groups.length > 1;

  return (
    <div className="space-y-6">
      {capReached && (
        <div className="alert alert-warning py-2 text-sm">
          <WarningTriangle width={18} height={18} />
          <span>
            Plafond d'effectif atteint — loue un nouveau bâtiment pour recruter
            davantage.
          </span>
        </div>
      )}

      {groups.map(({ role, list }) => {
        const sortKey = sortBy[role] ?? defaultSort(role);
        const sorted = [...list].sort(
          (a, b) => sortScore(a, sortKey) - sortScore(b, sortKey),
        );
        const statOptions = candidateStats(list[0]);
        return (
          <section key={role} className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              {showGroupTitles ? (
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                  {ROLE_GROUP_LABEL[role]}
                  <span className="rounded-full border-2 border-ink bg-role-prod px-2 font-sans text-xs font-extrabold">
                    {list.length}
                  </span>
                </h2>
              ) : (
                <span />
              )}
              <label className="flex items-center gap-2 rounded-full bg-white py-1 pr-1 pl-3 text-xs font-extrabold">
                Trier par
                <select
                  className="select select-xs w-auto rounded-full border-0 bg-base-200 [--input-color:transparent]"
                  value={sortKey}
                  onChange={(e) =>
                    setSortBy((s) => ({
                      ...s,
                      [role]: e.target.value as SortKey,
                    }))
                  }
                >
                  {statOptions.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                  <option value="average">Moyenne</option>
                  <option value="salary">Salaire</option>
                  <option value="expires">Départ</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-4">
              {sorted.map((c) => (
                <CandidateCvCard
                  key={c.id}
                  candidate={c}
                  now={time}
                  hasCvReading={hasCvReading}
                  selected={selected.includes(c.id)}
                  onToggleSelect={() => toggle(c.id)}
                  onOpen={() => setNegotiatingId(c.id)}
                />
              ))}
            </div>
          </section>
        );
      })}

      {/* Sélection : capsule flottante au-dessus du dock. */}
      {selected.length > 0 && (
        <div
          role="toolbar"
          aria-label="Actions sur la sélection"
          className="fixed bottom-24 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full border-[3px] border-ink bg-white py-1.5 pr-1.5 pl-5 whitespace-nowrap shadow-toy"
        >
          <span className="mr-2 font-display text-base font-semibold">
            {selected.length} sélectionné{selected.length > 1 ? "s" : ""}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm gap-1.5 rounded-full bg-sun hover:bg-sun/90"
            onClick={hireSelected}
            disabled={capReached}
            title={
              capReached
                ? "Plafond d'effectif atteint — loue un nouveau bâtiment"
                : undefined
            }
          >
            <UserPlus width={16} height={16} /> Embaucher à l'aveugle
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle"
            aria-label="Vider la sélection"
            onClick={() => setSelectedIds([])}
          >
            <Xmark width={16} height={16} />
          </button>
        </div>
      )}

      <HireNegotiationModal
        candidate={negotiating}
        onClose={() => setNegotiatingId(null)}
      />
    </div>
  );
};
