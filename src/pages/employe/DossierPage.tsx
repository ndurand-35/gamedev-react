import { ReactElement } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "iconoir-react";

import { useTopMenu } from "@/data/hooks/useTopMenu";
import { useAppSelector } from "@/data/redux/hooks";
import { formatPrice } from "@/data/utils";
import { SENIORITY_LABEL } from "@/data/utils/recruitment";
import { SectionTabs } from "@/components/layout/SectionTabs";
import { CandidatePool } from "@/components/employe/CandidatePool";
import {
  LOOSE_DOSSIER_KEY,
  ROLE_GROUP_LABEL,
  gameDateLabel,
  remainingLabel,
} from "@/components/employe/searchDossier";
import { employeTopMenuItems } from "@/pages/employe/menu";

/**
 * Page d'un dossier du Pôle Emploi : les profils ramenés par une même
 * recherche. Le dossier se referme de lui-même quand son dernier profil est
 * embauché, écarté ou parti.
 */
export const DossierPage = (): ReactElement => {
  useTopMenu(employeTopMenuItems);
  const { dossierId = "" } = useParams();
  const time = useAppSelector((s) => s.engine.time);
  const candidates = useAppSelector((s) => s.employe.candidateList).filter(
    (c) =>
      dossierId === LOOSE_DOSSIER_KEY
        ? c.search == null
        : String(c.search?.id) === dossierId,
  );
  const search = candidates[0]?.search;
  const expiries = candidates
    .map((c) => c.expiresAt)
    .filter((t): t is number => t != null);
  const left = expiries.length ? Math.min(...expiries) - time : null;

  return (
    <div className="page-shell">
      <SectionTabs items={employeTopMenuItems} ariaLabel="Section Employés" />
      <div className="toy-frame page-frame space-y-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            to="/game/employe/recruit"
            className="btn btn-ghost btn-sm gap-1.5 rounded-full bg-white"
          >
            <ArrowLeft width={16} height={16} strokeWidth={2.4} />
            Dossiers
          </Link>
          <h1 className="font-display text-2xl font-bold">
            {search ? ROLE_GROUP_LABEL[search.role] : "Sans dossier"}
            {search && (
              <span className="font-semibold text-base-content/60">
                {" "}
                · {SENIORITY_LABEL[search.seniority]}
              </span>
            )}
          </h1>
          {candidates.length > 0 && (
            <span className="text-sm font-bold text-base-content/70">
              {candidates.length} profil{candidates.length > 1 ? "s" : ""}
              {search && ` sur ${search.count}`}
              {search &&
                ` · commandée le ${gameDateLabel(search.at)} pour ${formatPrice(search.cost)} €`}
              {left != null && ` · départ dans ${remainingLabel(left)}`}
            </span>
          )}
        </div>

        {candidates.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14">
            <h2 className="font-display text-xl font-semibold">
              Ce dossier est clos
            </h2>
            <Link to="/game/employe/recruit" className="btn btn-primary">
              Retour aux dossiers
            </Link>
          </div>
        ) : (
          <CandidatePool candidates={candidates} />
        )}
      </div>
    </div>
  );
};
