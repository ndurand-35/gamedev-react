import {
  ComponentType,
  DEFAULT_MORALE,
  PersonType,
  ProductionPerson,
  ProductionType,
  Specialty,
} from "@/data/interface";
import { SexType, faker } from "@faker-js/faker";
import { randomIntFromInterval } from "@/data/utils";

export const MAX_STAT_POSSIBLE = 20;

const STATS_BY_TYPE: Record<
  ComponentType,
  Array<keyof Pick<
    ProductionPerson,
    | "frontStat"
    | "backStat"
    | "debugStat"
    | "creativityStat"
    | "visualDesignStat"
    | "animationStat"
  >>
> = {
  [ComponentType.CODE]: ["frontStat", "backStat", "debugStat"],
  [ComponentType.VISUEL]: ["visualDesignStat", "animationStat"],
  [ComponentType.UX]: ["creativityStat"],
};

const pickSpecialty = (): Specialty => {
  const r = Math.random();
  if (r < 0.3) return "FULLSTACK";
  const types = Object.values(ComponentType);
  return types[Math.floor(Math.random() * types.length)] as ComponentType;
};

const rollStat = (specialty: Specialty, statKey: string): number => {
  if (specialty === "FULLSTACK") {
    return randomIntFromInterval(7, 13);
  }
  const focusStats = STATS_BY_TYPE[specialty as ComponentType];
  if (focusStats.includes(statKey as any)) {
    return randomIntFromInterval(14, MAX_STAT_POSSIBLE);
  }
  return randomIntFromInterval(1, 8);
};

const salaryForSpecialty = (specialty: Specialty): number => {
  if (specialty === "FULLSTACK") return randomIntFromInterval(1400, 2200);
  return randomIntFromInterval(1600, 2600);
};

export const generateNewEmploye = (reputation: number): ProductionPerson[] => {
  let nbGenerated = 3;
  if (reputation > 25) nbGenerated = 5;
  if (reputation > 50) nbGenerated = 7;
  if (reputation > 75) nbGenerated = 9;
  if (reputation === 100) nbGenerated = 15;

  let generated: ProductionPerson[] = [];
  for (let i = 0; i < nbGenerated; i++) {
    let sex = faker.person.sex();
    let productionType =
      Math.random() < 0.5 ? ProductionType.DEV : ProductionType.DESIGNER;
    const specialty = pickSpecialty();
    generated.push({
      id: 0, // assigné par le slice via nextCandidateId
      sex,
      firstName: faker.person.firstName(sex as SexType),
      lastName: faker.person.lastName(sex as SexType),
      salary: salaryForSpecialty(specialty),
      personType: PersonType.PROD,
      morale: DEFAULT_MORALE + randomIntFromInterval(-10, 10),
      productionType,
      specialty,
      frontStat: rollStat(specialty, "frontStat"),
      frontMaxStat: MAX_STAT_POSSIBLE,
      backStat: rollStat(specialty, "backStat"),
      backMaxStat: MAX_STAT_POSSIBLE,
      debugStat: rollStat(specialty, "debugStat"),
      debugMaxStat: MAX_STAT_POSSIBLE,
      creativityStat: rollStat(specialty, "creativityStat"),
      creativityMaxStat: MAX_STAT_POSSIBLE,
      visualDesignStat: rollStat(specialty, "visualDesignStat"),
      visualDesignMaxStat: MAX_STAT_POSSIBLE,
      animationStat: rollStat(specialty, "animationStat"),
      animationMaxStat: MAX_STAT_POSSIBLE,
    });
  }
  return generated;
};
