// ── Passage des stats de l'échelle 0..20 à 0..200 ───────────────────────────
// Les parties enregistrées avant le changement d'échelle portent des stats sur
// 0..20 : on les multiplie par STAT_SCALE, ainsi que tout ce qui se mesure en
// points de stat (progrès de production, décalages des fourchettes estimées).
// La formation passe de 100 h par point à 10 h par point : les heures déjà
// faites se convertissent en points gagnés, le reste en progrès.

import {
  ComponentType,
  STAT_KEY_BY_TYPE,
  STAT_SCALE,
} from "@/data/interface";

// Heures de formation par point sur la nouvelle échelle (= TRAINING_THRESHOLD
// de `utils/training`). Recopié ici pour que le store n'importe pas, via cette
// migration, le moteur de formation et ses slices.
const TRAINING_THRESHOLD = 100 / STAT_SCALE;

type AnyRecord = Record<string, unknown>;

// Toute stat de métier (codeStat, testStat…) et son plafond (codeMaxStat…).
const STAT_FIELD = /^[a-zA-Z]+Stat$/;

const scaleRecord = (
  record: AnyRecord | undefined,
): AnyRecord | undefined => {
  if (!record) return record;
  const out: AnyRecord = {};
  for (const [k, v] of Object.entries(record)) {
    out[k] = typeof v === "number" ? v * STAT_SCALE : v;
  }
  return out;
};

/** Une personne (employé ou candidat) passée à la nouvelle échelle. */
export const rescalePersonStats = (person: AnyRecord): AnyRecord => {
  const out: AnyRecord = { ...person };
  for (const [k, v] of Object.entries(person)) {
    if (STAT_FIELD.test(k) && typeof v === "number") out[k] = v * STAT_SCALE;
  }
  if (person.statRangeOffsets) {
    out.statRangeOffsets = scaleRecord(person.statRangeOffsets as AnyRecord);
  }

  const trainingType = person.trainingType as ComponentType | null | undefined;
  const hours = person.trainingProgress;
  if (trainingType && typeof hours === "number" && hours > 0) {
    const statKey = STAT_KEY_BY_TYPE[trainingType];
    const maxKey = statKey.replace("Stat", "MaxStat");
    const gained = Math.floor(hours / TRAINING_THRESHOLD);
    const stat = out[statKey] as number;
    const max = (out[maxKey] as number | undefined) ?? Infinity;
    out[statKey] = Math.min(max, stat + gained);
    out.trainingProgress = hours - gained * TRAINING_THRESHOLD;
  }
  return out;
};

/**
 * État complet (slices sérialisées) passé à la nouvelle échelle. Ne touche
 * qu'aux slices `employe` et `component` ; le reste est rendu tel quel.
 */
export const rescaleStateStats = <T extends AnyRecord>(state: T): T => {
  const employe = state.employe as
    | { employeList?: AnyRecord[]; candidateList?: AnyRecord[] }
    | undefined;
  const component = state.component as
    | { productionProgress?: AnyRecord }
    | undefined;
  return {
    ...state,
    ...(employe && {
      employe: {
        ...employe,
        employeList: (employe.employeList ?? []).map(rescalePersonStats),
        candidateList: (employe.candidateList ?? []).map(rescalePersonStats),
      },
    }),
    ...(component && {
      component: {
        ...component,
        productionProgress: scaleRecord(component.productionProgress) ?? {},
      },
    }),
  };
};
