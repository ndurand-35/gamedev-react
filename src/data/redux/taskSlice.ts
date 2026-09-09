import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { Client, Contract, StartedContract, Task } from "@/data/interface";
import { generateNewContract } from "@/data/utils/task";
import { clampRelation } from "@/data/utils/client";
import { DEFAULT_TASK_STATE } from "@/data/utils/constant";

export interface TaskState {
  taskList: StartedContract[];
  availableContractList: Contract[];
  lastContractGeneration: number;
  nextContractId: number;
  /**
   * Carnet d'adresses : tous les clients avec qui on a déjà signé, indexé par
   * `clientId`. Les contrats non signés n'y entrent pas — on ne connaît que les
   * gens avec qui on a travaillé.
   */
  clients: Record<string, Client>;
}

const initialState: TaskState = DEFAULT_TASK_STATE;

/**
 * Les parties antérieures aux clients à mémoire ont un état persisté sans
 * carnet. On le crée à la volée plutôt que de purger la sauvegarde du joueur.
 */
const ensureClients = (state: TaskState) => {
  if (!state.clients) state.clients = {};
  return state.clients;
};

export const taskSlice = createSlice({
  name: "task",
  initialState,
  reducers: {
    initializeTaskState(state) {
      state.taskList = DEFAULT_TASK_STATE.taskList;
      state.availableContractList = DEFAULT_TASK_STATE.availableContractList;
      state.lastContractGeneration = DEFAULT_TASK_STATE.lastContractGeneration;
      state.nextContractId = DEFAULT_TASK_STATE.nextContractId;
      state.clients = {};
    },
    generateAvailableContractList(
      state,
      action: PayloadAction<{ reputation: number; time: number }>,
    ) {
      if (action.payload.time - state.lastContractGeneration > 168) {
        state.lastContractGeneration = action.payload.time;
        const contracts = generateNewContract(
          action.payload.reputation,
          ensureClients(state),
        );
        state.availableContractList = contracts.map((c) => ({
          ...c,
          id: state.nextContractId++,
        }));
      }
    },
    acceptContract(state, action: PayloadAction<StartedContract>) {
      state.availableContractList = state.availableContractList.filter(
        (contract: Contract) => contract.id !== action.payload.id,
      );
      state.taskList.push(action.payload);

      // Le client entre au carnet à la signature, pas à la génération : la
      // liste hebdomadaire brasse des inconnus qu'on ne rencontrera jamais.
      const { clientId, clientName, clientImage, startDate } = action.payload;
      const clients = ensureClients(state);
      if (clientId && !clients[clientId]) {
        clients[clientId] = {
          id: clientId,
          name: clientName,
          image: clientImage,
          relation: 0,
          delivered: 0,
          early: 0,
          lost: false,
          lastSeen: startDate,
        };
      }
    },

    /**
     * Livraison enregistrée côté relation : `delta` vient de
     * `clientRelationDelta` (anticipé, dans les temps, ou bâclé).
     */
    recordClientDelivery(
      state,
      action: PayloadAction<{
        clientId: string;
        delta: number;
        early: boolean;
        time: number;
      }>,
    ) {
      const client = ensureClients(state)[action.payload.clientId];
      if (!client || client.lost) return;
      client.relation = clampRelation(client.relation + action.payload.delta);
      client.delivered += 1;
      if (action.payload.early) client.early += 1;
      client.lastSeen = action.payload.time;
    },

    /** Rupture définitive après une deadline manquée. */
    loseClient(
      state,
      action: PayloadAction<{ clientId: string; time: number }>,
    ) {
      const client = ensureClients(state)[action.payload.clientId];
      if (!client) return;
      client.lost = true;
      client.relation = 0;
      client.lastSeen = action.payload.time;
    },

    // Retire un contrat livré. L'échec sur deadline passe par `setTaskList`,
    // qui remplace la liste entière depuis le tick de jeu.
    removeTask(state, action: PayloadAction<number>) {
      state.taskList = state.taskList.filter(
        (t: Task) => t.id !== action.payload,
      );
    },

    setTaskList(state, action: PayloadAction<{ taskList: StartedContract[] }>) {
      state.taskList = [...action.payload.taskList];
    },
  },
});

// Action creators are generated for each case reducer function
export const {
  generateAvailableContractList,
  acceptContract,
  recordClientDelivery,
  loseClient,
  removeTask,
  setTaskList,
  initializeTaskState,
} = taskSlice.actions;

export default taskSlice.reducer;
