import { describe, it, expect } from "vitest";

import {
  ComponentType,
  PersonType,
  type Person,
  type ProductionPerson,
} from "@/data/interface";
import { generateCandidatesForRole } from "@/data/utils/employe";
import {
  GRUDGE_EXPECTED_MULT,
  SEARCH_MAX_CANDIDATES,
  SEARCH_MIN_CANDIDATES,
  SEARCH_REPUTATION_DISCOUNT_CAP,
  SEARCH_ROLES,
  SEARCH_ROLE_LABEL,
  computeSearchCost,
  searchSalaryRole,
  HOURS_PER_MONTH,
  MARKET_INDEX_CAP,
  RAISE_COOLDOWN_GRANTED,
  SALARY_ENVELOPE,
  SALARY_NOISE,
  buildRaiseProposal,
  computeExpectedSalary,
  counterOffer,
  effectiveRatio,
  hireMoraleDelta,
  negotiationReaction,
  raiseDemandProbability,
  raiseDemandType,
  salaryRole,
} from "@/data/utils/recruitment";
import { selectRaiseDemand } from "@/data/utils/events";

// Person minimal pour les tests de logique pure (les fonctions ciblées ne lisent
// que morale / salary / expectedSalary / signedSalary / temperament).
const emp = (over: Partial<Person> & { id: number }): Person => ({
  sex: "male",
  firstName: "Jean",
  lastName: "Test",
  salary: 2000,
  personType: PersonType.PROD,
  morale: 70,
  ...over,
});

describe("raiseDemandType — couplage morale → palier de demande", () => {
  it("zone verte (≥50) : aucune demande", () => {
    expect(raiseDemandType(50)).toBeNull();
    expect(raiseDemandType(80)).toBeNull();
  });
  it("40–49 : demande polie", () => {
    expect(raiseDemandType(49)).toBe("polie");
    expect(raiseDemandType(40)).toBe("polie");
  });
  it("35–39 : demande ferme", () => {
    expect(raiseDemandType(39)).toBe("ferme");
    expect(raiseDemandType(35)).toBe("ferme");
  });
  it("20–34 : ultimatum", () => {
    expect(raiseDemandType(34)).toBe("ultimatum");
    expect(raiseDemandType(20)).toBe("ultimatum");
  });
  it("< 20 : pas de demande (démission déjà gérée)", () => {
    expect(raiseDemandType(19)).toBeNull();
    expect(raiseDemandType(0)).toBeNull();
  });
});

describe("raiseDemandProbability — proba mensuelle + aggravants", () => {
  it("probas de base par type", () => {
    expect(raiseDemandProbability("polie")).toBeCloseTo(0.15);
    expect(raiseDemandProbability("ferme")).toBeCloseTo(0.3);
    expect(raiseDemandProbability("ultimatum")).toBeCloseTo(0.5);
  });
  it("aggravant sous-payé : +0.10", () => {
    expect(raiseDemandProbability("polie", { underpaid: true })).toBeCloseTo(0.25);
  });
  it("aggravant ambitieux : +0.10", () => {
    expect(raiseDemandProbability("ferme", { ambitious: true })).toBeCloseTo(0.4);
  });
  it("aggravants cumulatifs, bornés à 1", () => {
    expect(
      raiseDemandProbability("ultimatum", { underpaid: true, ambitious: true }),
    ).toBeCloseTo(0.7);
    // hypothétique cumul > 1 reste plafonné
    expect(
      raiseDemandProbability("ultimatum", { underpaid: true, ambitious: true }),
    ).toBeLessThanOrEqual(1);
  });
});

describe("buildRaiseProposal — montant, plafond cumulé, négo partielle", () => {
  it("montant demandé = salary × (1 + p) (p polie = 6 % sans sous-paie)", () => {
    // salary == expected → pas de bonus sous-paie, p = 0.06
    const p = buildRaiseProposal("polie", 2000, 2000, 2000);
    expect(p.asked).toBe(2120); // 2000 × 1.06
  });
  it("bonus sous-paie augmente le montant (plafonné)", () => {
    // expected nettement > salary → bonus sous-paie jusqu'à +10 pts
    const p = buildRaiseProposal("polie", 2000, 2600, 2000);
    // p = 0.06 + min(0.10, 0.30) = 0.16, plafonné à 0.15 → 2000×1.15 = 2300,
    // mais plafond cumulé min(2600×1.25, 2000×1.40)=min(3250,2800)=2800 → 2300 < 2800
    expect(p.asked).toBe(2300);
  });
  it("écrête au plafond cumulé min(expected×1.25, signed×1.40)", () => {
    // ultimatum 15 % + bonus, signed bas → plafond signed×1.40 = 2100
    const p = buildRaiseProposal("ultimatum", 2000, 4000, 1500);
    const ceil = Math.min(4000 * 1.25, 1500 * 1.4); // min(5000, 2100) = 2100
    expect(p.granted).toBe(ceil);
  });
  it("déjà au plafond → capped = true (plus de demande)", () => {
    // salary déjà à signed×1.40
    const p = buildRaiseProposal("polie", 2100, 2000, 1500);
    expect(p.capped).toBe(true);
  });
  it("négociation partielle = 70 % du gain accordé", () => {
    const p = buildRaiseProposal("polie", 2000, 2000, 2000);
    // granted 2120 → partial = 2000 + 0.7×120 = 2084 → round10 = 2080
    expect(p.partial).toBe(2080);
  });
});

describe("negotiationReaction — barème r = offer/expected (roll injecté)", () => {
  it("r ≥ 1.10 : accepte presque toujours (0.98)", () => {
    expect(negotiationReaction(1.2, 0.5).reaction).toBe("accept");
    expect(negotiationReaction(1.2, 0.97).reaction).toBe("accept");
    expect(negotiationReaction(1.2, 0.99).reaction).toBe("counter");
  });
  it("1.00–1.10 : accepte (0.85) sinon contre-offre", () => {
    expect(negotiationReaction(1.05, 0.8).reaction).toBe("accept");
    expect(negotiationReaction(1.05, 0.9).reaction).toBe("counter");
  });
  it("0.90–1.00 : majorité contre-offre (accept 0.35)", () => {
    expect(negotiationReaction(0.95, 0.2).reaction).toBe("accept");
    expect(negotiationReaction(0.95, 0.5).reaction).toBe("counter");
  });
  it("0.80–0.90 : accept 0.10 / counter 0.55 / refuse 0.35", () => {
    expect(negotiationReaction(0.85, 0.05).reaction).toBe("accept");
    expect(negotiationReaction(0.85, 0.4).reaction).toBe("counter");
    expect(negotiationReaction(0.85, 0.9).reaction).toBe("refuse");
  });
  it("0.70–0.80 : counter 0.15 sinon refus", () => {
    expect(negotiationReaction(0.75, 0.1).reaction).toBe("counter");
    expect(negotiationReaction(0.75, 0.5).reaction).toBe("refuse");
  });
  it("< 0.70 : refus dur certain (retrait + rancune)", () => {
    const out = negotiationReaction(0.6, 0.0);
    expect(out.reaction).toBe("refuse");
    expect(out.hardRefuse).toBe(true);
  });
});

describe("effectiveRatio — modulation par tempérament", () => {
  it("loyal accepte plus bas (+0.07)", () => {
    expect(effectiveRatio(0.85, "loyal")).toBeCloseTo(0.92);
  });
  it("ambitieux négocie dur (−0.08)", () => {
    expect(effectiveRatio(0.95, "ambitieux")).toBeCloseTo(0.87);
  });
  it("caméléon : décalage ±0.08 selon le tirage injecté", () => {
    expect(effectiveRatio(1.0, "cameleon", 1)).toBeCloseTo(1.08);
    expect(effectiveRatio(1.0, "cameleon", -1)).toBeCloseTo(0.92);
  });

  it("un loyal sous-payé peut basculer counter→accept vs un neutre", () => {
    // r=0.85, roll au-dessus du seuil accept neutre (0.10) mais le loyal
    // remonte à 0.92 → bande 0.90–1.00 (accept 0.35).
    expect(negotiationReaction(0.85, 0.2).reaction).toBe("counter"); // neutre
    expect(
      negotiationReaction(effectiveRatio(0.85, "loyal"), 0.2).reaction,
    ).toBe("accept"); // loyal
  });
});

describe("counterOffer — remontée d'une fraction de l'écart", () => {
  it("neutre : g = 0.6", () => {
    // offer 1800, expected 2000 → 1800 + 0.6×200 = 1920
    expect(counterOffer(1800, 2000, "loyal")).toBe(1880); // loyal g=0.4 → 1880
    expect(counterOffer(1800, 2000, "ambitieux")).toBe(1960); // g=0.8 → 1960
  });
});

describe("hireMoraleDelta — effet moral à l'arrivée", () => {
  it("offre ≥ 110 % de l'attendu → +5", () => {
    expect(hireMoraleDelta(2200, 2000)).toBe(5);
  });
  it("offre dans la fourchette neutre → 0", () => {
    expect(hireMoraleDelta(2000, 2000)).toBe(0);
  });
  it("offre < 90 % de l'attendu → −5", () => {
    expect(hireMoraleDelta(1700, 2000)).toBe(-5);
  });
});

describe("computeExpectedSalary — borné dans l'enveloppe (anti-régression faillite)", () => {
  const fullstack = (over: Partial<ProductionPerson>): ProductionPerson =>
    ({
      ...emp({ id: 1 }),
      specialty: "FULLSTACK",
      codeStat: 10,
      codeMaxStat: 20,
      visualStat: 10,
      visualMaxStat: 20,
      uxStat: 10,
      uxMaxStat: 20,
      ...over,
    }) as ProductionPerson;

  it("reste dans [floor, cap × marketCap × (1+noise)] quel que soit le niveau", () => {
    const [floor, cap] = SALARY_ENVELOPE.FULLSTACK;
    const lo = computeExpectedSalary(fullstack({ codeStat: 7, visualStat: 7, uxStat: 7 }), 0, 0);
    const hi = computeExpectedSalary(
      fullstack({ codeStat: 13, visualStat: 13, uxStat: 13 }),
      100,
      1,
    );
    expect(lo).toBeGreaterThanOrEqual(Math.round(floor * (1 - SALARY_NOISE)));
    expect(hi).toBeLessThanOrEqual(
      Math.round(cap * MARKET_INDEX_CAP * (1 + SALARY_NOISE)),
    );
  });

  it("indexation marché plafonnée à MARKET_INDEX_CAP", () => {
    const c = fullstack({ codeStat: 13, visualStat: 13, uxStat: 13 });
    const r0 = computeExpectedSalary(c, 0, 0);
    const rHuge = computeExpectedSalary(c, 100000, 0); // réputation absurde
    expect(rHuge).toBeLessThanOrEqual(Math.round(r0 * MARKET_INDEX_CAP) + 10);
  });

  it("salaryRole mappe correctement", () => {
    expect(salaryRole(fullstack({}))).toBe("FULLSTACK");
    expect(
      salaryRole(fullstack({ specialty: "Code" as never })),
    ).toBe("PROD_SPE");
  });
});

describe("selectRaiseDemand — sélection mensuelle (cœur du couplage)", () => {
  const base = {
    expectedSalary: 2000,
    signedSalary: 2000,
    temperament: "loyal" as const,
  };

  it("ne retient personne si tout le monde est en zone verte", () => {
    const list = [emp({ id: 2, morale: 80, ...base }), emp({ id: 3, morale: 60, ...base })];
    expect(selectRaiseDemand(list, 0, () => true)).toBeNull();
  });

  it("exclut le fondateur (id 1)", () => {
    const list = [emp({ id: 1, morale: 30, ...base })];
    expect(selectRaiseDemand(list, 0, () => true)).toBeNull();
  });

  it("respecte le cooldown anti-spam", () => {
    const list = [
      emp({ id: 2, morale: 30, ...base, raiseCooldownUntil: 1000 }),
    ];
    expect(selectRaiseDemand(list, 500, () => true)).toBeNull();
    // une fois le cooldown passé, la demande peut sortir
    const out = selectRaiseDemand(list, 1500, () => true);
    expect(out?.employe.id).toBe(2);
  });

  it("le tirage de proba gate la demande", () => {
    const list = [emp({ id: 2, morale: 45, ...base })];
    expect(selectRaiseDemand(list, 0, () => false)).toBeNull();
    expect(selectRaiseDemand(list, 0, () => true)?.type).toBe("polie");
  });

  it("choisit l'employé le plus en souffrance (morale la plus basse)", () => {
    const list = [
      emp({ id: 2, morale: 45, ...base }),
      emp({ id: 3, morale: 25, ...base }),
      emp({ id: 4, morale: 38, ...base }),
    ];
    const out = selectRaiseDemand(list, 0, () => true);
    expect(out?.employe.id).toBe(3);
    expect(out?.type).toBe("ultimatum");
  });

  it("ignore un employé déjà au plafond salarial (capped)", () => {
    // salary très au-dessus du plafond cumulé → capped → pas de demande
    const list = [
      emp({
        id: 2,
        morale: 30,
        salary: 5000,
        expectedSalary: 2000,
        signedSalary: 2000,
        temperament: "loyal",
      }),
    ];
    expect(selectRaiseDemand(list, 0, () => true)).toBeNull();
  });

  it("cooldown accordé = 4 mois (constante exposée)", () => {
    expect(RAISE_COOLDOWN_GRANTED * HOURS_PER_MONTH).toBe(4 * 720);
  });

  it("rancune : multiplicateur d'attendu après refus dur", () => {
    expect(GRUDGE_EXPECTED_MULT).toBeCloseTo(1.1);
  });
});

// ── Recherche de candidats à la demande (pôle emploi) ───────────────────────

describe("computeSearchCost", () => {
  it("croît plus vite que le nombre de profils demandés", () => {
    const one = computeSearchCost("FULLSTACK", 1, 0);
    const two = computeSearchCost("FULLSTACK", 2, 0);
    const four = computeSearchCost("FULLSTACK", 4, 0);
    expect(two).toBeGreaterThan(one);
    // Progressivité : doubler le volume coûte plus que doubler la note.
    expect(four - two).toBeGreaterThan(two - one);
  });

  it("facture plus cher un poste spécialisé qu'un polyvalent", () => {
    expect(computeSearchCost(ComponentType.CODE, 3, 0)).toBeGreaterThan(
      computeSearchCost("FULLSTACK", 3, 0),
    );
    expect(computeSearchCost(PersonType.QA, 3, 0)).toBeGreaterThan(
      computeSearchCost("FULLSTACK", 3, 0),
    );
  });

  it("applique une remise de réputation plafonnée", () => {
    const base = computeSearchCost("FULLSTACK", 3, 0);
    const reputed = computeSearchCost("FULLSTACK", 3, 100);
    expect(reputed).toBeLessThan(base);
    // Plafond : au-delà de 100 de réputation, la remise ne bouge plus.
    expect(computeSearchCost("FULLSTACK", 3, 500)).toBe(reputed);
    expect(reputed).toBeGreaterThanOrEqual(
      Math.round(base * (1 - SEARCH_REPUTATION_DISCOUNT_CAP)) - 10,
    );
  });

  it("borne le volume dans [min, max] et reste positif", () => {
    expect(computeSearchCost("FULLSTACK", 0, 0)).toBe(
      computeSearchCost("FULLSTACK", SEARCH_MIN_CANDIDATES, 0),
    );
    expect(computeSearchCost("FULLSTACK", 99, 0)).toBe(
      computeSearchCost("FULLSTACK", SEARCH_MAX_CANDIDATES, 0),
    );
  });

  it("couvre tous les postes proposés (grille + libellé)", () => {
    for (const role of SEARCH_ROLES) {
      expect(SEARCH_ROLE_LABEL[role]).toBeTruthy();
      expect(SALARY_ENVELOPE[searchSalaryRole(role)]).toBeDefined();
      expect(computeSearchCost(role, 2, 10)).toBeGreaterThan(0);
    }
  });
});

describe("generateCandidatesForRole", () => {
  it("ne ramène que des profils du poste commandé", () => {
    for (const role of SEARCH_ROLES) {
      const list = generateCandidatesForRole(role, 4, 20);
      expect(list).toHaveLength(4);
      for (const c of list) {
        if (role === PersonType.QA) {
          expect(c.personType).toBe(PersonType.QA);
        } else if (role === PersonType.MARKETING) {
          expect(c.personType).toBe(PersonType.MARKETING);
        } else {
          expect(c.personType).toBe(PersonType.PROD);
          expect((c as ProductionPerson).specialty).toBe(role);
        }
        // Stats masquées tant que l'entretien n'a pas eu lieu (volet A).
        expect(c.revealedStats).toBe(false);
        expect(c.expectedSalary).toBeGreaterThan(0);
      }
    }
  });

  it("borne le volume demandé", () => {
    expect(generateCandidatesForRole("FULLSTACK", 0, 0)).toHaveLength(
      SEARCH_MIN_CANDIDATES,
    );
    expect(generateCandidatesForRole("FULLSTACK", 99, 0)).toHaveLength(
      SEARCH_MAX_CANDIDATES,
    );
  });
});
