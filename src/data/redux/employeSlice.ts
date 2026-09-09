import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import {
  ComponentType,
  MAX_MORALE,
  Person,
  ProductionPerson,
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
      employe.trainingType = action.payload.trainingType;
      employe.trainingProgress = action.payload.trainingType ? 0 : undefined;
      if (action.payload.trainingType) {
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
