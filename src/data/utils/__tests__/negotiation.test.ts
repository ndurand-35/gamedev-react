import { describe, expect, it } from "vitest";

import { Contract, ContractType, StartedContract } from "@/data/interface";
import { firstContract } from "@/data/utils/firstContract";
import {
  CONTRACT_TERMS,
  CONTRACT_TERMS_ORDER,
  EARLY_DELIVERY_BONUS,
  EARLY_DELIVERY_RATIO,
  applyContractTerms,
  computeContractPayout,
  earlyWindowHours,
  negotiableTerms,
  signContract,
} from "@/data/utils/task";
import { adviseDelivery } from "@/data/utils/deliveryAdvisor";

const offer = (over: Partial<Contract> = {}): Contract => ({
  id: 7,
  name: "Contrat test",
  // 40 jours.
  time: 40 * 24,
  clientId: "acme",
  clientName: "ACME",
  clientImage: "",
  loyaltyBonus: 0,
  priceDeposit: 500,
  priceAdditional: 2000,
  priceMalus: 1200,
  type: ContractType.DEV,
  taskDifficulty: 10,
  requirements: [{ kind: "code", quantity: 2 }],
  ...over,
});

describe("formules de contrat", () => {
  it("laisse un contrat standard intact", () => {
    const c = offer();
    expect(applyContractTerms(c, "standard")).toEqual(c);
  });

  it("allonge le délai et baisse le solde en souple, sans toucher au malus", () => {
    const c = applyContractTerms(offer(), "souple");
    expect(c.time).toBe(56 * 24);
    expect(c.priceAdditional).toBe(1700);
    expect(c.priceMalus).toBe(1200);
  });

  it("raccourcit le délai, monte solde et malus en serré", () => {
    const c = applyContractTerms(offer(), "serre");
    expect(c.time).toBe(28 * 24);
    expect(c.priceAdditional).toBe(2500);
    expect(c.priceMalus).toBe(1800);
  });

  it("ne touche jamais à l'acompte", () => {
    for (const t of CONTRACT_TERMS_ORDER) {
      expect(applyContractTerms(offer(), t).priceDeposit).toBe(500);
    }
  });

  it("arrondit le délai négocié au jour plein, jamais sous un jour", () => {
    expect(
      applyContractTerms(offer({ time: 50 * 24 }), "serre").time % 24,
    ).toBe(0);
    expect(applyContractTerms(offer({ time: 24 }), "serre").time).toBe(24);
  });

  it("ne négocie pas le premier contrat", () => {
    expect(negotiableTerms(firstContract())).toEqual(["standard"]);
    expect(negotiableTerms(offer())).toEqual(CONTRACT_TERMS_ORDER);
  });
});

describe("signature", () => {
  it("fige la formule et ses termes dans le contrat signé", () => {
    const signed = signContract(offer(), "serre", 1000);
    expect(signed).toMatchObject({
      id: 7,
      terms: "serre",
      startDate: 1000,
      time: 28 * 24,
      priceAdditional: 2500,
      priceMalus: 1800,
    });
  });
});

describe("prime d'avance selon la formule", () => {
  const signed = (terms?: StartedContract["terms"]): StartedContract =>
    terms ? signContract(offer(), terms, 0) : { ...offer(), startDate: 0 };

  it("traite un contrat sans formule (ancienne partie) comme standard", () => {
    expect(earlyWindowHours(signed())).toBe(
      offer().time * EARLY_DELIVERY_RATIO,
    );
  });

  it("n'ouvre aucune fenêtre de prime en souple", () => {
    const c = signed("souple");
    expect(earlyWindowHours(c)).toBe(0);
    const payout = computeContractPayout(c, 1);
    expect(payout.early).toBe(false);
    expect(payout.reward).toBe(1700);
  });

  it("mesure la fenêtre sur le délai serré", () => {
    const c = signed("serre");
    const window = 28 * 24 * EARLY_DELIVERY_RATIO;
    expect(earlyWindowHours(c)).toBe(window);
    expect(computeContractPayout(c, window - 1).reward).toBe(
      Math.round(2500 * EARLY_DELIVERY_BONUS),
    );
    expect(computeContractPayout(c, window + 1).early).toBe(false);
  });

  it("paie toujours le souple moins qu'un standard, le serré davantage", () => {
    expect(CONTRACT_TERMS.souple.additional).toBeLessThan(1);
    expect(CONTRACT_TERMS.souple.earlyBonus).toBe(false);
    expect(CONTRACT_TERMS.serre.additional).toBeGreaterThan(1);
  });

  it("n'annonce aucune prime d'avance dans la prévision d'un contrat souple", () => {
    const advice = adviseDelivery({
      contract: { ...signed("souple"), requirements: [] },
      stock: [],
      employes: [],
      productionProgress: {},
      productionJobs: {},
      time: 0,
      buildings: [],
    } as never);
    expect(advice.lastEarlyTime).toBeLessThan(0);
    expect(advice.early).toBe(false);
  });
});
