import { describe, expect, it } from "vitest";

import { ComponentType } from "@/data/interface";
import type { RootState } from "@/data/redux/store";
import tutorialReducer, {
  INACTIVE_TUTORIAL,
  completeTutorialStep,
  hideTutorial,
  seeTutorialIntro,
  setTutorialCollapsed,
  showTutorial,
  startTutorial,
} from "@/data/redux/tutorialSlice";
import { migrations } from "@/data/utils/saveStorage";
import taskReducer, {
  acceptContract,
  generateAvailableContractList,
  initializeTaskState,
} from "@/data/redux/taskSlice";
import { selectComponents } from "@/data/utils/component";
import {
  FIRST_CONTRACT_CLIENT,
  firstContract,
  starterStock,
} from "@/data/utils/firstContract";
import {
  STEP_MONEY,
  TUTORIAL_STEPS,
  currentTutorialStep,
  isTutorialFinished,
  isTutorialStepDone,
  tutorialGuide,
  upcomingTutorialMilestones,
} from "@/data/utils/tutorial";

/** Une partie qui démarre : le fondateur seul, rien de fait. */
const fresh = (over: Record<string, unknown> = {}) =>
  ({
    employe: {
      employeList: [{ id: 1, assignedComponentType: null }],
      nextEmployeId: 2,
    },
    component: { stock: [] },
    task: { taskList: [], clients: {} },
    product: { products: [] },
    ...over,
  }) as unknown as RootState;

describe("étapes des premiers pas", () => {
  it("rien n'est fait au début d'une partie", () => {
    for (const step of TUTORIAL_STEPS) {
      expect(isTutorialStepDone(step.id, fresh(), "/game")).toBe(false);
    }
  });

  it("se cochent d'après la partie", () => {
    const state = fresh({
      employe: {
        employeList: [{ id: 1, assignedComponentType: ComponentType.CODE }],
        nextEmployeId: 3,
      },
      task: { taskList: [], clients: { acme: { delivered: 1 } } },
      product: { products: [{ id: 1 }] },
    });
    for (const id of [
      "produce",
      "sign",
      "deliver",
      "product",
      "hire",
    ] as const) {
      expect(isTutorialStepDone(id, state, "/game")).toBe(true);
    }
  });

  it("la trésorerie se coche en ouvrant la page Entreprise", () => {
    expect(isTutorialStepDone("treasury", fresh(), "/game/finance")).toBe(true);
    expect(isTutorialStepDone("treasury", fresh(), "/game/finance/bank")).toBe(
      true,
    );
  });

  it("éclaire l'élément sur lequel agir quand on est sur la bonne page", () => {
    expect(tutorialGuide("produce", "/game").target).toBe("founder");
    const sign = tutorialGuide("sign", "/game/product/contract");
    expect(sign.target).toBe("contract-sign");
    expect(sign.shortcut).toBeUndefined();
    expect(tutorialGuide("hire", "/game/employe/recruit").target).toBe(
      "recruit-search",
    );
  });

  it("ailleurs, éclaire le bouton de section et propose d'y aller", () => {
    expect(tutorialGuide("sign", "/game")).toMatchObject({
      target: "nav:/game/component",
      shortcut: { to: "/game/product/contract" },
    });
    expect(tutorialGuide("produce", "/game/finance")).toMatchObject({
      target: "nav:/game",
      shortcut: { to: "/game" },
    });
  });

  it("Henri a un mot pour chaque étape", () => {
    for (const step of TUTORIAL_STEPS)
      expect(step.line.length).toBeGreaterThan(0);
  });

  it("l'étape en cours est la première qui reste : signer, livrer, produire…", () => {
    expect(currentTutorialStep([])?.id).toBe("sign");
    expect(currentTutorialStep(["sign", "hire"])?.id).toBe("deliver");
    expect(currentTutorialStep(["sign", "deliver"])?.id).toBe("produce");
    expect(
      currentTutorialStep(TUTORIAL_STEPS.map((s) => s.id)),
    ).toBeUndefined();
  });

  it("le premier produit vient à 15 000 €, puis on recrute à 25 000 €", () => {
    expect(STEP_MONEY).toEqual({ product: 15_000, hire: 25_000 });
    const before = ["sign", "deliver", "produce", "treasury"] as const;
    expect(TUTORIAL_STEPS[TUTORIAL_STEPS.length - 1].id).toBe("hire");
    // Sous 15 000 €, le tutoriel attend sans sauter d'étape.
    expect(currentTutorialStep([...before], { money: 14_999 })).toBeUndefined();
    expect(currentTutorialStep([...before], { money: 15_000 })?.id).toBe(
      "product",
    );
    // Produit créé : le recrutement attend 25 000 €.
    const launched = [...before, "product"] as const;
    expect(
      currentTutorialStep([...launched], { money: 24_999 }),
    ).toBeUndefined();
    expect(isTutorialFinished([...launched])).toBe(false);
    expect(currentTutorialStep([...launched], { money: 25_000 })?.id).toBe(
      "hire",
    );
    expect(isTutorialFinished([...launched, "hire"])).toBe(true);
  });

  it("annonce les seuils qui restent, dans l'ordre", () => {
    const before = ["sign", "deliver", "produce", "treasury"] as const;
    expect(
      upcomingTutorialMilestones([...before]).map((m) => [m.step.id, m.money]),
    ).toEqual([
      ["product", 15_000],
      ["hire", 25_000],
    ]);
    expect(
      upcomingTutorialMilestones([...before, "product"]).map((m) => m.step.id),
    ).toEqual(["hire"]);
  });

  it("au Pôle emploi, éclaire la recherche, puis le dossier, puis les candidats", () => {
    const recruit = "/game/employe/recruit";
    expect(tutorialGuide("hire", recruit, { candidates: 0 }).target).toBe(
      "recruit-search",
    );
    expect(tutorialGuide("hire", recruit, { candidates: 3 }).target).toBe(
      "recruit-dossier",
    );
    expect(tutorialGuide("hire", `${recruit}/12`).target).toBe("recruit-hire");
  });

  it("le stock de départ ne compte pas comme une production", () => {
    const withStarter = fresh({ component: { stock: starterStock() } });
    expect(isTutorialStepDone("produce", withStarter, "/game")).toBe(false);
    const produced = fresh({
      component: {
        stock: [
          ...starterStock(),
          { id: 9, kind: "code", type: ComponentType.CODE, producedBy: 1 },
        ],
      },
    });
    expect(isTutorialStepDone("produce", produced, "/game")).toBe(true);
  });
});

describe("premier contrat", () => {
  it("est toujours le même", () => {
    expect(firstContract()).toEqual(firstContract());
  });

  it("demande des composants de base Code et UX", () => {
    expect(firstContract().requirements.map((r) => r.kind)).toEqual([
      "code",
      "ux",
    ]);
  });

  it("le stock de départ le couvre exactement", () => {
    const stock = starterStock();
    expect(stock.filter((c) => c.kind === "ux")).not.toHaveLength(0);
    expect(
      stock.every(
        (c) =>
          c.type ===
          (c.kind === "code" ? ComponentType.CODE : ComponentType.UX),
      ),
    ).toBe(true);
    // Ids uniques : le stock se consomme pièce par pièce.
    expect(new Set(stock.map((c) => c.id)).size).toBe(stock.length);
    const selection = selectComponents(
      starterStock(),
      firstContract().requirements,
    );
    expect(selection.missing).toEqual([]);
    expect(selection.remainingStock).toEqual([]);
  });

  it("ouvre la liste tant que le studio n'a rien signé, puis disparaît", () => {
    // Premier lot de la partie : à la première heure de jeu.
    const generate = generateAvailableContractList({
      reputation: 0,
      time: 1,
      competitors: [],
    });
    const fresh = taskReducer(undefined, initializeTaskState());
    const first = taskReducer(fresh, generate).availableContractList;
    expect(first[0]).toMatchObject({
      ...firstContract(),
      id: expect.any(Number),
    });

    const signed = taskReducer(
      fresh,
      acceptContract({ ...firstContract(), id: 1, startDate: 0 }),
    );
    const next = taskReducer(signed, generate).availableContractList;
    expect(next.some((c) => c.clientId === FIRST_CONTRACT_CLIENT.id)).toBe(
      false,
    );
  });
});

describe("tutorialSlice", () => {
  it("éteint par défaut, lancé par une nouvelle partie", () => {
    expect(tutorialReducer(undefined, { type: "@@INIT" })).toEqual(
      INACTIVE_TUTORIAL,
    );
    const started = tutorialReducer(undefined, startTutorial());
    expect(started.active).toBe(true);
    expect(started.completed).toEqual([]);
  });

  it("garde ses étapes quand on le replie, le passe ou le rouvre", () => {
    let state = tutorialReducer(undefined, startTutorial());
    state = tutorialReducer(state, completeTutorialStep("produce"));
    state = tutorialReducer(state, completeTutorialStep("produce"));
    state = tutorialReducer(state, setTutorialCollapsed(true));
    state = tutorialReducer(state, hideTutorial());
    expect(state.active).toBe(false);
    state = tutorialReducer(state, showTutorial());
    expect(state).toMatchObject({
      active: true,
      collapsed: false,
      completed: ["produce"],
    });
  });

  it("une nouvelle partie s'ouvre sur la scène d'arrivée, lue une fois", () => {
    let state = tutorialReducer(undefined, startTutorial());
    expect(state.introSeen).toBe(false);
    state = tutorialReducer(state, seeTutorialIntro());
    expect(state.introSeen).toBe(true);
    // Rouvrir le tutoriel ne rejoue pas l'arrivée.
    state = tutorialReducer(state, hideTutorial());
    state = tutorialReducer(state, showTutorial());
    expect(state.introSeen).toBe(true);
  });

  it("une sauvegarde d'avant le tutoriel le garde éteint", () => {
    expect(migrations[8]({ engine: {} }).tutorial).toEqual(INACTIVE_TUTORIAL);
  });
});
