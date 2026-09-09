import { describe, expect, it, vi } from "vitest";

import {
  Component,
  ComponentQuality,
  ComponentType,
  ContractType,
  StartedContract,
} from "@/data/interface";
import {
  DEADLINE_REPUTATION_MALUS,
  EARLY_DELIVERY_BONUS,
  EARLY_DELIVERY_RATIO,
  computeContractPayout,
  deliverContract,
  qualityMultiplier,
  treatTasks,
} from "@/data/utils/task";
import { removeComponents } from "@/data/redux/componentSlice";
import { removeTask, setTaskList } from "@/data/redux/taskSlice";
import {
  addReputation,
  applyContractMalus,
  setMoney,
} from "@/data/redux/companySlice";
import type { RootState } from "@/data/redux/store";

const makeContract = (over: Partial<StartedContract> = {}): StartedContract => ({
  id: 1,
  name: "Contrat test",
  time: 1000,
  startDate: 0,
  clientName: "ACME",
  clientImage: "",
  priceDeposit: 100,
  priceAdditional: 1000,
  priceMalus: 300,
  type: ContractType.DEV,
  taskDifficulty: 10,
  requirements: [{ type: ComponentType.CODE, quantity: 2 }],
  ...over,
});

const makeComponent = (over: Partial<Component> = {}): Component => ({
  id: 1,
  type: ComponentType.CODE,
  quality: ComponentQuality.BON,
  producedBy: 1,
  producedAt: 0,
  ...over,
});

const stateWith = (over: {
  taskList?: StartedContract[];
  stock?: Component[];
  money?: number;
  time?: number;
}): RootState =>
  ({
    task: { taskList: over.taskList ?? [] },
    component: { stock: over.stock ?? [] },
    company: { money: over.money ?? 5000 },
    engine: { time: over.time ?? 0 },
  }) as unknown as RootState;

// Le solde ne dépend plus d'un avancement produit par les employés, mais de la
// qualité du stock consommé au moment où le joueur décide de livrer.
describe("valorisation d'une livraison", () => {
  it("applique le multiplicateur de qualité au solde", () => {
    const contract = makeContract();
    // Livraison tardive pour isoler l'effet qualité de la prime d'anticipation.
    const late = contract.time;

    const bacle = computeContractPayout(contract, ComponentQuality.BACLE, late);
    const excellent = computeContractPayout(
      contract,
      ComponentQuality.EXCELLENT,
      late,
    );

    expect(bacle.early).toBe(false);
    expect(bacle.reward).toBe(1000 * qualityMultiplier(0));
    expect(excellent.reward).toBe(1000 * qualityMultiplier(5));
    expect(excellent.reward).toBeGreaterThan(bacle.reward);
  });

  it("prime la livraison anticipée et l'éteint passé le seuil", () => {
    const contract = makeContract();
    const justBefore = Math.floor(contract.time * EARLY_DELIVERY_RATIO) - 1;
    const justAfter = Math.ceil(contract.time * EARLY_DELIVERY_RATIO);

    const early = computeContractPayout(contract, 3, justBefore);
    const onTime = computeContractPayout(contract, 3, justAfter);

    expect(early.early).toBe(true);
    expect(onTime.early).toBe(false);
    expect(early.reward).toBe(Math.round(onTime.reward * EARLY_DELIVERY_BONUS));
  });
});

describe("deliverContract", () => {
  it("consomme le stock, verse le solde et retire le contrat", () => {
    const dispatch = vi.fn();
    const state = stateWith({
      taskList: [makeContract()],
      stock: [
        makeComponent({ id: 10, quality: ComponentQuality.CORRECT }),
        makeComponent({ id: 11, quality: ComponentQuality.EXCELLENT }),
        makeComponent({ id: 12, quality: ComponentQuality.BACLE }),
      ],
      money: 5000,
    });

    deliverContract(1)(dispatch as never, (() => state) as never);

    // selectBestComponents sert les meilleures qualités d'abord : 5 et 2.
    expect(dispatch).toHaveBeenCalledWith(removeComponents([11, 10]));
    const { reward } = computeContractPayout(state.task.taskList[0], 3.5, 0);
    expect(dispatch).toHaveBeenCalledWith(setMoney(5000 + reward));
    expect(dispatch).toHaveBeenCalledWith(removeTask(1));
  });

  it("refuse la livraison sans rien consommer si le stock est incomplet", () => {
    const dispatch = vi.fn();
    const state = stateWith({
      taskList: [makeContract()],
      stock: [makeComponent({ id: 10 })], // 1 composant pour 2 demandés
    });

    deliverContract(1)(dispatch as never, (() => state) as never);

    const kinds = dispatch.mock.calls.map((c) => c[0].type);
    expect(kinds).not.toContain(removeComponents([]).type);
    expect(kinds).not.toContain(removeTask(1).type);
    expect(kinds).toContain("notification/pushNotification");
  });

  it("ignore un contrat inconnu", () => {
    const dispatch = vi.fn();
    deliverContract(99)(
      dispatch as never,
      (() => stateWith({ taskList: [makeContract()] })) as never,
    );
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("treatTasks — deadlines uniquement", () => {
  it("ne touche pas au store tant qu'aucune deadline n'est dépassée", () => {
    const dispatch = vi.fn();
    treatTasks(
      dispatch as never,
      stateWith({ taskList: [makeContract()], time: 500 }),
    );
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("facture le malus et retire le contrat expiré", () => {
    const dispatch = vi.fn();
    const expired = makeContract({ id: 1, time: 100 });
    const running = makeContract({ id: 2, time: 5000 });

    treatTasks(
      dispatch as never,
      stateWith({ taskList: [expired, running], time: 200 }),
    );

    expect(dispatch).toHaveBeenCalledWith(applyContractMalus(300));
    expect(dispatch).toHaveBeenCalledWith(
      addReputation(DEADLINE_REPUTATION_MALUS),
    );
    expect(dispatch).toHaveBeenCalledWith(setTaskList({ taskList: [running] }));
  });
});
