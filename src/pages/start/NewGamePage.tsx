import { RangeInput } from "@/components/global/form/RangeInput";
import { SelectInput } from "@/components/global/form/SelectInput";
import { TextInput } from "@/components/global/form/TextInput";
import {
  DEFAULT_MORALE,
  PersonType,
  ProductionPerson,
  ProductionType,
} from "@/data/interface";
import { initializeCompanyState } from "@/data/redux/companySlice";
import { initializeComponentState } from "@/data/redux/componentSlice";
import { initializeEmployeState } from "@/data/redux/employeSlice";
import { initializeEngineState } from "@/data/redux/engineSlice";
import { initializeTaskState } from "@/data/redux/taskSlice";
import { initializeProductState } from "@/data/redux/productSlice";
import { MAX_STAT_POSSIBLE } from "@/data/utils";
import { useForm } from "@tanstack/react-form";

import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

// Enum pour les rôles
const pointToSpend = 15;

// Nouvelle page de création de partie
const NewGamePage: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const form = useForm<ProductionPerson>({
    onSubmit: ({ value }) => {
      const director: ProductionPerson = value;

      dispatch(initializeEngineState(director));
      dispatch(initializeCompanyState());
      dispatch(initializeTaskState());
      dispatch(initializeEmployeState(director));
      dispatch(initializeComponentState());
      dispatch(initializeProductState());

      navigate("/game");
    },
    defaultValues: {
      id: 1,
      sex: "M",
      firstName: "",
      lastName: "",
      salary: 0,
      personType: PersonType.PROD,
      morale: DEFAULT_MORALE + 20,
      productionType: ProductionType.DEV,
      specialty: "FULLSTACK",
      frontStat: 5,
      frontMaxStat: MAX_STAT_POSSIBLE,
      backStat: 5,
      backMaxStat: MAX_STAT_POSSIBLE,
      debugStat: 5,
      debugMaxStat: MAX_STAT_POSSIBLE,
      creativityStat: 5,
      creativityMaxStat: MAX_STAT_POSSIBLE,
      visualDesignStat: 5,
      visualDesignMaxStat: MAX_STAT_POSSIBLE,
      animationStat: 5,
      animationMaxStat: MAX_STAT_POSSIBLE,
    },
  });

  const [pointsRemaining, setPointsRemaining] = useState(0);

  useEffect(() => {
    return form.store.subscribe(() => {
      if (form.store.state.values.productionType === ProductionType.DEV) {
        let { frontStat, backStat, debugStat } = form.store.state.values;
        setPointsRemaining(
          pointToSpend - (+frontStat + +backStat + +debugStat),
        );
      } else {
      }
    });
  }, [form.store]);

  return (
    <div
      className="min-h-screen bg-cover bg-center flex flex-col justify-center items-center"
      style={{ backgroundImage: "url(/menu-bg.jpg)" }} // Image de fond fournie
    >
      <div className="bg-white/90 p-8 rounded-lg shadow-lg max-w-lg md:max-w-4xl w-full my-4">
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">
          Nouvelle Partie
        </h1>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <form.Field
                name="firstName"
                children={(field) => <TextInput field={field} label="Prenom" />}
              />
              <form.Field
                name="lastName"
                children={(field) => <TextInput field={field} label="Nom" />}
              />
              <form.Field
                name="sex"
                children={(field) => (
                  <SelectInput field={field} label="Sexe">
                    <option value="M">Masculin</option>
                    <option value="F">Féminin</option>
                    <option value="O">Autre</option>
                  </SelectInput>
                )}
              />

              {/* Rôle */}
              <form.Field
                name="productionType"
                children={(field) => (
                  <SelectInput field={field} label="Role">
                    <option value={ProductionType.DEV}>Développeur</option>
                    <option value={ProductionType.DESIGNER}>Designer</option>
                  </SelectInput>
                )}
              />
            </div>

            {/* Panneau de compétences */}
            <div className="form-control mt-6 space-y-2">
              <h2 className="text-xl font-semibold mb-4">
                Dépenser des points de compétence
              </h2>
              <p className="mb-2">Points restants : {pointsRemaining}</p>

              {form.getFieldValue("productionType") === ProductionType.DEV && (
                <>
                  <form.Field
                    name="frontStat"
                    children={(field) => (
                      <RangeInput field={field} label="FrontEnd" />
                    )}
                  />
                  <form.Field
                    name="backStat"
                    children={(field) => (
                      <RangeInput field={field} label="BackEnd" />
                    )}
                  />
                  <form.Field
                    name="debugStat"
                    children={(field) => (
                      <RangeInput field={field} label="Debug" />
                    )}
                  />
                </>
              )}
            </div>
          </div>
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
            children={([canSubmit, isSubmitting]) => (
              <>
                <button
                  type="submit"
                  disabled={!canSubmit || pointsRemaining < 0}
                  className="mt-6 btn btn-primary"
                >
                  {isSubmitting ? "..." : "Commencer la Partie"}
                </button>
                {pointsRemaining < 0 && (
                  <p className="text-error text-sm text-center">
                    Vous avez dépensé {-pointsRemaining} point
                    {pointsRemaining < -1 ? "s" : ""} de trop.
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
