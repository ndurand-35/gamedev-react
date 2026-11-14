import { FC, useState } from "react";
import { Lock, Search, WarningTriangle } from "iconoir-react";

import { ComponentType, PersonType, type Seniority } from "@/data/interface";

import { searchCandidates } from "@/data/redux/recruitmentThunks";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { formatPrice } from "@/data/utils";
import { CodexLink } from "@/components/codex/CodexLink";
import { Modal } from "@/components/global/Modal";
import { ROLE_DOT, ROLE_ICON } from "@/components/employe/searchDossier";
import {
  SEARCH_BASE_FEE,
  SEARCH_CANDIDATE_LIFETIME,
  SEARCH_FEE_PER_CANDIDATE,
  SEARCH_MAX_CANDIDATES,
  SEARCH_MIN_CANDIDATES,
  SEARCH_ROLES,
  SEARCH_ROLE_FEE_MULT,
  SEARCH_ROLE_LABEL,
  SEARCH_VOLUME_EXPONENT,
  SENIORITIES,
  SENIORITY_FEE_MULT,
  SENIORITY_LABEL,
  SENIORITY_MIN_REPUTATION,
  SearchRole,
  bestUnlockedSeniority,
  computeSearchCost,
  isSeniorityUnlocked,
  searchSalaryRole,
} from "@/data/utils/recruitment";

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Précision sous le nom du poste, sur sa tuile. */
const ROLE_HINT: Record<SearchRole, string> = {
  FULLSTACK: "Code, Visuel, UX",
  [ComponentType.CODE]: "Spécialiste Code",
  [ComponentType.VISUEL]: "Spécialiste Visuel",
  [ComponentType.UX]: "Spécialiste UX",
  [PersonType.QA]: "Teste les produits",
  [PersonType.MARKETING]: "Mène les campagnes",
};

/** Nombre d'étoiles d'un niveau (Junior ★, Confirmé ★★, Senior ★★★). */
const SENIORITY_STARS: Record<Seniority, number> = {
  junior: 1,
  confirme: 2,
  senior: 3,
};

const round10 = (n: number) => Math.round(n / 10) * 10;

/** Étoiles du niveau : encre sur la ligne choisie (fond jaune), jaune sinon. */
const Stars = ({
  count,
  locked,
  onSun,
}: {
  count: number;
  locked: boolean;
  onSun: boolean;
}) => (
  <span className="flex gap-0.5" aria-hidden="true">
    {[1, 2, 3].map((i) => (
      <svg
        key={i}
        width={13}
        height={13}
        viewBox="0 0 24 24"
        className={
          i > count
            ? "fill-none"
            : locked
              ? "fill-[#cdbea6]"
              : onSun
                ? "fill-ink"
                : "fill-sun"
        }
        stroke={locked ? "#a8987f" : "var(--color-ink)"}
        strokeWidth={2.2}
        strokeLinejoin="round"
      >
        <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" />
      </svg>
    ))}
  </span>
);

/**
 * Commande d'une recherche au pôle emploi : poste, niveau et nombre de profils
 * à présenter, avec le devis détaillé. Résultat instantané, mais la prestation
 * est facturée avant toute embauche (cf. `computeSearchCost`). Les profils
 * ramenés forment un dossier.
 */
export const CandidateSearchModal: FC<Props> = ({ open, onClose }) => {
  const dispatch = useAppDispatch();
  const money = useAppSelector((s) => s.company.money);
  const reputation = useAppSelector((s) => s.company.reputation);

  const [role, setRole] = useState<SearchRole>(SEARCH_ROLES[0]);
  const [count, setCount] = useState<number>(3);
  const [seniority, setSeniority] = useState<Seniority>(() =>
    bestUnlockedSeniority(reputation),
  );

  const cost = computeSearchCost(role, count, reputation, seniority);
  const cantAfford = money < cost;

  // Devis : les mêmes facteurs que `computeSearchCost`, ligne à ligne. La
  // remise de réputation est l'écart avec le total réel, pour que les lignes
  // tombent juste malgré les arrondis.
  const mult =
    SEARCH_ROLE_FEE_MULT[searchSalaryRole(role)] *
    SENIORITY_FEE_MULT[seniority];
  const openingFee = round10(SEARCH_BASE_FEE * mult);
  const profilesFee = round10(
    SEARCH_FEE_PER_CANDIDATE * Math.pow(count, SEARCH_VOLUME_EXPONENT) * mult,
  );
  const discount = openingFee + profilesFee - cost;

  const setCountClamped = (n: number) =>
    setCount(
      Math.max(SEARCH_MIN_CANDIDATES, Math.min(SEARCH_MAX_CANDIDATES, n)),
    );

  const launch = () => {
    const result = dispatch(searchCandidates({ role, count, seniority }));
    if (result.ok) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="2xl"
      className="p-0"
      ariaLabel="Lancer une recherche"
    >
      <div className="flex items-center gap-2.5 border-b-[3px] border-ink bg-white px-6 py-4">
        <span className="flex size-9 items-center justify-center rounded-full border-[2.5px] border-ink bg-sun">
          <Search width={17} height={17} strokeWidth={2.6} />
        </span>
        <h3 className="font-display text-xl font-bold">Lancer une recherche</h3>
        <CodexLink id="recrutement" />
      </div>

      <div className="space-y-6 px-6 py-5">
        {/* Poste */}
        <fieldset className="border-0 p-0">
          <legend className="mb-2 p-0 font-display text-base font-semibold">
            Poste recherché
          </legend>
          <div
            role="radiogroup"
            aria-label="Poste recherché"
            className="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
          >
            {SEARCH_ROLES.map((r) => {
              const Icon = ROLE_ICON[r];
              const checked = r === role;
              return (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => setRole(r)}
                  className={
                    "flex items-center gap-2.5 rounded-[0.9rem] border-ink px-3 py-2 text-left transition-[translate,box-shadow] " +
                    (checked
                      ? "translate-y-0.5 border-[3px] bg-sun shadow-[0_1px_0_var(--color-ink)]"
                      : "border-2 bg-white shadow-toy-sm hover:bg-base-100")
                  }
                >
                  <span
                    className={`flex size-[30px] shrink-0 items-center justify-center rounded-full border-2 border-ink ${ROLE_DOT[r]}`}
                  >
                    <Icon width={15} height={15} strokeWidth={2.4} />
                  </span>
                  <span className="leading-tight">
                    <span className="block text-sm font-extrabold">
                      {SEARCH_ROLE_LABEL[r]}
                    </span>
                    <span className="block text-xs font-bold text-base-content/70">
                      {ROLE_HINT[r]}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 gap-5 pt-2 sm:grid-cols-[1.3fr_1fr]">
          {/* Niveau */}
          <fieldset className="border-0 p-0">
            <legend className="mb-2 p-0 font-display text-base font-semibold">
              Niveau
            </legend>
            <div
              role="radiogroup"
              aria-label="Niveau"
              className="flex flex-col gap-2"
            >
              {SENIORITIES.map((s) => {
                const unlocked = isSeniorityUnlocked(s, reputation);
                const checked = seniority === s;
                return (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    disabled={!unlocked}
                    onClick={() => setSeniority(s)}
                    className={
                      "flex items-center gap-2.5 rounded-xl px-3 py-1.5 text-left " +
                      (!unlocked
                        ? "cursor-not-allowed border-2 border-dashed border-base-content/30 bg-base-200 text-base-content/60"
                        : checked
                          ? "translate-y-0.5 border-[3px] border-ink bg-sun shadow-[0_1px_0_var(--color-ink)]"
                          : "border-2 border-ink bg-white shadow-toy-sm hover:bg-base-100")
                    }
                  >
                    <Stars
                      count={SENIORITY_STARS[s]}
                      locked={!unlocked}
                      onSun={checked && unlocked}
                    />
                    <span className="text-sm font-extrabold">
                      {SENIORITY_LABEL[s]}
                    </span>
                    {!unlocked && (
                      <span className="ml-auto flex items-center gap-1 text-xs font-extrabold">
                        <Lock width={12} height={12} strokeWidth={2.4} />
                        Réputation {SENIORITY_MIN_REPUTATION[s]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Nombre de profils */}
          <fieldset className="border-0 p-0">
            <legend className="mb-2 p-0 font-display text-base font-semibold">
              Profils présentés
            </legend>
            <div className="flex items-center justify-center gap-4 pt-1 pb-2.5">
              <button
                type="button"
                className="btn btn-sm btn-square font-display text-xl"
                aria-label="Un profil de moins"
                onClick={() => setCountClamped(count - 1)}
                disabled={count <= SEARCH_MIN_CANDIDATES}
              >
                −
              </button>
              <span
                className="min-w-9 text-center font-display text-4xl font-bold tabular-nums"
                aria-live="polite"
              >
                {count}
              </span>
              <button
                type="button"
                className="btn btn-sm btn-square font-display text-xl"
                aria-label="Un profil de plus"
                onClick={() => setCountClamped(count + 1)}
                disabled={count >= SEARCH_MAX_CANDIDATES}
              >
                +
              </button>
            </div>
            <div className="flex justify-center gap-1">
              {Array.from({ length: SEARCH_MAX_CANDIDATES }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`${i + 1} profil${i > 0 ? "s" : ""}`}
                  onClick={() => setCountClamped(i + 1)}
                  className="rounded p-0"
                >
                  <svg
                    width={20}
                    height={22}
                    viewBox="0 0 20 22"
                    aria-hidden="true"
                  >
                    <g
                      className={i < count ? "fill-role-prod" : "fill-none"}
                      stroke={i < count ? "var(--color-ink)" : "#cdbea6"}
                      strokeWidth={2}
                    >
                      <circle cx="10" cy="6.5" r="4.5" />
                      <path d="M2 21c0-4.4 3.6-7.5 8-7.5s8 3.1 8 7.5z" />
                    </g>
                  </svg>
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        {/* Devis */}
        <div className="space-y-1.5 rounded-[0.9rem] border-2 border-dashed border-base-content/25 bg-white px-4 py-3 text-sm">
          <div className="flex justify-between font-bold text-base-content/80">
            <span>Ouverture du dossier</span>
            <span className="tabular-nums">{formatPrice(openingFee)} €</span>
          </div>
          <div className="flex justify-between font-bold text-base-content/80">
            <span>
              {count} profil{count > 1 ? "s" : ""} · {SEARCH_ROLE_LABEL[role]}{" "}
              {SENIORITY_LABEL[seniority].toLowerCase()}
            </span>
            <span className="tabular-nums">{formatPrice(profilesFee)} €</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between font-bold text-success">
              <span>Remise de réputation</span>
              <span className="tabular-nums">−{formatPrice(discount)} €</span>
            </div>
          )}
          <div className="flex items-baseline justify-between border-t-[1.5px] border-base-300 pt-2">
            <span className="font-extrabold">
              Total · profils disponibles{" "}
              {Math.round(SEARCH_CANDIDATE_LIFETIME / 24)} jours
            </span>
            <span
              className={
                "font-display text-2xl font-bold tabular-nums " +
                (cantAfford ? "text-error" : "")
              }
            >
              {formatPrice(cost)} €
            </span>
          </div>
        </div>

        {cantAfford && (
          <div className="alert alert-warning py-2 text-sm">
            <WarningTriangle width={18} height={18} />
            <span>
              Trésorerie insuffisante — il manque {formatPrice(cost - money)} €.
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 border-t-[3px] border-ink bg-white px-6 py-4">
        <button
          type="button"
          className="btn btn-ghost underline underline-offset-4"
          onClick={onClose}
        >
          Annuler
        </button>
        <button
          type="button"
          className="btn btn-primary ml-auto gap-2"
          onClick={launch}
          disabled={cantAfford}
        >
          <Search width={16} height={16} strokeWidth={2.4} />
          Rechercher · {formatPrice(cost)} €
        </button>
      </div>
    </Modal>
  );
};
