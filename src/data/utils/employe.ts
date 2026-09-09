import {
  ComponentType,
  DEFAULT_MORALE,
  Marketing,
  Person,
  PersonType,
  ProductionPerson,
  ProductionStatKey,
  QA,
  STAT_KEY_BY_TYPE,
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

export const MAX_STAT_POSSIBLE = 20;

const pickSpecialty = (): Specialty => {
  const r = Math.random();
  if (r < 0.3) return "FULLSTACK";
  const types = Object.values(ComponentType);
  return types[Math.floor(Math.random() * types.length)] as ComponentType;
};

// Un spécialiste est fort (14..20) sur la stat de sa tâche, faible ailleurs ;
// un fullstack est moyen partout (7..13).
const rollStat = (specialty: Specialty, statKey: ProductionStatKey): number => {
  if (specialty === "FULLSTACK") {
    return randomIntFromInterval(7, 13);
  }
  if (STAT_KEY_BY_TYPE[specialty as ComponentType] === statKey) {
    return randomIntFromInterval(14, MAX_STAT_POSSIBLE);
  }
  return randomIntFromInterval(1, 8);
};

const salaryForSpecialty = (specialty: Specialty): number => {
  if (specialty === "FULLSTACK") return randomIntFromInterval(1400, 2200);
  return randomIntFromInterval(1600, 2600);
};

// Attributs communs à tout candidat (identité, salaire, moral de départ).
const baseCandidate = (salary: number): Person => {
  const sex = faker.person.sex();
  return {
    id: 0, // assigné par le slice via nextCandidateId
    sex,
    firstName: faker.person.firstName(sex as SexType),
    lastName: faker.person.lastName(sex as SexType),
    salary,
    personType: PersonType.PROD,
    morale: DEFAULT_MORALE + randomIntFromInterval(-10, 10),
  };
};

const generateProductionCandidate = (
  specialty: Specialty = pickSpecialty(),
): ProductionPerson => {
  return {
    ...baseCandidate(salaryForSpecialty(specialty)),
    personType: PersonType.PROD,
    specialty,
    codeStat: rollStat(specialty, "codeStat"),
    codeMaxStat: MAX_STAT_POSSIBLE,
    visualStat: rollStat(specialty, "visualStat"),
    visualMaxStat: MAX_STAT_POSSIBLE,
    uxStat: rollStat(specialty, "uxStat"),
    uxMaxStat: MAX_STAT_POSSIBLE,
  };
};

// Un stat « métier » (QA / Marketing) : 8..20, l'un des deux étant la spécialité
// dominante (14..20) pour donner du relief aux candidats.
const rollRoleStat = (dominant: boolean): number =>
  dominant
    ? randomIntFromInterval(14, MAX_STAT_POSSIBLE)
    : randomIntFromInterval(6, 13);

const generateQaCandidate = (): QA => {
  const detectionDominant = Math.random() < 0.6;
  return {
    ...baseCandidate(randomIntFromInterval(1500, 2400)),
    personType: PersonType.QA,
    testStat: rollRoleStat(!detectionDominant),
    testMaxStat: MAX_STAT_POSSIBLE,
    bugDetectionStat: rollRoleStat(detectionDominant),
    bugDetectionMaxStat: MAX_STAT_POSSIBLE,
  };
};

const generateMarketingCandidate = (): Marketing => {
  const commDominant = Math.random() < 0.5;
  return {
    ...baseCandidate(randomIntFromInterval(1500, 2400)),
    personType: PersonType.MARKETING,
    communicationStat: rollRoleStat(commDominant),
    communicationMaxStat: MAX_STAT_POSSIBLE,
    campaignManagementStat: rollRoleStat(!commDominant),
    campaignManagementMaxStat: MAX_STAT_POSSIBLE,
  };
};

// Profil brut correspondant au poste commandé par le joueur : la spécialité
// n'est plus tirée au sort côté production, c'est la commande qui la fixe.
// `pickSpecialty` ne sert donc plus que de repli (poste "Polyvalent" exclu).
const generateCandidateForRole = (role: SearchRole): Person => {
  if (role === PersonType.QA) return generateQaCandidate();
  if (role === PersonType.MARKETING) return generateMarketingCandidate();
  return generateProductionCandidate(role as Specialty);
};

const pickTemperament = (): Temperament =>
  TEMPERAMENTS[Math.floor(Math.random() * TEMPERAMENTS.length)];

// Recrutement enrichi (MYL-13) : on dérive `expectedSalary` du niveau du candidat
// (borné dans l'enveloppe du rôle → masse salariale de départ inchangée en
// espérance), on tire un tempérament et on masque les stats tant que l'entretien
// n'a pas eu lieu. `salary` affiché = `expectedSalary` (prix demandé de départ).
const enrichCandidate = (candidate: Person, reputation: number): Person => {
  const noise = Math.random() * 2 - 1; // U(-1,1) → ±SALARY_NOISE dans le calcul
  const expectedSalary = computeExpectedSalary(candidate, reputation, noise);
  return {
    ...candidate,
    expectedSalary,
    salary: expectedSalary,
    temperament: pickTemperament(),
    revealedStats: false,
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
): Person[] => {
  const n = Math.max(
    SEARCH_MIN_CANDIDATES,
    Math.min(SEARCH_MAX_CANDIDATES, Math.floor(count)),
  );
  const generated: Person[] = [];
  for (let i = 0; i < n; i++) {
    generated.push(enrichCandidate(generateCandidateForRole(role), reputation));
  }
  return generated;
};
