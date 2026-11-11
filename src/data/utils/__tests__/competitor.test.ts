import { afterEach, describe, expect, it, vi } from "vitest";

import { Client, ClientTier, Competitor } from "@/data/interface";
import { loyaltyBonus } from "@/data/utils/client";
import {
  COMPETITOR_ROSTER_SIZE,
  buildRoster,
  competitorStandings,
  pickContractIssuer,
  sortCompetitors,
} from "@/data/utils/competitor";
import { generateNewContract } from "@/data/utils/task";

const competitor = (id: string, name = `Studio ${id}`): Competitor => ({
  id,
  name,
  image: "",
});

const client = (over: Partial<Client> & { id: string }): Client => ({
  name: `Studio ${over.id}`,
  image: "",
  relation: 0,
  delivered: 0,
  early: 0,
  lost: false,
  lastSeen: 0,
  ...over,
});

describe("buildRoster", () => {
  it("tire un marché complet d'inconnus aux ids distincts", () => {
    const roster = buildRoster();
    expect(roster).toHaveLength(COMPETITOR_ROSTER_SIZE);
    expect(new Set(roster.map((c) => c.id)).size).toBe(roster.length);
    for (const c of roster) expect(c.name).toBeTruthy();
  });

  it("garde les clients déjà au carnet et complète jusqu'à la taille cible", () => {
    const clients = {
      a: client({ id: "a", name: "Acme" }),
      b: client({ id: "b", name: "Bravo", lost: true }),
    };
    const roster = buildRoster(clients, 4);
    expect(roster).toHaveLength(4);
    expect(roster.slice(0, 2)).toEqual([
      { id: "a", name: "Acme", image: "" },
      { id: "b", name: "Bravo", image: "" },
    ]);
  });

  it("ne tronque pas un carnet plus grand que la taille cible", () => {
    const clients = Object.fromEntries(
      ["a", "b", "c"].map((id) => [id, client({ id })]),
    );
    expect(buildRoster(clients, 2)).toHaveLength(3);
  });
});

describe("pickContractIssuer", () => {
  const roster = [competitor("a"), competitor("b"), competitor("c")];

  const issued = (counts: Record<string, number>) =>
    new Map(Object.entries(counts));

  it("préfère un studio sans contrat dans le lot", () => {
    const placed = issued({ a: 1, b: 1 });
    expect(pickContractIssuer(roster, {}, placed, () => 0)?.id).toBe("c");
    expect(pickContractIssuer(roster, {}, placed, () => 0.99)?.id).toBe("c");
  });

  it("prend le moins sollicité quand tout le monde est déjà placé", () => {
    const placed = issued({ a: 2, b: 1, c: 2 });
    expect(pickContractIssuer(roster, {}, placed, () => 0)?.id).toBe("b");
    expect(pickContractIssuer(roster, {}, placed, () => 0.99)?.id).toBe("b");
  });

  it("tire au sort entre ex æquo", () => {
    const placed = issued({ a: 1, b: 1, c: 1 });
    expect(pickContractIssuer(roster, {}, placed, () => 0)?.id).toBe("a");
    expect(pickContractIssuer(roster, {}, placed, () => 0.99)?.id).toBe("c");
  });

  it("n'émet jamais depuis un studio rompu", () => {
    const clients = { a: client({ id: "a", lost: true }) };
    for (const r of [0, 0.5, 0.99]) {
      expect(
        pickContractIssuer(roster, clients, new Map(), () => r)?.id,
      ).not.toBe("a");
    }
  });

  it("renvoie undefined quand plus personne ne veut de nous", () => {
    const clients = Object.fromEntries(
      roster.map((c) => [c.id, client({ id: c.id, lost: true })]),
    );
    expect(pickContractIssuer(roster, clients, new Map())).toBeUndefined();
  });
});

describe("generateNewContract — émis par le marché", () => {
  afterEach(() => vi.restoreAllMocks());

  const roster = Array.from({ length: 4 }, (_, i) => competitor(`s${i}`));

  it("fait émettre chaque contrat par un studio du roster", () => {
    const ids = new Set(roster.map((c) => c.id));
    for (const c of generateNewContract(0, {}, roster)) {
      expect(ids.has(c.clientId)).toBe(true);
      expect(c.clientName).toBe(`Studio ${c.clientId}`);
    }
  });

  it("répartit le lot sur tout le marché avant de repasser par un studio", () => {
    // 8 contrats à réputation 0 pour 4 studios : chacun en émet exactement 2.
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const counts = new Map<string, number>();
    for (const c of generateNewContract(0, {}, roster)) {
      counts.set(c.clientId, (counts.get(c.clientId) ?? 0) + 1);
    }
    expect([...counts.values()]).toEqual([2, 2, 2, 2]);
  });

  it("écarte un studio rompu du lot", () => {
    const clients = { s0: client({ id: "s0", relation: 9, lost: true }) };
    const contracts = generateNewContract(0, clients, roster);
    expect(contracts.some((c) => c.clientId === "s0")).toBe(false);
  });

  it("applique la prime de fidélité d'un habitué même tiré comme émetteur du marché", () => {
    // random = 1 : jamais de tirage « client de retour », l'habitué ne peut
    // arriver que par le roster — sa prime doit quand même suivre.
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const clients = { s0: client({ id: "s0", relation: 5 }) };
    const his = generateNewContract(0, clients, roster).filter(
      (c) => c.clientId === "s0",
    );
    expect(his.length).toBeGreaterThan(0);
    for (const c of his) expect(c.loyaltyBonus).toBe(loyaltyBonus(5));
  });

  it("nomme un inconnu de passage quand tout le marché a rompu", () => {
    const clients = Object.fromEntries(
      roster.map((c) => [c.id, client({ id: c.id, lost: true })]),
    );
    const contracts = generateNewContract(0, clients, roster);
    expect(contracts.length).toBeGreaterThan(0);
    const ids = new Set(roster.map((c) => c.id));
    for (const c of contracts) {
      expect(ids.has(c.clientId)).toBe(false);
      expect(c.clientName).toBeTruthy();
    }
  });
});

describe("competitorStandings", () => {
  const roster = [
    competitor("perdu"),
    competitor("inconnu"),
    competitor("fidele"),
    competitor("habitue"),
  ];
  const clients = {
    perdu: client({ id: "perdu", relation: 8, delivered: 4, lost: true }),
    fidele: client({ id: "fidele", relation: 5, delivered: 3, early: 2 }),
    habitue: client({ id: "habitue", relation: 1, delivered: 1 }),
  };

  it("classe les actifs par relation, les inconnus ensuite, les rompus en dernier", () => {
    const ids = competitorStandings(roster, clients).map(
      (s) => s.competitor.id,
    );
    expect(ids).toEqual(["fidele", "habitue", "inconnu", "perdu"]);
  });

  it("dérive palier et prime depuis le carnet, sans prime pour un rompu", () => {
    const byId = Object.fromEntries(
      competitorStandings(roster, clients).map((s) => [s.competitor.id, s]),
    );
    expect(byId.fidele.tier).toBe(ClientTier.FIDELE);
    expect(byId.fidele.bonus).toBe(loyaltyBonus(5));
    expect(byId.inconnu.tier).toBe(ClientTier.NOUVEAU);
    expect(byId.inconnu.client).toBeUndefined();
    expect(byId.perdu.tier).toBe(ClientTier.PERDU);
    expect(byId.perdu.bonus).toBe(0);
  });

  it("trie la relation en plaçant un rompu sous toute relation, même forte", () => {
    const standings = competitorStandings(roster, clients);
    const ids = sortCompetitors(standings, {
      key: "relation",
      direction: "asc",
    }).map((s) => s.competitor.id);
    expect(ids[0]).toBe("perdu");
    expect(ids[ids.length - 1]).toBe("fidele");
  });
});
