import {
  ComponentType,
  DEFAULT_MORALE,
  PersonType,
  ProductionPerson,
  ProductionStatKey,
  QUALITY_LABELS,
  QUALITY_STAT_STEP,
  STAT_SCALE,
  Specialty,
  getBuildingMonthlyCharges,
  qualityFromAverage,
} from "@/data/interface";
import { initializeCompanyState } from "@/data/redux/companySlice";
import { initializeComponentState } from "@/data/redux/componentSlice";
import { initializeEmployeState } from "@/data/redux/employeSlice";
import { initializeEngineState } from "@/data/redux/engineSlice";
import { initializeTaskState } from "@/data/redux/taskSlice";
import { initializeProductState } from "@/data/redux/productSlice";
import { initializeLoanState } from "@/data/redux/loanSlice";
import { initializeFinanceState } from "@/data/redux/financeSlice";
import { initializeStudioState } from "@/data/redux/studioSlice";
import { initializeResearchState } from "@/data/redux/researchSlice";
import { clearNotifications } from "@/data/redux/notificationSlice";
import { initializeCompetitorState } from "@/data/redux/competitorSlice";
import { startTutorial } from "@/data/redux/tutorialSlice";
import { buildRoster } from "@/data/utils/competitor";
import { MAX_STAT_POSSIBLE } from "@/data/utils";
import { DEFAULT_COMPANY_STATE } from "@/data/utils/constant";
import { COMPONENT_ICON, COMPONENT_TEXT_CLASS } from "@/components/component";
import { useForm } from "@tanstack/react-form";
import { ArrowLeft } from "iconoir-react";
import { AvatarEditor } from "@/components/employe/AvatarEditor";
import { EmployeAvatar } from "@/components/employe/EmployeAvatar";
import { randomAvatar } from "@/data/utils/avatar";

import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router-dom";

// ── Budget de création du fondateur ─────────────────────────────────────────
// Le fondateur produit comme n'importe quel employé : une stat par type de
// composant (Code / Visuel / UX), lue telle quelle par getRelevantStat. Le
// budget n'est plus dépensé par le joueur : chaque profil le répartit pour lui.
export const FOUNDER_STAT_POINTS = 18 * STAT_SCALE;

// Une ligne par tâche produisible : le joueur voit directement ce que le
// profil choisi alimente en jeu.
const STAT_GROUPS: Array<{
  type: ComponentType;
  key: ProductionStatKey;
  label: string;
}> = [
  { type: ComponentType.CODE, key: "codeStat", label: "Code" },
  { type: ComponentType.VISUEL, key: "visualStat", label: "Visuel" },
  { type: ComponentType.UX, key: "uxStat", label: "UX" },
];

/** Jauge aux couleurs du composant, comme en jeu. */
const STAT_BAR_CLASS: Record<ComponentType, string> = {
  [ComponentType.CODE]: "bg-code",
  [ComponentType.VISUEL]: "bg-visuel",
  [ComponentType.UX]: "bg-ux",
};

// ── Profil : choix unique (rôle + spécialité fusionnés) ─────────────────────
// La spécialité porte à elle seule le métier : badge, enveloppe salariale,
// libellé de poste et avatar studio en sont tous dérivés. Le joueur choisit un
// profil, et ce profil fixe seul la répartition de départ — chaque preset
// dépense exactement FOUNDER_STAT_POINTS.
interface ProfileDef {
  specialty: Specialty;
  name: string;
  description: string;
  preset: Record<ProductionStatKey, number>;
}

const PROFILES: ProfileDef[] = [
  {
    specialty: "FULLSTACK",
    name: "Polyvalent",
    description: "Les trois composants au même niveau, sans point faible.",
    preset: { codeStat: 60, visualStat: 60, uxStat: 60 },
  },
  {
    specialty: ComponentType.CODE,
    name: "Développeur",
    description: "Fort en Code ; le Visuel et l'UX viendront avec les recrues.",
    preset: { codeStat: 100, visualStat: 40, uxStat: 40 },
  },
  {
    specialty: ComponentType.VISUEL,
    name: "Graphiste",
    description: "Fort en Visuel ; le Code et l'UX viendront avec les recrues.",
    preset: { codeStat: 40, visualStat: 100, uxStat: 40 },
  },
  {
    specialty: ComponentType.UX,
    name: "Designer UX",
    description:
      "Fort en UX ; le Code et le Visuel viendront avec les recrues.",
    preset: { codeStat: 40, visualStat: 40, uxStat: 100 },
  },
];

const FULLSTACK_PROFILE = PROFILES[0];

const findProfile = (specialty: Specialty): ProfileDef =>
  PROFILES.find((p) => p.specialty === specialty) ?? FULLSTACK_PROFILE;

// Qualité moyenne produite : rollComponent part de stat / QUALITY_STAT_STEP, on affiche
// donc l'espérance sans le hasard.
const previewQuality = (stat: number) =>
  QUALITY_LABELS[qualityFromAverage(stat / QUALITY_STAT_STEP)];

const STARTER_BUILDING = DEFAULT_COMPANY_STATE.buildingList[0];
const formatEuros = (n: number) => `${n.toLocaleString("fr-FR")}\u00a0€`;

// ── Saisie ───────────────────────────────────────────────────────────────────

interface FieldApi {
  name: string;
  state: { value: string; meta: { errors: unknown[]; isTouched: boolean } };
  handleBlur: () => void;
  handleChange: (value: string) => void;
}

const TextField: React.FC<{
  field: FieldApi;
  label: string;
  hint?: string;
  placeholder?: string;
  autoComplete?: string;
}> = ({ field, label, hint, placeholder, autoComplete }) => {
  const id = `new-game-${field.name}`;
  const errors = field.state.meta.errors.filter(Boolean).map(String);
  const showError = field.state.meta.isTouched && errors.length > 0;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {hint && <span className="ml-2 font-normal opacity-60">{hint}</span>}
      </label>
      <input
        id={id}
        className={"input w-full" + (showError ? " input-error" : "")}
        value={field.state.value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={showError}
        aria-describedby={showError ? `${id}-error` : undefined}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
      />
      {showError && (
        <p id={`${id}-error`} className="text-error text-xs">
          {errors.join(", ")}
        </p>
      )}
    </div>
  );
};

/**
 * Une compétence du profil choisi : icône, jauge aux couleurs du composant,
 * niveau et qualité produite. La jauge glisse d'un profil à l'autre.
 */
const StatRow: React.FC<{
  type: ComponentType;
  label: string;
  value: number;
}> = ({ type, label, value }) => {
  const Icon = COMPONENT_ICON[type];
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Icon width={16} height={16} className={COMPONENT_TEXT_CLASS[type]} />
          {label}
        </span>
        <span className="tabular-nums opacity-70">
          {value}/{MAX_STAT_POSSIBLE} · {previewQuality(value)}
        </span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-base-200"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={MAX_STAT_POSSIBLE}
        aria-valuenow={value}
      >
        <div
          className={`h-full rounded-full ${STAT_BAR_CLASS[type]} transition-[width] duration-300 ease-out motion-reduce:transition-none`}
          style={{ width: `${(value / MAX_STAT_POSSIBLE) * 100}%` }}
        />
      </div>
    </div>
  );
};

// ── Écran ────────────────────────────────────────────────────────────────────

const NewGamePage: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  // Tiré une fois : le joueur part d'une tête au hasard et la retouche.
  const [initialAvatar] = useState(randomAvatar);

  const form = useForm<ProductionPerson & { gameName: string }>({
    onSubmit: ({ value }) => {
      const { gameName, ...rest } = value;
      // Les stats suivent le profil et rien d'autre : on applique le preset à
      // la validation pour que le badge affiché en jeu ne puisse pas mentir sur
      // les stats réelles du fondateur.
      const profile = findProfile(rest.specialty);
      const director: ProductionPerson = {
        ...rest,
        firstName: rest.firstName.trim(),
        lastName: rest.lastName.trim(),
        ...profile.preset,
        specialty: profile.specialty,
      };

      dispatch(initializeEngineState({ director, gameName }));
      dispatch(initializeCompanyState());
      dispatch(initializeTaskState());
      dispatch(initializeEmployeState(director));
      dispatch(initializeComponentState());
      dispatch(initializeProductState());
      dispatch(initializeLoanState());
      dispatch(initializeFinanceState());
      dispatch(initializeStudioState());
      dispatch(initializeResearchState());
      // Le journal d'activité appartient à la partie : la nouvelle repart vide.
      dispatch(clearNotifications());
      dispatch(initializeCompetitorState(buildRoster()));
      dispatch(startTutorial());

      navigate("/game");
    },
    defaultValues: {
      gameName: "",
      id: 1,
      // Plus demandé à la création : `sex` n'alimente que le morph de l'avatar
      // isométrique, et une valeur vide y donne le morph neutre (normalizeSex).
      sex: "",
      firstName: "",
      lastName: "",
      // Le fondateur ne se verse pas de salaire : il n'entre pas dans la
      // masse salariale mensuelle (cf. processMonthlyBilling).
      salary: 0,
      personType: PersonType.PROD,
      morale: DEFAULT_MORALE + 20,
      avatar: initialAvatar,
      specialty: FULLSTACK_PROFILE.specialty,
      ...FULLSTACK_PROFILE.preset,
      codeMaxStat: MAX_STAT_POSSIBLE,
      visualMaxStat: MAX_STAT_POSSIBLE,
      uxMaxStat: MAX_STAT_POSSIBLE,
      assignedComponentType: null,
    } as ProductionPerson & { gameName: string },
  });

  const charges = getBuildingMonthlyCharges(STARTER_BUILDING);

  return (
    <div className="min-h-screen px-4 py-6 sm:py-10">
      <div className="mx-auto flex max-w-4xl flex-col gap-3">
        <Link to="/" className="btn btn-ghost btn-sm w-fit gap-1">
          <ArrowLeft width={16} height={16} />
          Menu principal
        </Link>

        <form
          className="card toy-frame"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <div className="card-body gap-6">
            <h1 className="text-2xl font-semibold">Nouvelle partie</h1>

            <div className="grid gap-6 md:grid-cols-[1fr_1.5fr]">
              <section className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold">Le fondateur</h2>
                <form.Field
                  name="firstName"
                  validators={{
                    onChange: ({ value }: { value: string }) =>
                      value.trim() ? undefined : "Indiquez votre prénom.",
                  }}
                  children={(field) => (
                    <TextField
                      field={field}
                      label="Prénom"
                      autoComplete="given-name"
                    />
                  )}
                />
                <form.Field
                  name="lastName"
                  validators={{
                    onChange: ({ value }: { value: string }) =>
                      value.trim() ? undefined : "Indiquez votre nom.",
                  }}
                  children={(field) => (
                    <TextField
                      field={field}
                      label="Nom"
                      autoComplete="family-name"
                    />
                  )}
                />
                <form.Subscribe
                  selector={(state) =>
                    `${state.values.firstName.trim()} ${state.values.lastName.trim()}`.trim()
                  }
                  children={(founder) => (
                    <form.Field
                      name="gameName"
                      children={(field) => (
                        <TextField
                          field={field}
                          label="Nom du studio"
                          hint="facultatif"
                          placeholder={
                            founder ? `Studio ${founder}` : "Studio à votre nom"
                          }
                        />
                      )}
                    />
                  )}
                />
              </section>

              <form.Field
                name="specialty"
                children={(field) => (
                  <fieldset className="flex flex-col gap-3">
                    <legend className="mb-3 font-display text-lg font-semibold">
                      Profil de départ
                    </legend>
                    {/* Les profils : de simples boutons. Les jauges, en dessous,
                        sont celles du profil choisi. */}
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {PROFILES.map((p) => {
                        const checked = field.state.value === p.specialty;
                        return (
                          <label
                            key={p.specialty}
                            className={
                              "btn btn-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary " +
                              (checked ? "btn-primary" : "btn-outline")
                            }
                          >
                            <input
                              type="radio"
                              name="specialty"
                              value={p.specialty}
                              checked={checked}
                              onChange={() => field.handleChange(p.specialty)}
                              className="sr-only"
                            />
                            {p.name}
                          </label>
                        );
                      })}
                    </div>
                    {(() => {
                      const profile = findProfile(field.state.value);
                      return (
                        <div className="rounded-box border border-base-300 p-4">
                          <p className="text-sm opacity-70">
                            {profile.description}
                          </p>
                          <div className="mt-4 flex flex-col gap-3">
                            {STAT_GROUPS.map((g) => (
                              <StatRow
                                key={g.type}
                                type={g.type}
                                label={g.label}
                                value={profile.preset[g.key]}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </fieldset>
                )}
              />
            </div>

            <form.Field
              name="avatar"
              children={(field) => (
                <section className="flex flex-col gap-4 border-t-2 border-dashed border-base-content/15 pt-5 sm:flex-row sm:items-start sm:gap-8">
                  <div className="flex flex-col items-center gap-2 sm:sticky sm:top-6">
                    <h2 className="self-start font-display text-lg font-semibold">
                      Apparence
                    </h2>
                    <form.Subscribe
                      selector={(state) => ({
                        firstName: state.values.firstName,
                        lastName: state.values.lastName,
                      })}
                      children={(names) => (
                        <EmployeAvatar
                          employe={{
                            ...names,
                            personType: PersonType.PROD,
                            avatar: field.state.value,
                          }}
                          size={136}
                        />
                      )}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <AvatarEditor
                      value={field.state.value!}
                      onChange={field.handleChange}
                    />
                  </div>
                </section>
              )}
            />

            <footer className="flex flex-col gap-4 border-t border-base-300 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <div className="flex gap-1.5">
                  <dt className="opacity-60">Local</dt>
                  <dd>Garage de {STARTER_BUILDING.place} places</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="opacity-60">En caisse</dt>
                  <dd className="tabular-nums">
                    {formatEuros(DEFAULT_COMPANY_STATE.money)}
                  </dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="opacity-60">Charges</dt>
                  <dd className="tabular-nums">
                    {formatEuros(charges)} / mois
                  </dd>
                </div>
              </dl>
              <form.Subscribe
                selector={(state) => ({
                  ready:
                    state.values.firstName.trim() !== "" &&
                    state.values.lastName.trim() !== "",
                  isSubmitting: state.isSubmitting,
                })}
                children={({ ready, isSubmitting }) => (
                  <div className="flex flex-col items-stretch gap-1 sm:items-end">
                    <button
                      type="submit"
                      disabled={!ready || isSubmitting}
                      className="btn btn-primary"
                    >
                      {isSubmitting ? "…" : "Commencer la partie"}
                    </button>
                  </div>
                )}
              />
            </footer>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewGamePage;
