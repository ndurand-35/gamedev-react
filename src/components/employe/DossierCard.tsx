import { FC } from "react";
import { Link } from "react-router-dom";
import { Check, Hourglass, NavArrowRight, ViewGrid } from "iconoir-react";

import { formatPrice } from "@/data/utils";
import { SENIORITY_LABEL } from "@/data/utils/recruitment";
import { EmployeAvatar } from "@/components/employe/EmployeAvatar";
import {
  Dossier,
  ROLE_DOT,
  ROLE_GROUP_LABEL,
  ROLE_ICON,
  gameDateLabel,
  remainingLabel,
} from "@/components/employe/searchDossier";

/** Avatars montrés sur la chemise ; au-delà, un « +n ». */
const MAX_AVATARS = 5;

interface DossierCardProps {
  dossier: Dossier;
  /** Heure de jeu courante, pour le temps restant. */
  now: number;
  /** Repère du tutoriel (posé sur le dossier le plus récent). */
  tutoAnchor?: boolean;
}

/**
 * Chemise d'un dossier de recherche : poste, niveau, profils restants, profils
 * vérifiés, échéance. Un clic ouvre la page du dossier.
 */
export const DossierCard: FC<DossierCardProps> = ({
  dossier,
  now,
  tutoAnchor,
}) => {
  const { search, candidates } = dossier;
  const role = search?.role;
  const Icon = role ? ROLE_ICON[role] : ViewGrid;
  const verified = candidates.filter((c) => c.revealedStats).length;
  const expiries = candidates
    .map((c) => c.expiresAt)
    .filter((t): t is number => t != null);
  const left = expiries.length ? Math.min(...expiries) - now : null;
  const urgent = left != null && left < 24;
  const title = role ? ROLE_GROUP_LABEL[role] : "Sans dossier";

  return (
    <Link
      to={`/game/employe/recruit/${dossier.key}`}
      data-tuto={tutoAnchor ? "recruit-dossier" : undefined}
      aria-label={`Ouvrir le dossier ${title}${search ? ` ${SENIORITY_LABEL[search.seniority]}` : ""}`}
      className="group relative mt-3 block text-ink no-underline"
    >
      {/* Onglet de la chemise */}
      <span
        aria-hidden="true"
        className="absolute -top-3 left-5 h-4 w-24 rounded-t-[10px] border-[3px] border-b-0 border-ink bg-sun"
      />
      <span className="relative flex flex-col gap-3 rounded-[1.1rem] border-[3px] border-ink bg-white p-4 shadow-toy transition-transform group-hover:-translate-y-0.5">
        <span className="flex items-center gap-3">
          <span
            className={`flex size-10 shrink-0 items-center justify-center rounded-full border-[2.5px] border-ink ${role ? ROLE_DOT[role] : "bg-base-300"}`}
          >
            <Icon width={18} height={18} strokeWidth={2.2} />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block font-display text-lg font-semibold">
              {title}
            </span>
            <span className="block text-xs font-bold text-base-content/70">
              {search
                ? `${SENIORITY_LABEL[search.seniority]} · commandée le ${gameDateLabel(search.at)}`
                : "Profils antérieurs aux dossiers"}
            </span>
          </span>
          <NavArrowRight
            width={20}
            height={20}
            strokeWidth={2.4}
            className="shrink-0 transition-transform group-hover:translate-x-0.5"
          />
        </span>

        <span className="flex items-center gap-3">
          <span className="flex">
            {candidates.slice(0, MAX_AVATARS).map((c, i) => (
              <span key={c.id} className={i > 0 ? "-ml-2" : ""}>
                <EmployeAvatar employe={c} size={30} />
              </span>
            ))}
            {candidates.length > MAX_AVATARS && (
              <span className="-ml-2 flex size-[30px] items-center justify-center rounded-full border-2 border-ink bg-base-200 text-[11px] font-extrabold">
                +{candidates.length - MAX_AVATARS}
              </span>
            )}
          </span>
          <span className="text-sm font-extrabold">
            {candidates.length} profil{candidates.length > 1 ? "s" : ""}
            {search && (
              <span className="font-bold text-base-content/60">
                {" "}
                sur {search.count}
              </span>
            )}
          </span>
        </span>

        <span className="flex flex-wrap items-center gap-2 border-t-[1.5px] border-dashed border-base-300 pt-3 text-xs font-extrabold">
          {left != null && (
            <span
              className={
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 " +
                (urgent ? "bg-error text-white" : "bg-base-200")
              }
              title="Temps restant avant que les profils quittent le vivier"
            >
              <Hourglass width={12} height={12} strokeWidth={2.4} />
              {remainingLabel(left)}
            </span>
          )}
          {verified > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#ddf1e2] px-2 py-0.5 text-[#1f6b3a]">
              <Check width={12} height={12} strokeWidth={2.6} />
              {verified} vérifié{verified > 1 ? "s" : ""}
            </span>
          )}
          {search && (
            <span className="ml-auto text-base-content/60 tabular-nums">
              {formatPrice(search.cost)} €
            </span>
          )}
        </span>
      </span>
    </Link>
  );
};
