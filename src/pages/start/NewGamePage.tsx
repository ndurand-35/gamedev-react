import { SelectInput } from "@/components/global/form/SelectInput";
import { TextInput } from "@/components/global/form/TextInput";
import {
  ComponentType,
  DEFAULT_MORALE,
  PersonType,
  ProductionPerson,
  ProductionStatKey,
  QUALITY_LABELS,
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
import { MAX_STAT_POSSIBLE } from "@/data/utils";
import { getRelevantStat } from "@/data/utils/component";
import { DEFAULT_COMPANY_STATE } from "@/data/utils/constant";
import { useForm } from "@tanstack/react-form";

import React from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

// ── Budget de création du fondateur ─────────────────────────────────────────
// Le fondateur produit comme n'importe quel employé : une stat par type de
// composant (Code / Visuel / UX), lue telle quelle par getRelevantStat. Le
// budget n'est plus dépensé par le joueur : chaque profil le répartit pour lui.
export const FOUNDER_STAT_POINTS = 18;

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

const ALL_STAT_KEYS: ProductionStatKey[] = STAT_GROUPS.map((g) => g.key);

// ── Profil : choix unique (rôle + spécialité fusionnés) ─────────────────────
// La spécialité porte à elle seule le métier : badge, enveloppe salariale,
// libellé de poste et avatar studio en sont tous dérivés. Le joueur choisit un
// profil, et ce profil fixe seul la répartition de départ — chaque preset
// dépense exactement FOUNDER_STAT_POINTS.
interface ProfileDef {
  specialty: Specialty;
  label: string;
  description: string;
  preset: Record<ProductionStatKey, number>;
}

const PROFILES: ProfileDef[] = [
  {
    specialty: "FULLSTACK",
    label: "Polyvalent — à l'aise partout",
    description:
      "Ni faiblesse ni pointe : vous produisez les trois types de composants au même niveau.",
    preset: { codeStat: 6, visualStat: 6, uxStat: 6 },
  },
  {
    specialty: ComponentType.CODE,
    label: "Développeur — spécialiste Code",
    description:
      "Vous excellez sur le Code ; le Visuel et l'UX attendront vos premiers recrutements.",
    preset: { codeStat: 10, visualStat: 4, uxStat: 4 },
  },
  {
    specialty: ComponentType.VISUEL,
    label: "Graphiste — spécialiste Visuel",
    description:
      "Vous excellez sur le Visuel ; le Code et l'UX attendront vos premiers recrutements.",
    preset: { codeStat: 4, visualStat: 10, uxStat: 4 },
  },
  {
    specialty: ComponentType.UX,
    label: "Designer UX — spécialiste UX",
    description:
      "Vous excellez sur l'UX ; le Code et le Visuel attendront vos premiers recrutements.",
    preset: { codeStat: 4, visualStat: 4, uxStat: 10 },
  },
];

const FULLSTACK_PROFILE = PROFILES[0];

const findProfile = (specialty: Specialty): ProfileDef =>
  PROFILES.find((p) => p.specialty === specialty) ?? FULLSTACK_PROFILE;

// Aperçu de la qualité moyenne produite : rollComponentQuality part de
// stat / 5, on affiche donc l'espérance sans le hasard.
const previewQuality = (values: ProductionPerson, type: ComponentType) =>
  QUALITY_LABELS[qualityFromAverage(getRelevantStat(values, type) / 5)];

const STARTER_BUILDING = DEFAULT_COMPANY_STATE.buildingList[0];

// Nouvelle page de création de partie
const NewGamePage: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const form = useForm<ProductionPerson & { gameName: string }>({
    onSubmit: ({ value }) => {
      const { gameName, ...rest } = value;
      // Les stats suivent le profil et rien d'autre : on réapplique le preset à
      // la validation pour que le badge affiché en jeu ne puisse pas mentir sur
      // les stats réelles du fondateur.
      const profile = findProfile(rest.specialty);
      const director: ProductionPerson = {
        ...rest,
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
      specialty: FULLSTACK_PROFILE.specialty,
      ...FULLSTACK_PROFILE.preset,
      codeMaxStat: MAX_STAT_POSSIBLE,
      visualMaxStat: MAX_STAT_POSSIBLE,
      uxMaxStat: MAX_STAT_POSSIBLE,
      assignedComponentType: null,
    } as ProductionPerson & { gameName: string },
  });

  // Le menu « Profil » pose la répartition : les stats ne sont plus éditables,
  // elles ne font que refléter le preset du profil sélectionné.
  const applyProfile = (specialty: Specialty) => {
    const profile = findProfile(specialty);
    ALL_STAT_KEYS.forEach((key) =>
      form.setFieldValue(key, profile.preset[key]),
    );
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center flex flex-col justify-center items-center"
      style={{ backgroundImage: "url(/menu-bg.jpg)" }}
    >
      <div className="bg-white/90 p-8 rounded-lg shadow-lg max-w-lg md:max-w-4xl w-full my-4">
        <h1 className="text-3xl font-bold mb-2 text-center text-gray-800">
          Nouvelle Partie
        </h1>
        <p className="text-center text-sm text-gray-600 mb-6">
          Vous démarrez seul dans un garage avec{" "}
          {DEFAULT_COMPANY_STATE.money.toLocaleString("fr-FR")} € et{" "}
          {getBuildingMonthlyCharges(STARTER_BUILDING)} € de charges mensuelles.
          Vos statistiques déterminent les composants que vous saurez produire.
        </p>

        <form
          className="flex flex-col gap-4 text-gray-800"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <form.Field
                name="gameName"
                children={(field) => (
                  <TextInput
                    field={field}
                    label="Nom du studio"
                    placeholder="Laissez vide pour utiliser votre nom"
                  />
                )}
              />
              <form.Field
                name="firstName"
                validators={{
                  onChange: ({ value }: { value: string }) =>
                    value.trim() ? undefined : "Prénom requis",
                }}
                children={(field) => <TextInput field={field} label="Prénom" />}
              />
              <form.Field
                name="lastName"
                validators={{
                  onChange: ({ value }: { value: string }) =>
                    value.trim() ? undefined : "Nom requis",
                }}
                children={(field) => <TextInput field={field} label="Nom" />}
              />

              {/* Profil : fixe la répartition, rôle et badge en découlent */}
              <form.Field
                name="specialty"
                children={(field) => (
                  <SelectInput
                    field={{
                      ...field,
                      handleChange: (value: Specialty) => {
                        field.handleChange(value);
                        applyProfile(value);
                      },
                    }}
                    label="Profil de départ"
                  >
                    {PROFILES.map((o) => (
                      <option key={o.specialty} value={o.specialty}>
                        {o.label}
                      </option>
                    ))}
                  </SelectInput>
                )}
              />
            </div>

            {/* Compétences du profil : lecture seule */}
            <form.Subscribe
              selector={(state) => state.values}
              children={(values) => {
                const profile = findProfile(values.specialty);

                return (
                  <div className="form-control space-y-4">
                    <div>
                      <h2 className="text-xl font-semibold">
                        Compétences de départ
                      </h2>
                      <p className="text-sm text-gray-600">
                        Elles découlent du profil choisi :{" "}
                        <span className="font-semibold">{profile.label}</span>.
                      </p>
                      <p className="text-sm text-gray-600">
                        {profile.description}
                      </p>
                    </div>

                    {STAT_GROUPS.map((group) => (
                      <div
                        key={group.type}
                        className="border border-gray-300 rounded-md p-3 space-y-2"
                      >
                        <div className="flex justify-between items-baseline">
                          <span className="font-semibold">
                            Composant {group.type}
                          </span>
                          <span className="text-xs text-gray-600">
                            Qualité moyenne :{" "}
                            {previewQuality(values, group.type)}
                          </span>
                        </div>
                        <div>
                          <div className="flex flex-row justify-between">
                            <span className="label-text">{group.label}</span>
                            <span className="font-mono text-sm">
                              {values[group.key]} / {MAX_STAT_POSSIBLE}
                            </span>
                          </div>
                          <progress
                            className="progress progress-primary w-full"
                            value={Number(values[group.key] ?? 0)}
                            max={MAX_STAT_POSSIBLE}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
          </div>

          <form.Subscribe
            selector={(state) => ({
              canSubmit: state.canSubmit,
              isSubmitting: state.isSubmitting,
            })}
            children={({ canSubmit, isSubmitting }) => (
              <button
                type="submit"
                disabled={!canSubmit}
                className="mt-2 btn btn-primary"
              >
                {isSubmitting ? "..." : "Commencer la Partie"}
              </button>
            )}
          />
        </form>
      </div>
    </div>
  );
};

export default NewGamePage;
