import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import {
  ComponentType,
  MAX_MORALE,
  MAX_STAT_KEY_BY_TYPE,
  Person,
  ProductionPerson,
  STAT_KEY_BY_TYPE,
} from "@/data/interface";
import { DEFAULT_EMPLOYE_STATE } from "@/data/utils/constant";

export interface EmployeState {
  employeList: Person[];
  candidateList: Person[];
  nextEmployeId: number;
  nextCandidateId: number;
}

const initialState: EmployeState = {
  employeList: [],
  candidateList: [],
  nextEmployeId: 2,
  nextCandidateId: 1,
};

export const employeSlice = createSlice({
  name: "employe",
  initialState,
  reducers: {
    initializeEmployeState(state, action: PayloadAction<Person>) {
      state.employeList = [
        ...DEFAULT_EMPLOYE_STATE.employeList,
        { ...action.payload, id: 1, buildingId: 1 },
      ];
      state.candidateList = DEFAULT_EMPLOYE_STATE.candidateList;
      state.nextEmployeId = 2;
      state.nextCandidateId = 1;
    },
    fired(state, action: PayloadAction<number>) {
      if (action.payload === 1) return;
      state.employeList = state.employeList.filter(
        (e: Person) => e.id !== action.payload,
      );
    },
    hire(state, action: PayloadAction<number>) {
      const candidate = state.candidateList.find(
        (c: Person) => c.id === action.payload,
      );
      if (!candidate) return;
      const newId = state.nextEmployeId++;
      const signed = candidate.salary;
      state.employeList.push({
        ...candidate,
        id: newId,
        buildingId: undefined,
        signedSalary: signed,
        revealedStats: true,
        pendingRaise: false,
      });
      state.candidateList = state.candidateList.filter(
        (c: Person) => c.id !== action.payload,
      );
    },
    // Recrutement enrichi (MYL-13) : embauche après négociation. `salary` est
    // l'offre signée (figée comme `signedSalary` pour le plafond cumulé des
    // augmentations), `moraleDelta` l'effet d'arrivée (salaire vs attendu).
    hireWithOffer(
      state,
      action: PayloadAction<{
        candidateId: number;
        salary: number;
        moraleDelta: number;
      }>,
    ) {
      const { candidateId, salary, moraleDelta } = action.payload;
      const candidate = state.candidateList.find(
        (c: Person) => c.id === candidateId,
      );
      if (!candidate) return;
      const newId = state.nextEmployeId++;
      state.employeList.push({
        ...candidate,
        id: newId,
        buildingId: undefined,
        salary,
        signedSalary: salary,
        revealedStats: true,
        pendingRaise: false,
        morale: Math.max(
          0,
          Math.min(MAX_MORALE, candidate.morale + moraleDelta),
        ),
      });
      state.candidateList = state.candidateList.filter(
        (c: Person) => c.id !== candidateId,
      );
    },
    // Volet A : révèle les stats / salaire attendu d'un candidat (entretien fait
    // ou frais RH express). Idempotent.
    revealCandidate(state, action: PayloadAction<number>) {
      const candidate = state.candidateList.find(
        (c: Person) => c.id === action.payload,
      );
      if (candidate) candidate.revealedStats = true;
    },
    // Volet B : un candidat refusé garde rancune et réapparaît avec un attendu
    // majoré (`GRUDGE_EXPECTED_MULT`). On le retire simplement du pool courant.
    rejectCandidate(state, action: PayloadAction<number>) {
      state.candidateList = state.candidateList.filter(
        (c: Person) => c.id !== action.payload,
      );
    },
    // Volet C : applique une augmentation (nouveau salaire mensuel).
    setSalary(
      state,
      action: PayloadAction<{ employeId: number; salary: number }>,
    ) {
      const employe = state.employeList.find(
        (e: Person) => e.id === action.payload.employeId,
      );
      if (!employe) return;
      employe.salary = Math.max(0, Math.round(action.payload.salary));
    },
    // Volet C : (ré)arme le cooldown anti-spam et lève le flag de demande.
    setRaiseCooldown(
      state,
      action: PayloadAction<{ employeId: number; until: number }>,
    ) {
      const employe = state.employeList.find(
        (e: Person) => e.id === action.payload.employeId,
      );
      if (!employe) return;
      employe.raiseCooldownUntil = action.payload.until;
      employe.pendingRaise = false;
    },
    // Les salaires du marché montent avec les technologies (cf.
    // `utils/technology`) : chaque 1er janvier, ce que chacun estime valoir
    // suit. Le salaire versé, lui, ne bouge pas — l'écart pèse sur le moral
    // (sous-paiement, cf. `utils/morale`). Le fondateur n'attend rien.
    raiseExpectedSalaries(state, action: PayloadAction<number>) {
      const ratio = action.payload;
      if (!(ratio > 0)) return;
      for (const e of state.employeList) {
        if (e.id === 1) continue;
        const base = e.expectedSalary ?? e.salary;
        e.expectedSalary = Math.round((base * ratio) / 10) * 10;
      }
    },
    // Prime versée : arme le délai avant la prochaine (cf. `utils/morale`).
    setBonusCooldown(
      state,
      action: PayloadAction<{ employeId: number; until: number }>,
    ) {
      const employe = state.employeList.find(
        (e: Person) => e.id === action.payload.employeId,
      );
      if (employe) employe.bonusCooldownUntil = action.payload.until;
    },
    setPendingRaise(
      state,
      action: PayloadAction<{ employeId: number; pending: boolean }>,
    ) {
      const employe = state.employeList.find(
        (e: Person) => e.id === action.payload.employeId,
      );
      if (!employe) return;
      employe.pendingRaise = action.payload.pending;
    },
    assignBuilding(
      state,
      action: PayloadAction<{
        employeId: number;
        buildingId: number | undefined;
        buildingPlace?: number;
      }>,
    ) {
      const { employeId, buildingId, buildingPlace } = action.payload;
      const employe = state.employeList.find((e: Person) => e.id === employeId);
      if (!employe) return;

      if (buildingId !== undefined && buildingPlace !== undefined) {
        const occupants = state.employeList.filter(
          (e: Person) => e.buildingId === buildingId && e.id !== employe.id,
        ).length;
        if (occupants >= buildingPlace) return;
      }

      employe.buildingId = buildingId;
    },
    assignComponentType(
      state,
      action: PayloadAction<{
        employeId: number;
        componentType: ComponentType | null;
      }>,
    ) {
      const employe = state.employeList.find(
        (e: Person) => e.id === action.payload.employeId,
      ) as ProductionPerson | undefined;
      if (!employe) return;
      employe.assignedComponentType = action.payload.componentType;
    },
    adjustMorale(
      state,
      action: PayloadAction<{ employeId: number; delta: number }>,
    ) {
      const employe = state.employeList.find(
        (e: Person) => e.id === action.payload.employeId,
      );
      if (!employe) return;
      employe.morale = Math.max(
        0,
        Math.min(MAX_MORALE, employe.morale + action.payload.delta),
      );
    },
    resignEmploye(state, action: PayloadAction<number>) {
      if (action.payload === 1) return; // le fondateur ne démissionne pas
      state.employeList = state.employeList.filter(
        (e: Person) => e.id !== action.payload,
      );
    },
    setTraining(
      state,
      action: PayloadAction<{
        employeId: number;
        trainingType: ComponentType | null;
      }>,
    ) {
      const employe = state.employeList.find(
        (e: Person) => e.id === action.payload.employeId,
      ) as ProductionPerson | undefined;
      if (!employe) return;
      const type = action.payload.trainingType;
      // Rien à apprendre au plafond : la demande est ignorée (l'UI grise le
      // bouton, la garde reste pour les autres chemins).
      if (
        type &&
        employe[STAT_KEY_BY_TYPE[type]] >= employe[MAX_STAT_KEY_BY_TYPE[type]]
      ) {
        return;
      }
      employe.trainingType = type;
      employe.trainingProgress = type ? 0 : undefined;
      if (type) {
        employe.assignedComponentType = null;
      }
    },
    applyTrainingTick(
      state,
      action: PayloadAction<
        Array<{
          employeId: number;
          progressDelta: number;
          completed?: { statKey: keyof ProductionPerson; newValue: number };
          finished?: boolean;
        }>
      >,
    ) {
      for (const update of action.payload) {
        const employe = state.employeList.find(
          (e: Person) => e.id === update.employeId,
        ) as ProductionPerson | undefined;
        if (!employe) continue;
        const current = employe.trainingProgress ?? 0;
        if (update.completed) {
          (employe[update.completed.statKey] as number) =
            update.completed.newValue;
          employe.trainingProgress = 0;
        } else {
          employe.trainingProgress = current + update.progressDelta;
        }
        // Plafond atteint : fin de formation, et retour en production sur le
        // type tout juste maîtrisé — l'affectation d'avant n'est pas conservée
        // (`setTraining` l'efface), c'est le choix le plus utile.
        if (update.finished) {
          const trained = employe.trainingType ?? null;
          employe.trainingType = null;
          employe.trainingProgress = undefined;
          if (trained) employe.assignedComponentType = trained;
        }
      }
    },
    // Pôle emploi (recherche à la demande) : ajoute au vivier les profils
    // ramenés par une recherche commandée et payée par le joueur. Les candidats
    // n'expirent plus tout seuls — ils restent jusqu'à embauche ou refus.
    addCandidates(state, action: PayloadAction<Person[]>) {
      for (const candidate of action.payload) {
        state.candidateList.push({ ...candidate, id: state.nextCandidateId++ });
      }
    },
    // Un profil ramené ne patiente pas indéfiniment : passé son `expiresAt`
    // (posé à la recherche), il quitte le vivier. Un candidat SANS échéance
    // vient forcément d'un vivier auto-généré d'avant la recherche à la demande
    // (partie en cours) : on le purge aussi, pour que la règle tienne partout —
    // sans recherche, pas de candidat.
    expireCandidates(state, action: PayloadAction<number>) {
      state.candidateList = state.candidateList.filter(
        (c: Person) => c.expiresAt != null && c.expiresAt > action.payload,
      );
    },
  },
});

export const {
  fired,
  hire,
  hireWithOffer,
  revealCandidate,
  rejectCandidate,
  setSalary,
  setRaiseCooldown,
  setBonusCooldown,
  raiseExpectedSalaries,
  setPendingRaise,
  assignBuilding,
  assignComponentType,
  adjustMorale,
  resignEmploye,
  setTraining,
  applyTrainingTick,
  addCandidates,
  expireCandidates,
  initializeEmployeState,
} = employeSlice.actions;

export default employeSlice.reducer;
