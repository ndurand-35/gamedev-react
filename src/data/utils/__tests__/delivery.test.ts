import { adjustMorale } from "@/data/redux/employeSlice";
import { MORALE_MISSED_DEADLINE } from "@/data/utils/morale";
import { describe, expect, it, vi } from "vitest";

import {
  Component,
  ComponentQuality,
  ComponentType,
  ContractType,
  StartedContract,
} from "@/data/interface";
import {
  CONTRACT_REPUTATION_PER_MONTH,
  DEADLINE_REPUTATION_MALUS,
  EARLY_DELIVERY_BONUS,
  EARLY_DELIVERY_RATIO,
  computeContractPayout,
  contractReputationAllowance,
  deliverContract,
  gameMonthKey,
  qualityMultiplier,
  treatTasks,
} from "@/data/utils/task";
import { removeComponents } from "@/data/redux/componentSlice";
import { removeTask, setTaskList } from "@/data/redux/taskSlice";
import {
  addReputation,
  applyContractMalus,
  recordContractReputation,
  setMoney,
} from "@/data/redux/companySlice";
import type { RootState } from "@/data/redux/store";

const makeContract = (over: Partial<StartedContract> = {}): StartedContract => ({
  id: 1,
  name: "Contrat test",
  time: 1000,
  startDate: 0,
  clientId: "acme",
  clientName: "ACME",
  clientImage: "",
  loyaltyBonus: 0,
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
  employes?: { id: number }[];
  contractReputation?: { month: string; gained: number };
}): RootState =>
  ({
    task: { taskList: over.taskList ?? [] },
    employe: { employeList: over.employes ?? [] },
    component: { stock: over.stock ?? [] },
    company: {
      money: over.money ?? 5000,
      contractReputation: over.contractReputation,
    },
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

  it("la réputation des contrats est plafonnée par mois, pas leurs pertes", () => {
    const deliver = (
      stock: Component[],
      contractReputation?: { month: string; gained: number },
    ) => {
      const dispatch = vi.fn();
      const state = stateWith({
        taskList: [makeContract()],
        stock,
        contractReputation,
      });
      deliverContract(1)(dispatch as never, (() => state) as never);
      return dispatch;
    };
    const excellent = [
      makeComponent({ id: 10, quality: ComponentQuality.EXCELLENT }),
      makeComponent({ id: 11, quality: ComponentQuality.EXCELLENT }),
    ];
    // Qualité 5 : +4 « mérités », ramenés au plafond du mois.
    const first = deliver(excellent);
    expect(first).toHaveBeenCalledWith(
      addReputation(CONTRACT_REPUTATION_PER_MONTH),
    );
    expect(first).toHaveBeenCalledWith(
      recordContractReputation({
        month: gameMonthKey(0),
        gained: CONTRACT_REPUTATION_PER_MONTH,
      }),
    );
    // Le mois est déjà servi : plus rien.
    const second = deliver(excellent, {
      month: gameMonthKey(0),
      gained: CONTRACT_REPUTATION_PER_MONTH,
    });
    const kinds = second.mock.calls.map((c) => c[0].type);
    expect(kinds).not.toContain(addReputation(0).type);
    // Du bâclé coûte sa réputation, plafond atteint ou non.
    const bacle = deliver(
      [
        makeComponent({ id: 10, quality: ComponentQuality.BACLE }),
        makeComponent({ id: 11, quality: ComponentQuality.BACLE }),
      ],
      { month: gameMonthKey(0), gained: CONTRACT_REPUTATION_PER_MONTH },
    );
    expect(bacle).toHaveBeenCalledWith(addReputation(-1));
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

describe("contractReputationAllowance", () => {
  it("repart à zéro chaque mois de jeu", () => {
    const january = gameMonthKey(0);
    expect(contractReputationAllowance(undefined, 0)).toBe(
      CONTRACT_REPUTATION_PER_MONTH,
    );
    expect(
      contractReputationAllowance(
        { month: january, gained: CONTRACT_REPUTATION_PER_MONTH },
        0,
      ),
    ).toBe(0);
    // Février : la limite de janvier ne compte plus.
    expect(
      contractReputationAllowance(
        { month: january, gained: CONTRACT_REPUTATION_PER_MONTH },
        32 * 24,
      ),
    ).toBe(CONTRACT_REPUTATION_PER_MONTH);
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

  it("une deadline manquée entame le moral de l'équipe, fondateur exclu", () => {
    const dispatch = vi.fn();
    treatTasks(
      dispatch as never,
      stateWith({
        taskList: [makeContract({ id: 1, time: 100 })],
        time: 200,
        employes: [{ id: 1 }, { id: 2 }],
      }),
    );

    expect(dispatch).toHaveBeenCalledWith(
      adjustMorale({ employeId: 2, delta: -MORALE_MISSED_DEADLINE }),
    );
    expect(dispatch).not.toHaveBeenCalledWith(
      adjustMorale({ employeId: 1, delta: -MORALE_MISSED_DEADLINE }),
    );
  });
});
