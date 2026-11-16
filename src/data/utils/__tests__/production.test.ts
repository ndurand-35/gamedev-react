import { describe, expect, it } from "vitest";

import {
  Component,
  ComponentKindId,
  ComponentType,
  PersonType,
  ProductionPerson,
} from "@/data/interface";
import {
  LUCKY_CHANCE,
  ProductionContext,
  ProductionWorld,
  chooseTarget,
  kindPoints,
  reservedOf,
  runProductionHour,
} from "@/data/utils/production";
import { TIER_LABOR, kindFamily } from "@/data/utils/recipes";
import reducer, {
  ComponentState,
  clearEmployeProgress,
} from "@/data/redux/componentSlice";

// Jeudi 1er janvier 1970 : 10 h est une heure de bureau (rythme Normal),
// minuit et 13 h (pause de midi) n'en sont pas.
const OFFICE_HOUR = 10;
const NIGHT = 0;
const LUNCH = 13;

// Une heure de bureau au rythme Normal pèse 168 / 40 = 4,2 heures moyennes :
// stat 100, seul dans son bâtiment, moral 100 → 420 points dans l'heure.
const POINTS_PER_HOUR_AT_100 = 420;
const THRESHOLD = 100;

const makeDev = (over: Partial<ProductionPerson> = {}): ProductionPerson => ({
  id: 1,
  sex: "F",
  firstName: "Ada",
  lastName: "Test",
  salary: 3000,
  personType: PersonType.PROD,
  morale: 100,
  buildingId: 1,
  specialty: ComponentType.CODE,
  codeStat: 100,
  codeMaxStat: 200,
  visualStat: 10,
  visualMaxStat: 200,
  uxStat: 10,
  uxMaxStat: 200,
  assignedComponentType: ComponentType.CODE,
  ...over,
});

let nextPieceId = 100;
const piece = (kind: ComponentKindId, producedAt = 0): Component => ({
  id: nextPieceId++,
  kind,
  type: kindFamily(kind),
  producedBy: 0,
  producedAt,
});
const pieces = (kind: ComponentKindId, n: number): Component[] =>
  Array.from({ length: n }, () => piece(kind));

const world = (over: Partial<ProductionWorld> = {}): ProductionWorld => ({
  stock: [],
  progress: {},
  jobs: {},
  waiting: {},
  nextId: 1,
  ...over,
});

const ctx = (over: Partial<ProductionContext> = {}): ProductionContext => ({
  employes: [makeDev()],
  time: OFFICE_HOUR,
  demand: {},
  schedules: new Map(),
  busy: new Set(),
  productivity: 1,
  threshold: THRESHOLD,
  // Jamais de coup de génie, sauf mention contraire.
  random: () => 1,
  ...over,
});

const countOf = (stock: Component[], kind: ComponentKindId) =>
  stock.filter((c) => c.kind === kind).length;

describe("coût d'une pièce", () => {
  it("vaut le travail propre de son niveau × le seuil", () => {
    expect(kindPoints("code", THRESHOLD)).toBe(THRESHOLD);
    expect(kindPoints("module", THRESHOLD)).toBe(2 * THRESHOLD);
    expect(kindPoints("moteur", THRESHOLD)).toBe(4 * THRESHOLD);
    expect(kindPoints("cloud", THRESHOLD)).toBe(8 * THRESHOLD);
    expect(TIER_LABOR).toEqual({ 1: 1, 2: 2, 3: 4, 4: 8 });
  });

  it("une heure de 420 points sort quatre Code, ou deux Modules", () => {
    const base = runProductionHour(world(), ctx());
    expect(base.produced.map((p) => p.kind)).toEqual([
      "code",
      "code",
      "code",
      "code",
    ]);
    expect(base.world.progress[1]).toBe(POINTS_PER_HOUR_AT_100 - 4 * THRESHOLD);

    const modules = runProductionHour(
      world({ stock: pieces("code", 6) }),
      ctx({ employes: [makeDev({ post: "module" })] }),
    );
    expect(modules.produced.map((p) => p.kind)).toEqual(["module", "module"]);
    // Les six Code sont partis dans les deux Modules.
    expect(countOf(modules.world.stock, "code")).toBe(0);
    expect(countOf(modules.world.stock, "module")).toBe(2);
  });

  it("numérote, date et attribue les pièces sorties", () => {
    const { produced, world: w } = runProductionHour(
      world({ nextId: 50 }),
      ctx(),
    );
    expect(produced[0]).toEqual({
      id: 50,
      kind: "code",
      type: ComponentType.CODE,
      producedBy: 1,
      producedAt: OFFICE_HOUR,
    });
    expect(w.nextId).toBe(54);
  });
});

describe("réservation des ingrédients", () => {
  it("sort du stock les ingrédients au début de la pièce, les plus anciens d'abord", () => {
    const young = piece("code", 500);
    const old = [piece("code", 1), piece("code", 2), piece("code", 3)];
    const { world: w, produced } = runProductionHour(
      world({ stock: [young, ...old] }),
      // Seuil élevé : le Module reste en chantier.
      ctx({
        employes: [makeDev({ post: "module" })],
        threshold: 10_000,
      }),
    );

    expect(produced).toEqual([]);
    expect(w.jobs[1].kind).toBe("module");
    expect(w.jobs[1].reserved.map((c) => c.id)).toEqual(old.map((c) => c.id));
    expect(w.stock).toEqual([young]);
    expect(w.progress[1]).toBe(POINTS_PER_HOUR_AT_100);
    expect(reservedOf(w.jobs)).toEqual({ code: 3 });
  });

  it("se replie sur un ingrédient manquant que l'employé sait fabriquer", () => {
    const stock = [piece("code")];
    const { world: w } = runProductionHour(
      world({ stock }),
      ctx({
        employes: [makeDev({ post: "module" })],
        threshold: 10_000,
      }),
    );

    // Il manque deux Code au Module : elle en fabrique un, sans rien réserver.
    expect(w.jobs[1]).toEqual({ kind: "code", reserved: [], fallback: true });
    expect(w.stock).toEqual(stock);
    expect(w.waiting).toEqual({});
  });

  it("le repli se termine puis la pièce du poste démarre dès que tout est là", () => {
    const { world: w, produced } = runProductionHour(
      world({ stock: pieces("code", 2) }),
      ctx({
        employes: [makeDev({ post: "module" })],
        threshold: 200,
      }),
    );
    // 420 points : un Code de repli (200), puis le Module réserve ses 3 Code.
    expect(produced.map((p) => p.kind)).toEqual(["code"]);
    expect(w.jobs[1].kind).toBe("module");
    expect(w.jobs[1].fallback).toBeUndefined();
    expect(w.jobs[1].reserved).toHaveLength(3);
    expect(w.stock).toEqual([]);
    expect(w.progress[1]).toBe(220);
  });

  it("attend, sans rien réserver, quand aucun ingrédient manquant n'est à sa portée", () => {
    // Animation = 2 Illustrations + 1 Module ; le Module demande 6 en Code.
    const designer = makeDev({
      specialty: ComponentType.VISUEL,
      assignedComponentType: ComponentType.VISUEL,
      post: "animation",
      visualStat: 120,
      codeStat: 10,
    });
    const stock = pieces("illustration", 2);
    const { world: w, produced } = runProductionHour(
      world({ stock }),
      ctx({ employes: [designer] }),
    );

    expect(produced).toEqual([]);
    expect(w.jobs[1]).toBeUndefined();
    expect(w.waiting).toEqual({ 1: { module: 1 } });
    expect(w.stock).toEqual(stock);
    // Rien n'avance tant qu'il attend.
    expect(w.progress[1] ?? 0).toBe(0);
  });

  it("le reliquat de points d'une pièce finie attend la suivante", () => {
    const designer = makeDev({
      assignedComponentType: ComponentType.VISUEL,
      post: "animation",
      visualStat: 120,
      codeStat: 10,
    });
    // 504 points : une Animation (400), puis il manque un Module.
    const { world: w, produced } = runProductionHour(
      world({ stock: [...pieces("illustration", 4), piece("module")] }),
      ctx({ employes: [designer] }),
    );
    expect(produced.map((p) => p.kind)).toEqual(["animation"]);
    expect(w.waiting).toEqual({ 1: { module: 1 } });
    expect(w.progress[1]).toBeCloseTo(120 * 4.2 - 400);
  });

  it("l'attente se lève dès que l'ingrédient arrive", () => {
    const designer = makeDev({
      assignedComponentType: ComponentType.VISUEL,
      post: "animation",
      visualStat: 120,
      codeStat: 10,
    });
    const { world: w } = runProductionHour(
      world({
        stock: [...pieces("illustration", 2), piece("module")],
        waiting: { 1: { module: 1 } },
      }),
      ctx({ employes: [designer], threshold: 10_000 }),
    );
    expect(w.waiting).toEqual({});
    expect(w.jobs[1].kind).toBe("animation");
    expect(w.stock).toEqual([]);
  });

  it("un poste hors de sa portée (seuil non atteint) retombe en Auto", () => {
    // Stat 50 < seuil 60 du niveau 2 : le Module n'est pas tenable.
    const { produced, world: w } = runProductionHour(
      world({ stock: pieces("code", 3) }),
      ctx({ employes: [makeDev({ codeStat: 50, post: "module" })] }),
    );
    expect(produced.every((p) => p.kind === "code")).toBe(true);
    expect(countOf(w.stock, "code")).toBe(3 + produced.length);
  });
});

describe("Auto : choix de la pièce", () => {
  it("sans besoin, fabrique le composant de base de sa famille", () => {
    expect(
      chooseTarget(
        makeDev({ codeStat: 200 }),
        ComponentType.CODE,
        [],
        {},
        {},
        OFFICE_HOUR,
      ),
    ).toBe("code");
    expect(
      chooseTarget(makeDev(), ComponentType.UX, [], {}, {}, OFFICE_HOUR),
    ).toBe("ux");
  });

  it("vise la pièce manquante au plus haut niveau qu'il maîtrise", () => {
    // Deux Modules et une BDD en stock : il ne manque que le Moteur.
    const stock = [...pieces("module", 2), piece("bdd")];
    const demand = { moteur: 1 };
    const senior = makeDev({ codeStat: 120 });
    const medior = makeDev({ codeStat: 70 });

    expect(
      chooseTarget(senior, ComponentType.CODE, stock, {}, demand, OFFICE_HOUR),
    ).toBe("moteur");
    // Le Moteur (seuil 11) lui échappe et rien d'autre ne manque : du Code.
    expect(
      chooseTarget(medior, ComponentType.CODE, stock, {}, demand, OFFICE_HOUR),
    ).toBe("code");
  });

  it("préfère une pièce dont les ingrédients sont déjà là", () => {
    // Le Moteur manque, mais ses Modules aussi : il commence par un Module,
    // dont les trois Code sont en stock.
    const stock = [...pieces("code", 3), piece("bdd")];
    expect(
      chooseTarget(
        makeDev({ codeStat: 120 }),
        ComponentType.CODE,
        stock,
        {},
        { moteur: 1 },
        OFFICE_HOUR,
      ),
    ).toBe("module");
  });

  it("tient compte des pièces déjà en chantier", () => {
    const stock = pieces("code", 6);
    const demand = { module: 1 };
    const jobs = { 9: { kind: "module" as const, reserved: [] } };
    expect(
      chooseTarget(
        makeDev({ codeStat: 120 }),
        ComponentType.CODE,
        stock,
        {},
        demand,
        OFFICE_HOUR,
      ),
    ).toBe("module");
    // Un collègue fait déjà le Module demandé : plus de déficit.
    expect(
      chooseTarget(
        makeDev({ codeStat: 120 }),
        ComponentType.CODE,
        stock,
        jobs,
        demand,
        OFFICE_HOUR,
      ),
    ).toBe("code");
  });

  it("ne vise pas une pièce dont la technologie n'est pas encore inventée", () => {
    // Le Réseau attend les réseaux (1985) : en 1970, c'est le Moteur.
    const stock = [...pieces("module", 2), ...pieces("bdd", 2)];
    expect(
      chooseTarget(
        makeDev({ codeStat: 120 }),
        ComponentType.CODE,
        stock,
        {},
        { reseau: 1, moteur: 1 },
        OFFICE_HOUR,
      ),
    ).toBe("moteur");
  });

  it("sert les besoins par ordre de priorité", () => {
    const stock = [...pieces("module", 2), piece("bdd"), ...pieces("code", 3)];
    const senior = makeDev({ codeStat: 120 });
    // Le contrat urgent veut trois Modules : il en manque un.
    expect(
      chooseTarget(
        senior,
        ComponentType.CODE,
        stock,
        {},
        [{ module: 3 }, { moteur: 1 }],
        OFFICE_HOUR,
      ),
    ).toBe("module");
    // Le Moteur passe en premier : ses ingrédients sont là.
    expect(
      chooseTarget(
        senior,
        ComponentType.CODE,
        stock,
        {},
        [{ moteur: 1 }, { module: 3 }],
        OFFICE_HOUR,
      ),
    ).toBe("moteur");
  });

  it("passe un besoin auquel il ne peut pas contribuer", () => {
    // Le premier besoin est du Visuel : un développeur sert le suivant.
    expect(
      chooseTarget(
        makeDev({ codeStat: 120 }),
        ComponentType.CODE,
        pieces("code", 3),
        {},
        [{ illustration: 1 }, { module: 1 }],
        OFFICE_HOUR,
      ),
    ).toBe("module");
  });

  it("en jeu, l'Auto réserve les ingrédients de la pièce choisie", () => {
    const { world: w } = runProductionHour(
      world({ stock: pieces("code", 3) }),
      ctx({
        employes: [makeDev({ codeStat: 120 })],
        demand: { module: 1 },
        threshold: 10_000,
      }),
    );
    expect(w.jobs[1].kind).toBe("module");
    expect(w.stock).toEqual([]);
  });
});

describe("abandon d'une pièce en cours", () => {
  const reserved = pieces("code", 3);
  const inProgress = () =>
    world({
      jobs: { 1: { kind: "module", reserved } },
      progress: { 1: 150 },
    });

  it("un changement de poste rend les ingrédients réservés, le travail fait reste acquis", () => {
    const { world: w } = runProductionHour(
      inProgress(),
      // La nuit : rien ne redémarre, on observe le seul abandon.
      ctx({ employes: [makeDev({ post: "bdd" })], time: NIGHT }),
    );
    expect(w.stock).toEqual(reserved);
    expect(w.jobs).toEqual({});
    // Les points déjà faits serviront à la pièce suivante.
    expect(w.progress[1]).toBe(150);
  });

  it("garder le même poste conserve la pièce et son avancement", () => {
    const { world: w } = runProductionHour(
      inProgress(),
      ctx({ employes: [makeDev({ post: "module" })], time: NIGHT }),
    );
    expect(w.jobs[1].reserved).toEqual(reserved);
    expect(w.progress[1]).toBe(150);
    expect(w.stock).toEqual([]);
  });

  it("un changement de famille ou une désaffectation rendent aussi le stock", () => {
    const visual = runProductionHour(
      inProgress(),
      ctx({
        employes: [makeDev({ assignedComponentType: ComponentType.VISUEL })],
        time: NIGHT,
      }),
    );
    expect(visual.world.stock).toEqual(reserved);

    const idle = runProductionHour(
      inProgress(),
      ctx({
        employes: [makeDev({ assignedComponentType: null })],
        time: NIGHT,
      }),
    );
    expect(idle.world.stock).toEqual(reserved);
    expect(idle.world.progress[1]).toBeUndefined();
  });

  it("le départ d'un employé rend ses ingrédients", () => {
    const { world: w } = runProductionHour(
      inProgress(),
      ctx({ employes: [], time: NIGHT }),
    );
    expect(w.stock).toEqual(reserved);
    expect(w.jobs).toEqual({});
  });

  it("clearEmployeProgress rend les ingrédients au stock du slice", () => {
    const state: ComponentState = {
      stock: [],
      productionProgress: { 1: 150 },
      productionJobs: { 1: { kind: "module", reserved } },
      productionWaiting: { 1: {} },
      nextComponentId: 1,
    };
    const next = reducer(state, clearEmployeProgress(1));
    expect(next.stock).toEqual(reserved);
    expect(next.productionJobs).toEqual({});
    expect(next.productionProgress).toEqual({});
    expect(next.productionWaiting).toEqual({});
  });
});

describe("coup de génie", () => {
  it("survient sous LUCKY_CHANCE", () => {
    expect(LUCKY_CHANCE).toBeCloseTo(0.03);
  });

  it("au niveau 2 et plus, les ingrédients reviennent au stock", () => {
    const codes = pieces("code", 3);
    // 200 d'avance + 420 : un Module (400) sort dans l'heure.
    const rolls = [0, 1, 1];
    const { world: w, produced } = runProductionHour(
      world({
        stock: [],
        jobs: { 1: { kind: "module", reserved: codes } },
        progress: { 1: 200 },
      }),
      ctx({
        employes: [makeDev({ post: "module" })],
        threshold: 200,
        random: () => rolls.shift() ?? 1,
      }),
    );

    expect(produced).toHaveLength(1);
    expect(produced[0]).toMatchObject({ kind: "module", lucky: true });
    // Les trois Code reviennent… et repartent aussitôt dans le Module suivant.
    expect(w.jobs[1].kind).toBe("module");
    expect(w.jobs[1].reserved.map((c) => c.id).sort()).toEqual(
      codes.map((c) => c.id).sort(),
    );
  });

  it("sans coup de génie, les ingrédients sont consommés", () => {
    const codes = pieces("code", 3);
    const { world: w, produced } = runProductionHour(
      world({
        jobs: { 1: { kind: "module", reserved: codes } },
        progress: { 1: 200 },
      }),
      ctx({ employes: [makeDev({ post: "module" })], threshold: 200 }),
    );
    // 620 points : le Module (400), puis un Code de repli (200) pour le
    // Module suivant, faute de Code en stock.
    expect(produced.map((p) => p.kind)).toEqual(["module", "code"]);
    expect(produced[0].lucky).toBeUndefined();
    expect(w.stock.filter((c) => codes.includes(c))).toEqual([]);
    expect(w.jobs[1]).toEqual({ kind: "code", reserved: [], fallback: true });
  });

  it("au niveau 1, une seconde pièce sort", () => {
    const rolls = [0];
    const { produced } = runProductionHour(
      world({ progress: { 1: 0 } }),
      ctx({
        // 420 points pour un Code à 400 : une seule pièce « travaillée ».
        threshold: 400,
        random: () => rolls.shift() ?? 1,
      }),
    );
    expect(produced.map((p) => [p.kind, p.lucky])).toEqual([
      ["code", true],
      ["code", undefined],
    ]);
  });
});

describe("présence", () => {
  it("rien ne sort hors des heures de bureau, l'avancement est gardé", () => {
    for (const time of [NIGHT, LUNCH]) {
      const { world: w, produced } = runProductionHour(
        world({ progress: { 1: 50 } }),
        ctx({ time }),
      );
      expect(produced).toEqual([]);
      expect(w.progress[1]).toBe(50);
      expect(w.jobs).toEqual({});
    }
  });

  it("rien ne sort pendant les congés, la production reprend au retour", () => {
    const away = makeDev({ leaveUntil: OFFICE_HOUR + 1 });
    expect(
      runProductionHour(world(), ctx({ employes: [away] })).produced,
    ).toEqual([]);
    expect(
      runProductionHour(
        world(),
        ctx({ employes: [away], time: OFFICE_HOUR + 1 }),
      ).produced,
    ).toHaveLength(4);
  });

  it("un employé occupé ou sans bâtiment ne produit pas", () => {
    expect(
      runProductionHour(world(), ctx({ busy: new Set([1]) })).produced,
    ).toEqual([]);
    expect(
      runProductionHour(
        world(),
        ctx({ employes: [makeDev({ buildingId: undefined })] }),
      ).produced,
    ).toEqual([]);
  });
});
