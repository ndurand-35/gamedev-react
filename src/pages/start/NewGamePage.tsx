import { RangeInput } from "@/components/global/form/RangeInput";
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
// composant (Code / Visuel / UX), lue telle quelle par getRelevantStat.
export const FOUNDER_STAT_POINTS = 18;
export const MIN_FOUNDER_STAT = 1;

// Un curseur par tâche produisible : le joueur voit directement ce que chaque
// point alimente en jeu.
const STAT_GROUPS: Array<{
  type: ComponentType;
  key: ProductionStatKey;
  label: string;
}> = [
  { type: ComponentType.CODE, key: 'codeStat', label: 'Code' },
  { type: ComponentType.VISUEL, key: 'visualStat', label: 'Visuel' },
  { type: ComponentType.UX, key: 'uxStat', label: 'UX' },
];

const ALL_STAT_KEYS: ProductionStatKey[] = STAT_GROUPS.map((g) => g.key);

// ── Profil : choix unique (rôle + spécialité fusionnés) ─────────────────────
// La spécialité porte à elle seule le métier : badge, enveloppe salariale,
// libellé de poste et avatar studio en sont tous dérivés. Le joueur choisit un
// profil, qui pose la répartition de départ.
interface ProfileDef {
  specialty: Specialty;
  label: string;
  preset: Record<ProductionStatKey, number>;
}

const PROFILES: ProfileDef[] = [
  {
    specialty: "FULLSTACK",
    label: "Polyvalent — à l'aise partout",
    preset: { codeStat: 6, visualStat: 6, uxStat: 6 },
  },
  {
    specialty: ComponentType.CODE,
    label: "Développeur — spécialiste Code",
    preset: { codeStat: 10, visualStat: 4, uxStat: 4 },
  },
  {
    specialty: ComponentType.VISUEL,
    label: "Graphiste — spécialiste Visuel",
    preset: { codeStat: 4, visualStat: 10, uxStat: 4 },
  },
  {
    specialty: ComponentType.UX,
    label: "Designer UX — spécialiste UX",
    preset: { codeStat: 4, visualStat: 4, uxStat: 10 },
  },
];

const FULLSTACK_PROFILE = PROFILES[0];

// Écart minimal entre la meilleure stat et la suivante pour parler de
// spécialité : en deçà, le fondateur est un polyvalent.
const SPECIALIST_GAP = 4;

// Le profil final est relu dans les curseurs, pas dans le menu déroulant : le
// badge affiché en jeu ne peut donc pas mentir sur les stats réelles.
const deriveProfile = (values: ProductionPerson): ProfileDef => {
  const ranked = STAT_GROUPS.map((g) => ({
    type: g.type,
    value: Number(values[g.key] ?? 0),
  })).sort((a, b) => b.value - a.value);

  if (ranked[0].value - ranked[1].value < SPECIALIST_GAP) {
    return FULLSTACK_PROFILE;
  }
  return (
    PROFILES.find((p) => p.specialty === ranked[0].type) ?? FULLSTACK_PROFILE
  );
};

const sumStats = (values: ProductionPerson): number =>
  ALL_STAT_KEYS.reduce((acc, key) => acc + Number(values[key] ?? 0), 0);

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
      // Le profil est recalculé sur la répartition finale : si le joueur a
      // retouché ses curseurs après avoir choisi un profil, badge et libellé
      // suivent les stats réellement dépensées.
      const profile = deriveProfile(rest);
      const director: ProductionPerson = {
        ...rest,
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

  // Le menu « Profil » ne fait qu'amorcer la répartition : les curseurs
  // restent libres, et c'est eux qui font foi à la validation.
  const applyProfile = (specialty: Specialty) => {
    const profile =
      PROFILES.find((p) => p.specialty === specialty) ?? FULLSTACK_PROFILE;
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

              {/* Profil : amorce la répartition, rôle et badge en découlent */}
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

            {/* Panneau de compétences */}
            <form.Subscribe
              selector={(state) => state.values}
              children={(values) => {
                const spent = sumStats(values);
                const remaining = FOUNDER_STAT_POINTS - spent;

                return (
                  <div className="form-control space-y-4">
                    <div>
                      <h2 className="text-xl font-semibold">
                        Répartir vos compétences
                      </h2>
                      <p
                        className={
                          "text-sm " +
                          (remaining < 0 ? "text-error" : "text-gray-600")
                        }
                      >
                        Points restants : {remaining} / {FOUNDER_STAT_POINTS}
                      </p>
                      <p className="text-sm text-gray-600">
                        Profil retenu :{" "}
                        <span className="font-semibold">
                          {deriveProfile(values).label}
                        </span>
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
                        <form.Field
                          name={group.key}
                          children={(field) => (
                            <RangeInput
                              field={field}
                              label={group.label}
                              min={MIN_FOUNDER_STAT}
                              max={MAX_STAT_POSSIBLE}
                            />
                          )}
                        />
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
              remaining: FOUNDER_STAT_POINTS - sumStats(state.values),
            })}
            children={({ canSubmit, isSubmitting, remaining }) => (
              <>
                <button
                  type="submit"
                  disabled={!canSubmit || remaining < 0}
                  className="mt-2 btn btn-primary"
                >
                  {isSubmitting ? "..." : "Commencer la Partie"}
                </button>
                {remaining < 0 && (
                  <p className="text-error text-sm text-center">
                    Vous avez dépensé {-remaining} point
                    {remaining < -1 ? "s" : ""} de trop.
                  </p>
                )}
              </>
            )}
          />
        </form>
      </div>
    </div>
  );
};

export default NewGamePage;
