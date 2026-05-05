import {
  ComponentQuality,
  ComponentRequirement,
  ComponentType,
  Contract,
  ContractType,
  Person,
  ProductionPerson,
  StartedContract,
  buildingSynergyMultiplier,
  moraleProductivityMultiplier,
} from "@/data/interface";
import { faker } from "@faker-js/faker/locale/en";
import { capitalize, randomIntFromInterval, weekToHour } from "@/data/utils";
import { totalRequirementQuantity } from "@/data/utils/component";
import { AppDispatch, RootState } from "@/data/redux/store";
import { pushNotification } from "@/data/redux/notificationSlice";

import { setTaskList } from "@/data/redux/taskSlice";
import {
  addReputation,
  addReputationByType,
  applyContractMalus,
  setMoney,
} from "@/data/redux/companySlice";
import { MAX_CONTRACT_DIFFICULTY } from "./constant";

export const ASSEMBLY_POINTS_PER_COMPONENT = 50;

const minQualityForDifficulty = (
  difficulty: number,
): ComponentQuality | undefined => {
  if (difficulty < 30) return undefined;
  if (difficulty < 55) return ComponentQuality.MEDIOCRE;
  if (difficulty < 75) return ComponentQuality.CORRECT;
  if (difficulty < 90) return ComponentQuality.BON;
  return ComponentQuality.TRES_BON;
};

const requirementsForType = (
  contractType: ContractType,
  difficulty: number,
): ComponentRequirement[] => {
  const qty = (multiplier: number) =>
    Math.max(1, Math.round((difficulty / 10) * multiplier) + randomIntFromInterval(0, 2));
  const minQuality = minQualityForDifficulty(difficulty);

  switch (contractType) {
    case ContractType.DEV:
      return [{ type: ComponentType.CODE, quantity: qty(1), minQuality }];
    case ContractType.DESIGN:
      return [
        { type: ComponentType.VISUEL, quantity: qty(0.7), minQuality },
        { type: ComponentType.UX, quantity: qty(0.5), minQuality },
      ];
    case ContractType.FULL_STACK:
      return [
        { type: ComponentType.CODE, quantity: qty(0.7), minQuality },
        { type: ComponentType.VISUEL, quantity: qty(0.5), minQuality },
        { type: ComponentType.UX, quantity: qty(0.4), minQuality },
      ];
  }
};

export const generateNewContract = (reputation: number): Contract[] => {
  let nbGenerated = 8;
  let contractDifficulty = 2;
  if (reputation === 100) {
    nbGenerated = 15;
    contractDifficulty = MAX_CONTRACT_DIFFICULTY;
  } else if (reputation > 75) {
    nbGenerated = 12;
  } else if (reputation > 50) nbGenerated = 9;
  else if (reputation > 25) nbGenerated = 7;
  if (reputation > 1)
    contractDifficulty = MAX_CONTRACT_DIFFICULTY * (reputation / 100);

  let generated: Contract[] = [];
  for (let i = 0; i < nbGenerated; i++) {
    let taskDifficulty = randomIntFromInterval(1, contractDifficulty);
    let taskType = randomContractType();
    let time = randomIntFromInterval(1, 8);

    let requirements = requirementsForType(taskType, taskDifficulty);
    let totalQty = totalRequirementQuantity(requirements);
    let complexity = totalQty * taskDifficulty;

    let priceDeposit = randomIntFromInterval(complexity * 5, complexity * 8);
    let priceAdditional = randomIntFromInterval(
      complexity * 20,
      complexity * 25,
    );
    let priceMalus = randomIntFromInterval(priceDeposit * 2, priceDeposit * 3);

    generated.push({
      id: 0,
      name:
        capitalize(faker.hacker.ingverb()) +
        " " +
        faker.hacker.adjective() +
        " " +
        faker.hacker.noun(),
      time: weekToHour(time),
      priceDeposit,
      priceAdditional,
      priceMalus,
      clientName: faker.company.name(),
      clientImage: faker.image.urlLoremFlickr({ category: "logo" }),
      type: taskType,
      taskDifficulty,
      requirements,
    });
  }
  return generated;
};

const isProductionPerson = (p: Person): p is ProductionPerson =>
  typeof (p as ProductionPerson).frontStat === "number";

const integrationStat = (employe: ProductionPerson): number =>
  (employe.frontStat +
    employe.backStat +
    employe.debugStat +
    employe.creativityStat +
    employe.visualDesignStat +
    employe.animationStat) /
  6;

export const calculateTaskProgression = (
  task: StartedContract,
  employeList: Person[],
): number => {
  if (employeList.length === 0) return 0;
  if (task.assemblyPoints <= 0) return 0;

  const occupantsByBuilding: Record<number, number> = {};
  for (const e of employeList) {
    if (e.buildingId != null) {
      occupantsByBuilding[e.buildingId] =
        (occupantsByBuilding[e.buildingId] ?? 0) + 1;
    }
  }

  let pointsProduced = 0;
  for (const e of employeList) {
    if (!isProductionPerson(e)) continue;
    if (e.assignedComponentType) continue;
    if ((e as ProductionPerson).trainingType) continue;
    const synergy =
      e.buildingId != null
        ? buildingSynergyMultiplier(occupantsByBuilding[e.buildingId] ?? 1)
        : 1;
    pointsProduced +=
      integrationStat(e) *
      moraleProductivityMultiplier(e.morale) *
      synergy;
  }

  const priorityMult = 1 + (task.priority - 1) * 0.25;
  return ((pointsProduced * priorityMult) / task.assemblyPoints) * 100;
};

const qualityMultiplier = (avgQuality: number): number => {
  return 0.5 + avgQuality * 0.2;
};

const reputationGainForQuality = (avgQuality: number): number => {
  return Math.round(avgQuality) - 1;
};

export const treatTasks = (dispatch: AppDispatch, state: RootState) => {
  const remaining: StartedContract[] = [];
  const time = state.engine.time;

  for (const task of state.task.taskList) {
    if (task.paused) {
      if (time > task.startDate + task.time) {
        dispatch(applyContractMalus(task.priceMalus));
        dispatch(addReputation(-2));
        continue;
      }
      remaining.push(task);
      continue;
    }

    const workingEmployes = state.employe.employeList.filter(
      (e: Person) =>
        e.buildingId != null && task.buildingIds?.includes(e.buildingId),
    );
    const tickProgression = calculateTaskProgression(task, workingEmployes);
    const updated: StartedContract = {
      ...task,
      progression: task.progression + tickProgression,
    };

    if (updated.progression >= 100) {
      const elapsed = time - updated.startDate;
      const earlyBonus = elapsed < updated.time * 0.7 ? 1.2 : 1;
      const reward = Math.round(
        updated.priceAdditional *
          qualityMultiplier(updated.averageQuality) *
          earlyBonus,
      );
      dispatch(setMoney(state.company.money + reward));
      const repGain = reputationGainForQuality(updated.averageQuality);
      dispatch(addReputation(repGain));
      if (repGain > 0 && updated.consumedComponents.length > 0) {
        const counts: Record<ComponentType, number> = {
          [ComponentType.CODE]: 0,
          [ComponentType.VISUEL]: 0,
          [ComponentType.UX]: 0,
        };
        for (const c of updated.consumedComponents) counts[c.type]++;
        const total = updated.consumedComponents.length;
        for (const t of Object.values(ComponentType)) {
          if (counts[t] === 0) continue;
          const share = Math.max(1, Math.round((repGain * counts[t]) / total));
          dispatch(addReputationByType({ type: t, delta: share }));
        }
      }
      dispatch(
        pushNotification({
          message:
            earlyBonus > 1
              ? `Contrat « ${updated.name} » livré en avance (+20% bonus) !`
              : `Contrat « ${updated.name} » livré.`,
          type: "success",
        }),
      );
      continue;
    }
    if (time > updated.startDate + updated.time) {
      dispatch(applyContractMalus(updated.priceMalus));
      dispatch(addReputation(-2));
      dispatch(
        pushNotification({
          message: `Contrat « ${updated.name} » échoué : deadline dépassée.`,
          type: "error",
        }),
      );
      continue;
    }
    remaining.push(updated);
  }

  dispatch(setTaskList({ taskList: remaining }));
};

function randomContractType(): ContractType {
  const contractTypes = Object.values(ContractType);
  const randomIndex = Math.floor(Math.random() * contractTypes.length);
  return contractTypes[randomIndex] as ContractType;
}
