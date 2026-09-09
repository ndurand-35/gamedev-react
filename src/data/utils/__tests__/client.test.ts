import { describe, it, expect, afterEach, vi } from "vitest";

import {
  CLIENT_LOYALTY_MAX,
  CLIENT_RELATION_EARLY,
  CLIENT_RELATION_ON_TIME,
  CLIENT_RELATION_SLOPPY,
  clampRelation,
  clientRelationDelta,
  loyaltyBonus,
  pickReturningClient,
  returningCandidates,
} from "@/data/utils/client";
import { generateNewContract } from "@/data/utils/task";
import {
  CLIENT_RELATION_MAX,
  Client,
  ClientTier,
  clientTier,
} from "@/data/interface";

const client = (overrides: Partial<Client> = {}): Client => ({
  id: "c1",
  name: "Hettinger LLC",
  image: "logo.png",
  relation: 0,
  delivered: 0,
  early: 0,
  lost: false,
  lastSeen: 0,
  ...overrides,
});

describe("relation client — gains et paliers", () => {
  it("récompense l'anticipation deux fois plus qu'une livraison dans les temps", () => {
    expect(clientRelationDelta(true, false)).toBe(CLIENT_RELATION_EARLY);
    expect(clientRelationDelta(false, false)).toBe(CLIENT_RELATION_ON_TIME);
    expect(CLIENT_RELATION_EARLY).toBeGreaterThan(CLIENT_RELATION_ON_TIME);
  });

  it("sanctionne le stock bâclé même livré en avance", () => {
    expect(clientRelationDelta(true, true)).toBe(CLIENT_RELATION_SLOPPY);
    expect(CLIENT_RELATION_SLOPPY).toBeLessThan(0);
  });

  it("borne la relation entre 0 et le maximum", () => {
    expect(clampRelation(-3)).toBe(0);
    expect(clampRelation(CLIENT_RELATION_MAX + 5)).toBe(CLIENT_RELATION_MAX);
    expect(clampRelation(4)).toBe(4);
  });

  it("dérive le palier de la relation, et « Perdu » d'une rupture", () => {
    expect(clientTier(undefined)).toBe(ClientTier.NOUVEAU);
    expect(clientTier(client({ relation: 0 }))).toBe(ClientTier.NOUVEAU);
    expect(clientTier(client({ relation: 1 }))).toBe(ClientTier.HABITUE);
    expect(clientTier(client({ relation: 3 }))).toBe(ClientTier.FIDELE);
    expect(clientTier(client({ relation: 6 }))).toBe(ClientTier.PARTENAIRE);
    // Une rupture prime sur la relation accumulée.
    expect(clientTier(client({ relation: 9, lost: true }))).toBe(
      ClientTier.PERDU,
    );
  });

  it("plafonne la prime de fidélité", () => {
    expect(loyaltyBonus(0)).toBe(0);
    expect(loyaltyBonus(2)).toBeGreaterThan(0);
    expect(loyaltyBonus(CLIENT_RELATION_MAX)).toBe(CLIENT_LOYALTY_MAX);
  });
});

describe("sélection des clients qui repassent commande", () => {
  it("écarte les clients rompus et ceux jamais satisfaits", () => {
    const candidates = returningCandidates({
      ok: client({ id: "ok", relation: 2 }),
      neuf: client({ id: "neuf", relation: 0 }),
      perdu: client({ id: "perdu", relation: 5, lost: true }),
    });
    expect(candidates.map((c) => c.id)).toEqual(["ok"]);
  });

  it("tolère un carnet absent (partie antérieure aux clients à mémoire)", () => {
    expect(returningCandidates(undefined)).toEqual([]);
  });

  it("pondère le tirage par la relation", () => {
    const candidates = [
      client({ id: "faible", relation: 1 }),
      client({ id: "fort", relation: 9 }),
    ];
    // Total de 10 : le premier ticket sur 10 % va au faible, le reste au fort.
    expect(pickReturningClient(candidates, () => 0)?.id).toBe("faible");
    expect(pickReturningClient(candidates, () => 0.5)?.id).toBe("fort");
    expect(pickReturningClient([], () => 0)).toBeUndefined();
  });
});

describe("generateNewContract — clients persistants", () => {
  afterEach(() => vi.restoreAllMocks());

  it("attribue un client identifié à chaque contrat", () => {
    const contracts = generateNewContract(0);
    for (const c of contracts) {
      expect(c.clientId).toBeTruthy();
      expect(c.clientName).toBeTruthy();
      expect(c.loyaltyBonus).toBe(0);
    }
    // Sans carnet, chaque contrat vient d'un inconnu différent.
    expect(new Set(contracts.map((c) => c.clientId)).size).toBe(
      contracts.length,
    );
  });

  it("fait revenir un client fidèle, une seule fois et avec sa prime", () => {
    // random = 0 : le tirage de retour passe systématiquement.
    vi.spyOn(Math, "random").mockReturnValue(0);
    const fidele = client({ id: "fidele", relation: 5 });

    const contracts = generateNewContract(0, { fidele });
    const his = contracts.filter((c) => c.clientId === "fidele");

    expect(his).toHaveLength(1);
    expect(his[0].clientName).toBe("Hettinger LLC");
    expect(his[0].loyaltyBonus).toBe(loyaltyBonus(5));
  });

  it("majore l'acompte et le solde d'un habitué, jamais son malus", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const anonyme = generateNewContract(0)[0];
    const habitue = generateNewContract(0, {
      fidele: client({ id: "fidele", relation: 5 }),
    }).find((c) => c.clientId === "fidele")!;

    const bonus = 1 + loyaltyBonus(5);
    expect(habitue.priceDeposit).toBe(Math.round(anonyme.priceDeposit * bonus));
    expect(habitue.priceAdditional).toBe(
      Math.round(anonyme.priceAdditional * bonus),
    );
    expect(habitue.priceMalus).toBe(anonyme.priceMalus);
  });

  it("ne fait jamais revenir un client rompu", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const contracts = generateNewContract(0, {
      perdu: client({ id: "perdu", relation: 8, lost: true }),
    });
    expect(contracts.some((c) => c.clientId === "perdu")).toBe(false);
  });
});
