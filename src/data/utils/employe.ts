import {
  ComponentType,
  DEFAULT_MORALE,
  Marketing,
  Person,
  PersonType,
  ProductionPerson,
  ProductionStatKey,
  MAX_STAT_POSSIBLE,
  QA,
  STAT_KEY_BY_TYPE,
  STAT_SCALE,
  Seniority,
  Specialty,
} from "@/data/interface";
import { SexType, faker } from "@faker-js/faker";
import { randomIntFromInterval } from "@/data/utils";
import {
  SEARCH_MAX_CANDIDATES,
  SEARCH_MIN_CANDIDATES,
  SearchRole,
  TEMPERAMENTS,
  Temperament,
  computeExpectedSalary,
} from "@/data/utils/recruitment";
import { rollTraits } from "@/data/utils/traits";
import { rollStatRangeOffsets } from "@/data/utils/candidateStats";

// Plafond défini avec l'échelle des stats (interface) ; réexporté pour les
// imports existants.
export { MAX_STAT_POSSIBLE };

/** Tirage uniforme d'une stat entre deux bornes exprimées sur l'échelle 0..20. */
const rollScaled = ([min, max]: [number, number]): number =>
  randomIntFromInterval(min * STAT_SCALE, max * STAT_SCALE);

// ── Profils par séniorité (bornes en dizaines de points, cf. STAT_SCALE) ────
//   focus      : stat de la spécialité d'un spécialiste de production ;
//   fullstack  : chacune des trois stats d'un polyvalent ;
//   off        : stats hors spécialité d'un spécialiste ;
//   dominant / secondary : les deux stats métier d'un QA ou d'un marketeur ;
//   growth     : marge entre le niveau de départ et le potentiel (stat max),
//                tirée une fois par candidat et commune à toutes ses stats.
// Un junior démarre sous le fondateur spécialisé (100) mais peut aller loin ;
// un senior est au niveau des anciens spécialistes, presque à son plafond.
interface SeniorityProfile {
  focus: [number, number];
  fullstack: [number, number];
  off: [number, number];
  dominant: [number, number];
  secondary: [number, number];
  growth: [number, number];
}

export const SENIORITY_PROFILE: Record<Seniority, SeniorityProfile> = {
  junior: {
    focus: [5, 9],
    fullstack: [4, 7],
    off: [1, 4],
    dominant: [5, 9],
    secondary: [3, 6],
    growth: [8, 15],
  },
  confirme: {
    focus: [9, 14],
    fullstack: [7, 11],
    off: [2, 6],
    dominant: [9, 14],
    secondary: [5, 10],
    growth: [5, 10],
  },
  senior: {
    focus: [14, 19],
    fullstack: [10, 14],
    off: [3, 8],
    dominant: [14, 19],
    secondary: [7, 13],
    growth: [1, 5],
  },
};

/** Potentiel d'une stat : son niveau de départ plus la marge du candidat. */
const potentialOf = (stat: number, growth: number): number =>
  Math.min(MAX_STAT_POSSIBLE, Math.max(stat, stat + growth));

const pickSpecialty = (): Specialty => {
  const r = Math.random();
  if (r < 0.3) return "FULLSTACK";
  const types = Object.values(ComponentType);
  return types[Math.floor(Math.random() * types.length)] as ComponentType;
};

// Un spécialiste est fort sur la stat de sa tâche, faible ailleurs ; un
// fullstack est moyen partout. Les bornes dépendent de la séniorité.
const rollStat = (
  profile: SeniorityProfile,
  specialty: Specialty,
  statKey: ProductionStatKey,
): number => {
  if (specialty === "FULLSTACK") return rollScaled(profile.fullstack);
  if (STAT_KEY_BY_TYPE[specialty as ComponentType] === statKey) {
    return rollScaled(profile.focus);
  }
  return rollScaled(profile.off);
};

// Attributs communs à tout candidat (identité, moral de départ). Le salaire
// est fixé ensuite par `enrichCandidate`, d'après le niveau tiré.
const baseCandidate = (seniority: Seniority): Person => {
  const sex = faker.person.sex();
  return {
    id: 0, // assigné par le slice via nextCandidateId
    sex,
    firstName: faker.person.firstName(sex as SexType),
    lastName: faker.person.lastName(sex as SexType),
    salary: 0,
    personType: PersonType.PROD,
    morale: DEFAULT_MORALE + randomIntFromInterval(-10, 10),
    seniority,
  };
};

const generateProductionCandidate = (
  seniority: Seniority,
  specialty: Specialty = pickSpecialty(),
): ProductionPerson => {
  const profile = SENIORITY_PROFILE[seniority];
  const growth = rollScaled(profile.growth);
  const codeStat = rollStat(profile, specialty, "codeStat");
  const visualStat = rollStat(profile, specialty, "visualStat");
  const uxStat = rollStat(profile, specialty, "uxStat");
  return {
    ...baseCandidate(seniority),
    personType: PersonType.PROD,
    specialty,
    codeStat,
    codeMaxStat: potentialOf(codeStat, growth),
    visualStat,
    visualMaxStat: potentialOf(visualStat, growth),
    uxStat,
    uxMaxStat: potentialOf(uxStat, growth),
  };
};

// Deux stats « métier » (QA / Marketing), l'une étant la spécialité dominante
// pour donner du relief aux candidats.
const rollRoleStat = (profile: SeniorityProfile, dominant: boolean): number =>
  rollScaled(dominant ? profile.dominant : profile.secondary);

const generateQaCandidate = (seniority: Seniority): QA => {
  const profile = SENIORITY_PROFILE[seniority];
  const growth = rollScaled(profile.growth);
  const detectionDominant = Math.random() < 0.6;
  const testStat = rollRoleStat(profile, !detectionDominant);
  const bugDetectionStat = rollRoleStat(profile, detectionDominant);
  return {
    ...baseCandidate(seniority),
    personType: PersonType.QA,
    testStat,
    testMaxStat: potentialOf(testStat, growth),
    bugDetectionStat,
    bugDetectionMaxStat: potentialOf(bugDetectionStat, growth),
  };
};

const generateMarketingCandidate = (seniority: Seniority): Marketing => {
  const profile = SENIORITY_PROFILE[seniority];
  const growth = rollScaled(profile.growth);
  const commDominant = Math.random() < 0.5;
  const communicationStat = rollRoleStat(profile, commDominant);
  const campaignManagementStat = rollRoleStat(profile, !commDominant);
  return {
    ...baseCandidate(seniority),
    personType: PersonType.MARKETING,
    communicationStat,
    communicationMaxStat: potentialOf(communicationStat, growth),
    campaignManagementStat,
    campaignManagementMaxStat: potentialOf(campaignManagementStat, growth),
  };
};

// Profil brut correspondant au poste et au niveau commandés par le joueur.
const generateCandidateForRole = (
  role: SearchRole,
  seniority: Seniority,
): Person => {
  if (role === PersonType.QA) return generateQaCandidate(seniority);
  if (role === PersonType.MARKETING) return generateMarketingCandidate(seniority);
  return generateProductionCandidate(seniority, role as Specialty);
};

const pickTemperament = (): Temperament =>
  TEMPERAMENTS[Math.floor(Math.random() * TEMPERAMENTS.length)];

// Recrutement enrichi (MYL-13) : on dérive `expectedSalary` du niveau du candidat
// (borné dans l'enveloppe du rôle → masse salariale de départ inchangée en
// espérance), on tire un tempérament et on masque les stats tant que l'entretien
// n'a pas eu lieu. `salary` affiché = `expectedSalary` (prix demandé de départ).
const enrichCandidate = (
  candidate: Person,
  reputation: number,
  salaryIndex: number,
): Person => {
  const noise = Math.random() * 2 - 1; // U(-1,1) → ±SALARY_NOISE dans le calcul
  const expectedSalary = computeExpectedSalary(
    candidate,
    reputation,
    noise,
    salaryIndex,
  );
  return {
    ...candidate,
    expectedSalary,
    salary: expectedSalary,
    temperament: pickTemperament(),
    traits: rollTraits(candidate.personType),
    revealedStats: false,
    statRangeOffsets: rollStatRangeOffsets(candidate),
  };
};

/**
 * Résultat d'une recherche commandée au pôle emploi : `count` candidats du poste
 * demandé, générés et enrichis (attendu salarial, tempérament, stats masquées).
 * Instantané côté jeu — la contrepartie est le coût de la prestation
 * (`computeSearchCost`), débité par le thunk appelant.
 */
export const generateCandidatesForRole = (
  role: SearchRole,
  count: number,
  reputation: number,
  /** Indice des salaires du marché à l'heure de la recherche (1 en 1970). */
  salaryIndex: number = 1,
  seniority: Seniority = "junior",
): Person[] => {
  const n = Math.max(
    SEARCH_MIN_CANDIDATES,
    Math.min(SEARCH_MAX_CANDIDATES, Math.floor(count)),
  );
  const generated: Person[] = [];
  for (let i = 0; i < n; i++) {
    generated.push(
      enrichCandidate(
        generateCandidateForRole(role, seniority),
        reputation,
        salaryIndex,
      ),
    );
  }
  return generated;
};
