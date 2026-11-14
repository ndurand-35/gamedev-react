import { ReactElement, useState } from "react";

import { Search, WarningTriangle } from "iconoir-react";

import { CandidateSearchModal } from "@/components/employe/CandidateSearchModal";
import { DossierCard } from "@/components/employe/DossierCard";
import { groupByDossier } from "@/components/employe/searchDossier";
import {
  selectRecruitmentCap,
  selectRemainingSlots,
} from "@/data/redux/selectors";
import { useAppSelector } from "@/data/redux/hooks";

// ─────────────────────────────────────────────────────────────────────────────
// Pôle Emploi : les dossiers de recherche en cours. Chaque recherche commandée
// ramène ses profils dans un dossier ; un clic ouvre la page du dossier, où se
// mènent entretiens, négociations et embauches.
// ─────────────────────────────────────────────────────────────────────────────

/** Au-delà, les places se lisent en chiffres plutôt qu'en bureaux dessinés. */
const MAX_SEAT_ICONS = 12;

export const PoleEmploye: React.FC = (): ReactElement => {
  const candidateList = useAppSelector((state) => state.employe.candidateList);
  const time = useAppSelector((state) => state.engine.time);
  // Plafond de recrutement (cross-slice : cap = somme des places des bâtiments).
  const recruitmentCap = useAppSelector(selectRecruitmentCap);
  const remainingSlots = useAppSelector(selectRemainingSlots);
  const capReached = remainingSlots <= 0;
  const free = Math.max(0, remainingSlots);

  // Commande de recherche : formulaire déporté dans une modale.
  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = () => setSearchOpen(true);

  const dossiers = groupByDossier(candidateList);

  return (
    <div className="space-y-5">
      {/* Tête de page : places de recrutement, commande d'une recherche. */}
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="font-display text-2xl font-bold">Dossiers</h1>
        <div className="flex items-center gap-2.5">
          {recruitmentCap <= MAX_SEAT_ICONS && (
            <span className="flex gap-1" aria-hidden="true">
              {Array.from({ length: recruitmentCap }, (_, i) => (
                <span
                  key={i}
                  className={
                    "size-5 rounded-md border-2 border-ink " +
                    (i < recruitmentCap - free ? "bg-ink" : "border-dashed")
                  }
                />
              ))}
            </span>
          )}
          <span className="text-sm font-extrabold">
            {free} place{free > 1 ? "s" : ""} libre{free > 1 ? "s" : ""}
            <span className="text-base-content/60"> sur {recruitmentCap}</span>
          </span>
        </div>
        {dossiers.length > 0 && (
          // Le vivier ne se remplit plus tout seul : c'est le joueur qui
          // commande (et paie) une recherche ciblée.
          <button
            type="button"
            className="btn btn-primary ml-auto gap-2"
            onClick={openSearch}
            data-tuto="recruit-search"
          >
            <Search width={17} height={17} strokeWidth={2.4} /> Lancer une
            recherche
          </button>
        )}
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

      {dossiers.length === 0 ? (
        // Vivier vide : un bureau qui attend quelqu'un, une action.
        <div className="flex flex-col items-center justify-center gap-3.5 py-14">
          <svg
            width="150"
            height="110"
            viewBox="0 0 150 110"
            fill="none"
            stroke="var(--color-ink)"
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M14 58h92" />
            <path d="M22 58v42M98 58v42" />
            <rect x="40" y="26" width="40" height="27" rx="4" fill="#fff" />
            <path d="M60 53v5" />
            <path d="M116 66h22v14h-22z" fill="var(--color-sun)" />
            <path d="M120 80v20M134 80v20M116 52v14" />
            <path d="M50 38h10M50 44h18" strokeWidth={2.5} />
          </svg>
          <h2 className="font-display text-xl font-semibold">
            Le vivier est vide
          </h2>
          <button
            type="button"
            className="btn btn-primary gap-2"
            onClick={openSearch}
            data-tuto="recruit-search"
          >
            <Search width={17} height={17} strokeWidth={2.4} /> Lancer une
            recherche
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(19rem,1fr))] gap-5">
          {dossiers.map((d, i) => (
            <DossierCard
              key={d.key}
              dossier={d}
              now={time}
              tutoAnchor={i === 0}
            />
          ))}
        </div>
      )}

      <CandidateSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </div>
  );
};
