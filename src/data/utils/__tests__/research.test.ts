import { describe, expect, it, vi } from "vitest";

import {
  Component,
  ComponentType,
  Contract,
  ContractType,
  PersonType,
  ProductionPerson,
} from "@/data/interface";
import { setMoney } from "@/data/redux/companySlice";
import { applyProductionTick } from "@/data/redux/componentSlice";
import { completeResearch, startResearch } from "@/data/redux/researchSlice";
import type { RootState } from "@/data/redux/store";
import { produceComponents } from "@/data/utils/component";
import { estimateContractLeadTime } from "@/data/utils/deliveryAdvisor";
import {
  FOUNDER_SKILLS,
  RESEARCH_BRANCHES,
  checkResearchStart,
  getFounderSkill,
  processResearchTick,
  researchHoursLeft,
  researchProgress,
  skillTier,
  startFounderResearch,
} from "@/data/utils/research";

const advisor = getFounderSkill("delivery_advisor");
const estimate = getFounderSkill("contract_estimate");

describe("catalogue des compétences du fondateur", () => {
  it("a des identifiants uniques et des prérequis qui existent", () => {
    const ids = FOUNDER_SKILLS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of FOUNDER_SKILLS) {
      expect(s.cost).toBeGreaterThan(0);
      expect(s.durationHours).toBeGreaterThan(0);
      if (s.requires) expect(ids).toContain(s.requires);
    }
  });

  it("garde chaque prérequis dans la branche de la formation (liens verticaux de l'arbre)", () => {
    const branches = RESEARCH_BRANCHES.map((b) => b.id);
    for (const s of FOUNDER_SKILLS) {
      expect(branches).toContain(s.branch);
      if (s.requires) expect(getFounderSkill(s.requires).branch).toBe(s.branch);
    }
  });

  it("calcule le palier depuis la profondeur des prérequis", () => {
    expect(skillTier(advisor)).toBe(0);
    expect(skillTier(estimate)).toBe(1);
  });
});

describe("checkResearchStart", () => {
  it("bloque dans l'ordre : acquise, en cours, prérequis, argent", () => {
    expect(checkResearchStart(advisor, ["delivery_advisor"], null, 0)).toEqual({
      ok: false,
      blocker: "acquired",
    });
    expect(
      checkResearchStart(
        advisor,
        [],
        { skillId: "contract_estimate", startedAt: 0 },
        99999,
      ),
    ).toEqual({ ok: false, blocker: "in_progress" });
    expect(checkResearchStart(estimate, [], null, 99999)).toEqual({
      ok: false,
      blocker: "requires",
    });
    expect(checkResearchStart(advisor, [], null, advisor.cost - 1)).toEqual({
      ok: false,
      blocker: "money",
    });
    expect(checkResearchStart(advisor, [], null, advisor.cost)).toEqual({
      ok: true,
    });
  });
});

describe("avancement d'une formation", () => {
  const current = { skillId: "delivery_advisor" as const, startedAt: 100 };

  it("se lit sur le temps de jeu, borné à [0, 1]", () => {
    expect(researchProgress(current, 100)).toBe(0);
    expect(researchProgress(current, 100 + advisor.durationHours / 2)).toBe(
      0.5,
    );
    expect(researchProgress(current, 100 + advisor.durationHours * 2)).toBe(1);
    expect(researchHoursLeft(current, 100)).toBe(advisor.durationHours);
    expect(researchHoursLeft(current, 100 + advisor.durationHours + 5)).toBe(0);
  });
});

const stateWith = (over: {
  money?: number;
  time?: number;
  acquired?: RootState["research"]["acquired"];
  current?: RootState["research"]["current"];
  employeList?: ProductionPerson[];
}): RootState =>
  ({
    company: { money: over.money ?? 10000, buildingList: [] },
    engine: { time: over.time ?? 0 },
    research: { acquired: over.acquired ?? [], current: over.current ?? null },
    employe: { employeList: over.employeList ?? [] },
    task: { taskList: [] },
    product: { products: [] },
    component: {
      productionProgress: {},
      productionJobs: {},
      productionWaiting: {},
      stock: [],
      nextComponentId: 1,
    },
  }) as unknown as RootState;

describe("startFounderResearch", () => {
  it("débite le coût et enregistre le départ à l'heure courante", () => {
    const dispatch = vi.fn();
    const state = stateWith({ money: 10000, time: 42 });

    const started = startFounderResearch("delivery_advisor")(
      dispatch as never,
      (() => state) as never,
    );

    expect(started).toBe(true);
    expect(dispatch).toHaveBeenCalledWith(setMoney(10000 - advisor.cost));
    expect(dispatch).toHaveBeenCalledWith(
      startResearch({ skillId: "delivery_advisor", startedAt: 42 }),
    );
  });

  it("ne débite rien quand la formation ne peut pas démarrer", () => {
    const dispatch = vi.fn();
    const state = stateWith({ money: 10 });

    const started = startFounderResearch("delivery_advisor")(
      dispatch as never,
      (() => state) as never,
    );

    expect(started).toBe(false);
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: setMoney.type }),
    );
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: startResearch.type }),
    );
  });
});

describe("processResearchTick", () => {
  const current = { skillId: "delivery_advisor" as const, startedAt: 0 };

  it("ne clôt qu'une fois la durée écoulée", () => {
    const dispatch = vi.fn();
    processResearchTick(
      dispatch as never,
      stateWith({ current, time: advisor.durationHours - 1 }),
    );
    expect(dispatch).not.toHaveBeenCalled();

    processResearchTick(
      dispatch as never,
      stateWith({ current, time: advisor.durationHours }),
    );
    expect(dispatch).toHaveBeenCalledWith(completeResearch("delivery_advisor"));
  });

  it("ne fait rien sans formation en cours", () => {
    const dispatch = vi.fn();
    processResearchTick(dispatch as never, stateWith({ time: 9999 }));
    expect(dispatch).not.toHaveBeenCalled();
  });
});

// ── Fondateur improductif pendant la formation ───────────────────────────────

const founder = (over: Partial<ProductionPerson> = {}): ProductionPerson => ({
  id: 1,
  sex: "M",
  firstName: "Léo",
  lastName: "F.",
  salary: 0,
  personType: PersonType.PROD,
  morale: 100,
  buildingId: 1,
  specialty: "FULLSTACK",
  codeStat: 200,
  codeMaxStat: 250,
  visualStat: 100,
  visualMaxStat: 250,
  uxStat: 100,
  uxMaxStat: 250,
  assignedComponentType: ComponentType.CODE,
  ...over,
});

describe("produceComponents pendant une formation du fondateur", () => {
  it("ne fait pas avancer le fondateur, mais les autres si", () => {
    const dispatch = vi.fn();
    // Jeudi 10 h : heures de bureau (la nuit, personne ne produit).
    const state = stateWith({
      time: 10,
      current: { skillId: "delivery_advisor", startedAt: 0 },
      employeList: [founder(), founder({ id: 2 })],
    });

    produceComponents(dispatch as never, state);

    const call = dispatch.mock.calls.find(
      ([a]) => a.type === applyProductionTick.type,
    );
    expect(call).toBeDefined();
    const { progress } = call![0].payload;
    expect(progress[1]).toBeUndefined();
    expect(progress[2]).toBeGreaterThan(0);
  });

  it("le fondateur produit normalement sans formation", () => {
    const dispatch = vi.fn();
    produceComponents(
      dispatch as never,
      stateWith({ time: 10, employeList: [founder()] }),
    );
    const call = dispatch.mock.calls.find(
      ([a]) => a.type === applyProductionTick.type,
    );
    expect(call![0].payload.progress[1]).toBeGreaterThan(0);
  });
});

// ── Estimation de délai avant signature ──────────────────────────────────────

const makeContract = (over: Partial<Contract> = {}): Contract => ({
  id: 1,
  name: "Contrat",
  time: 30 * 24,
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

const makeComponent = (over: Partial<Component> = {}): Component => ({
  id: 1,
  kind: "code",
  type: ComponentType.CODE,
  producedBy: 1,
  producedAt: 0,
  ...over,
});

describe("estimateContractLeadTime", () => {
  it("vaut 0 quand le stock couvre déjà la demande", () => {
    const hours = estimateContractLeadTime({
      contract: makeContract(),
      stock: [makeComponent({ id: 1 }), makeComponent({ id: 2 })],
      employes: [],
      productionProgress: {},
      time: 0,
    });
    expect(hours).toBe(0);
  });

  it("projette la production de l'effectif pour dater le premier créneau", () => {
    // Stat 200, moral 100, seul dans son bâtiment : 840 points par heure de
    // bureau (×4,2), 3200 par Code. Depuis jeudi 0 h, le premier Code sort à
    // 12 h, le second à 17 h.
    const hours = estimateContractLeadTime({
      contract: makeContract(),
      stock: [],
      employes: [founder()],
      productionProgress: {},
      time: 0,
    });
    expect(hours).toBe(17);
  });

  it("renvoie null quand le délai du contrat ne suffira pas", () => {
    const hours = estimateContractLeadTime({
      // Deux Code demandés en 16 h : le second ne sort qu'à 17 h.
      contract: makeContract({ time: 16 }),
      stock: [],
      employes: [founder()],
      productionProgress: {},
      time: 0,
    });
    expect(hours).toBeNull();
  });

  it("ne compte pas une pièce d'une autre sorte, même de la même famille", () => {
    const hours = estimateContractLeadTime({
      contract: makeContract({
        requirements: [{ kind: "module", quantity: 1 }],
      }),
      stock: [makeComponent({ id: 1 }), makeComponent({ id: 2 })],
      employes: [],
      productionProgress: {},
      time: 0,
    });
    expect(hours).toBeNull();
  });

  it("renvoie null pour une pièce que personne n'a le niveau de fabriquer", () => {
    // Moteur : seuil 11 points, le fondateur n'en a que 10.
    const hours = estimateContractLeadTime({
      contract: makeContract({
        requirements: [{ kind: "moteur", quantity: 1 }],
      }),
      stock: [],
      employes: [founder({ codeStat: 100 })],
      productionProgress: {},
      time: 0,
    });
    expect(hours).toBeNull();
  });
});
