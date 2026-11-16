import { adjustMorale } from "@/data/redux/employeSlice";
import { MORALE_MISSED_DEADLINE } from "@/data/utils/morale";
import { describe, expect, it, vi } from "vitest";

import {
  Component,
  ComponentKindId,
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
  contractReputationGain,
  deliverContract,
  gameMonthKey,
  treatTasks,
} from "@/data/utils/task";
import { selectComponents } from "@/data/utils/component";
import { kindFamily } from "@/data/utils/recipes";
import { removeComponents } from "@/data/redux/componentSlice";
import { removeTask, setTaskList } from "@/data/redux/taskSlice";
import {
  addReputation,
  addReputationByType,
  applyContractMalus,
  recordContractReputation,
  setMoney,
} from "@/data/redux/companySlice";
import type { RootState } from "@/data/redux/store";

const makeContract = (
  over: Partial<StartedContract> = {},
): StartedContract => ({
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
  requirements: [{ kind: "code", quantity: 2 }],
  ...over,
});

const makeComponent = (
  over: Partial<Component> & { kind?: ComponentKindId } = {},
): Component => {
  const kind = over.kind ?? "code";
  return {
    id: 1,
    kind,
    type: kindFamily(kind),
    producedBy: 1,
    producedAt: 0,
    ...over,
  };
};

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

describe("selectComponents", () => {
  it("prend les pièces les plus anciennes d'abord", () => {
    const stock = [
      makeComponent({ id: 1, producedAt: 30 }),
      makeComponent({ id: 2, producedAt: 10 }),
      makeComponent({ id: 3, producedAt: 20 }),
    ];
    const sel = selectComponents(stock, [{ kind: "code", quantity: 2 }]);
    expect(sel.consumed.map((c) => c.id)).toEqual([2, 3]);
    expect(sel.remainingStock.map((c) => c.id)).toEqual([1]);
    expect(sel.missing).toEqual([]);
  });

  it("ne prend que la sorte exacte demandée, pas une autre de la même famille", () => {
    const stock = [
      makeComponent({ id: 1, kind: "module" }),
      makeComponent({ id: 2, kind: "code" }),
    ];
    const sel = selectComponents(stock, [{ kind: "module", quantity: 1 }]);
    expect(sel.consumed).toEqual([{ id: 1, kind: "module" }]);
    expect(sel.remainingStock.map((c) => c.id)).toEqual([2]);
  });

  it("signale ce qui manque sans rien prendre pour l'exigence incomplète", () => {
    const stock = [
      makeComponent({ id: 1, kind: "code" }),
      makeComponent({ id: 2, kind: "ux" }),
    ];
    const sel = selectComponents(stock, [
      { kind: "code", quantity: 3 },
      { kind: "ux", quantity: 1 },
    ]);
    expect(sel.missing).toEqual([{ kind: "code", quantity: 2 }]);
    // L'exigence UX, elle, est couverte.
    expect(sel.consumed).toEqual([{ id: 2, kind: "ux" }]);
    expect(sel.remainingStock.map((c) => c.id)).toEqual([1]);
  });
});

describe("valorisation d'une livraison", () => {
  it("verse le solde convenu, sans autre modulation, en livraison normale", () => {
    const contract = makeContract();
    const payout = computeContractPayout(contract, contract.time);
    expect(payout.early).toBe(false);
    expect(payout.reward).toBe(1000);
  });

  it("prime la livraison anticipée et l'éteint passé le seuil", () => {
    const contract = makeContract();
    const justBefore = Math.floor(contract.time * EARLY_DELIVERY_RATIO) - 1;
    const justAfter = Math.ceil(contract.time * EARLY_DELIVERY_RATIO);

    const early = computeContractPayout(contract, justBefore);
    const onTime = computeContractPayout(contract, justAfter);

    expect(early.early).toBe(true);
    expect(onTime.early).toBe(false);
    expect(early.reward).toBe(Math.round(1000 * EARLY_DELIVERY_BONUS));
    expect(onTime.reward).toBe(1000);
  });

  it("l'avance se mesure depuis la signature, pas depuis le début de partie", () => {
    const contract = makeContract({ startDate: 5000 });
    expect(computeContractPayout(contract, 5100).early).toBe(true);
    expect(computeContractPayout(contract, 5000 + 800).early).toBe(false);
  });

  it("rapporte un point de réputation, deux si le contrat demande du niveau 3", () => {
    expect(contractReputationGain(makeContract())).toBe(1);
    expect(
      contractReputationGain(
        makeContract({ requirements: [{ kind: "module", quantity: 1 }] }),
      ),
    ).toBe(1);
    expect(
      contractReputationGain(
        makeContract({
          requirements: [
            { kind: "code", quantity: 4 },
            { kind: "moteur", quantity: 1 },
          ],
        }),
      ),
    ).toBe(2);
    expect(
      computeContractPayout(
        makeContract({ requirements: [{ kind: "cloud", quantity: 1 }] }),
        0,
      ).reputationGain,
    ).toBe(2);
  });
});

describe("deliverContract", () => {
  it("consomme les pièces les plus anciennes, verse le solde et retire le contrat", () => {
    const dispatch = vi.fn();
    const state = stateWith({
      taskList: [makeContract()],
      stock: [
        makeComponent({ id: 10, producedAt: 50 }),
        makeComponent({ id: 11, producedAt: 5 }),
        makeComponent({ id: 12, producedAt: 20 }),
        makeComponent({ id: 13, kind: "ux", producedAt: 0 }),
      ],
      money: 5000,
      time: 900,
    });

    deliverContract(1)(dispatch as never, (() => state) as never);

    expect(dispatch).toHaveBeenCalledWith(removeComponents([11, 12]));
    // Livré à 900 h sur 1000 : pas de prime d'anticipation.
    expect(dispatch).toHaveBeenCalledWith(setMoney(5000 + 1000));
    expect(dispatch).toHaveBeenCalledWith(removeTask(1));
  });

  it("verse la prime quand la livraison est anticipée", () => {
    const dispatch = vi.fn();
    const state = stateWith({
      taskList: [makeContract()],
      stock: [makeComponent({ id: 10 }), makeComponent({ id: 11 })],
      money: 5000,
      time: 10,
    });

    deliverContract(1)(dispatch as never, (() => state) as never);

    expect(dispatch).toHaveBeenCalledWith(
      setMoney(5000 + Math.round(1000 * EARLY_DELIVERY_BONUS)),
    );
  });

  it("crédite la réputation de la famille des pièces livrées", () => {
    const dispatch = vi.fn();
    const state = stateWith({
      taskList: [makeContract()],
      stock: [makeComponent({ id: 10 }), makeComponent({ id: 11 })],
    });

    deliverContract(1)(dispatch as never, (() => state) as never);

    expect(dispatch).toHaveBeenCalledWith(
      addReputationByType({ type: ComponentType.CODE, delta: 1 }),
    );
    const typed = dispatch.mock.calls.filter(
      ([a]) => a.type === addReputationByType.type,
    );
    expect(typed).toHaveLength(1);
  });

  it("refuse la livraison sans rien consommer si le stock est incomplet", () => {
    const dispatch = vi.fn();
    const state = stateWith({
      taskList: [makeContract()],
      // 1 Code pour 2 demandés, et un Module qui ne le remplace pas.
      stock: [
        makeComponent({ id: 10 }),
        makeComponent({ id: 11, kind: "module" }),
      ],
    });

    deliverContract(1)(dispatch as never, (() => state) as never);

    const kinds = dispatch.mock.calls.map((c) => c[0].type);
    expect(kinds).not.toContain(removeComponents.type);
    expect(kinds).not.toContain(removeTask.type);
    expect(kinds).not.toContain(setMoney.type);
    expect(kinds).toContain("notification/pushNotification");
  });

  it("la réputation des contrats est plafonnée par mois", () => {
    const deliver = (contractReputation?: {
      month: string;
      gained: number;
    }) => {
      const dispatch = vi.fn();
      const state = stateWith({
        // Contrat de niveau 3 : il « mérite » 2 points.
        taskList: [
          makeContract({ requirements: [{ kind: "moteur", quantity: 1 }] }),
        ],
        stock: [makeComponent({ id: 10, kind: "moteur" })],
        contractReputation,
      });
      deliverContract(1)(dispatch as never, (() => state) as never);
      return dispatch;
    };

    const first = deliver();
    expect(first).toHaveBeenCalledWith(
      addReputation(CONTRACT_REPUTATION_PER_MONTH),
    );
    expect(first).toHaveBeenCalledWith(
      recordContractReputation({
        month: gameMonthKey(0),
        gained: CONTRACT_REPUTATION_PER_MONTH,
      }),
    );

    // Le mois est déjà servi : plus rien, mais le contrat est bien livré.
    const second = deliver({
      month: gameMonthKey(0),
      gained: CONTRACT_REPUTATION_PER_MONTH,
    });
    const kinds = second.mock.calls.map((c) => c[0].type);
    expect(kinds).not.toContain(addReputation.type);
    expect(kinds).not.toContain(recordContractReputation.type);
    expect(second).toHaveBeenCalledWith(removeComponents([10]));
    expect(second).toHaveBeenCalledWith(removeTask(1));
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
