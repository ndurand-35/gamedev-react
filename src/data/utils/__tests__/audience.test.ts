import { describe, expect, it } from "vitest";

import { GENRES, ProductGenre } from "@/data/interface";
import {
  ACQUISITION_RATE,
  AudienceEntry,
  BASE_CHURN,
  CHURN_CAP,
  POPULATION_BASE,
  churnBreakdown,
  equilibriumOccupancy,
  initialDiffuseUsers,
  segmentPopulation,
  stepAudience,
} from "@/data/utils/audience";
import {
  BusinessModel,
  defaultPrice,
  monthlyRevenue,
} from "@/data/utils/businessModel";
import { CampaignType } from "@/data/utils/economy";

const { OUTIL, SERVICE, JEU, PLATEFORME } = ProductGenre;
const K = GENRES[OUTIL].baseline;

const entry = (over: Partial<AudienceEntry> = {}): AudienceEntry => ({
  key: "p1",
  genre: OUTIL,
  model: BusinessModel.SALE,
  price: defaultPrice(BusinessModel.SALE, OUTIL),
  users: 0,
  appeal: K,
  freshness: 1,
  bugs: 0,
  launchBoost: 1,
  ours: true,
  shock: 0,
  ...over,
});

const pop = segmentPopulation(OUTIL, 0);

describe("population", () => {
  it("l'ordre d'attrition de base est Plateforme < Service < Outil < Jeu", () => {
    expect(BASE_CHURN[PLATEFORME]).toBeLessThan(BASE_CHURN[SERVICE]);
    expect(BASE_CHURN[SERVICE]).toBeLessThan(BASE_CHURN[OUTIL]);
    expect(BASE_CHURN[OUTIL]).toBeLessThan(BASE_CHURN[JEU]);
  });

  it("en 1970, la population vaut la base de chaque genre", () => {
    for (const g of [OUTIL, SERVICE, JEU, PLATEFORME]) {
      expect(segmentPopulation(g, 0)).toBeCloseTo(POPULATION_BASE[g]);
      expect(POPULATION_BASE[g]).toBeGreaterThan(0);
    }
  });

  it("la confiance du public la réduit", () => {
    expect(segmentPopulation(OUTIL, 0, { [OUTIL]: 0.5 })).toBeCloseTo(pop / 2);
  });

  it("à l'équilibre, la concurrence diffuse seule rapporte la demande de 1970 en vente", () => {
    // Un produit qui serait la diffuse : attrition × prix × occupés = demande.
    const occupied = pop * equilibriumOccupancy(OUTIL);
    expect(
      occupied * BASE_CHURN[OUTIL] * defaultPrice(BusinessModel.SALE, OUTIL),
    ).toBeCloseTo(GENRES[OUTIL].demand, -1);
  });
});

describe("attrition", () => {
  it("vaut la base du genre pour un produit frais, sans bug, au prix de référence", () => {
    expect(churnBreakdown(entry()).rate).toBeCloseTo(BASE_CHURN[OUTIL]);
    expect(churnBreakdown(entry({ genre: JEU, price: 40 })).rate).toBeCloseTo(
      BASE_CHURN[JEU],
    );
  });

  it("multiplie modèle, âge, bugs et prix", () => {
    // L'exemple de la fiche : licence, fraîcheur 85 %, 1 bug, prix -10 %.
    const b = churnBreakdown(
      entry({
        model: BusinessModel.ANNUAL_LICENSE,
        price: defaultPrice(BusinessModel.ANNUAL_LICENSE, OUTIL) * 0.9,
        freshness: 0.85,
        bugs: 1,
      }),
    );
    expect(b.model).toBe(0.6);
    expect(b.aging).toBeCloseTo(1.3);
    expect(b.bugs).toBeCloseTo(1.1);
    expect(b.price).toBeCloseTo(0.949, 3);
    expect(b.rate).toBeCloseTo(0.03 * 0.6 * 1.3 * 1.1 * 0.949, 4);
  });

  it("les bugs pèsent selon le genre et sont plafonnés", () => {
    const service = churnBreakdown(entry({ genre: SERVICE, bugs: 3 }));
    expect(service.bugs).toBeCloseTo(1.75);
    expect(churnBreakdown(entry({ genre: SERVICE, bugs: 50 })).bugs).toBe(2);
  });

  it("la campagne Rétention ne touche que nos produits", () => {
    expect(churnBreakdown(entry(), 0.5).rate).toBeCloseTo(0.015);
    expect(churnBreakdown(entry({ ours: false }), 0.5).rate).toBeCloseTo(0.03);
  });

  it("la pression publicitaire joue en publicité", () => {
    const ad = entry({
      genre: SERVICE,
      model: BusinessModel.ADVERTISING,
      price: 0,
      adPressure: 5,
    });
    expect(churnBreakdown(ad).adPressure).toBeGreaterThan(1);
    expect(churnBreakdown(ad).price).toBe(1);
  });

  it("est plafonnée", () => {
    expect(
      churnBreakdown(
        entry({ genre: JEU, model: BusinessModel.PER_PLAY, freshness: 0, bugs: 20 }),
      ).rate,
    ).toBe(CHURN_CAP);
  });
});

describe("pas mensuel", () => {
  it("un produit lancé sur un segment à l'équilibre capte sa part du flux", () => {
    const step = stepAudience({ entries: [entry()], time: 0 });
    const diffuse = initialDiffuseUsers(OUTIL, 0);
    const free = pop - diffuse * (1 - BASE_CHURN[OUTIL]);
    const flow = free * ACQUISITION_RATE[OUTIL];
    // Attractivité égale à la diffuse : la moitié du flux.
    expect(step.entries.p1.arrivals).toBeCloseTo(flow / 2);
    expect(step.entries.p1.users).toBeCloseTo(flow / 2);
    expect(step.entries.p1.revenue).toBeCloseTo((flow / 2) * 2000);
  });

  it("en vente unitaire, le revenu vient des arrivées dès le premier mois", () => {
    // À l'équilibre, la part du flux vaut la part du segment de l'ancien
    // marché : A ÷ (A + K) de la demande.
    const step = stepAudience({ entries: [entry()], time: 0 });
    expect(step.entries.p1.revenue).toBeCloseTo(GENRES[OUTIL].demand * 0.5, -1);
  });

  it("à l'équilibre, le flux d'arrivées compense les départs", () => {
    const step = stepAudience({ entries: [], time: 0 });
    expect(step.segments[OUTIL].diffuse).toBeCloseTo(
      initialDiffuseUsers(OUTIL, 0),
    );
  });

  it("le prix plus bas attire plus", () => {
    const cheap = stepAudience({ entries: [entry({ price: 1000 })], time: 0 });
    const ref = stepAudience({ entries: [entry()], time: 0 });
    expect(cheap.entries.p1.arrivals).toBeGreaterThan(ref.entries.p1.arrivals);
  });

  it("l'élan et la campagne Acquisition augmentent les arrivées", () => {
    const ref = stepAudience({ entries: [entry()], time: 0 });
    const boosted = stepAudience({ entries: [entry({ launchBoost: 1.5 })], time: 0 });
    expect(boosted.entries.p1.arrivals).toBeGreaterThan(ref.entries.p1.arrivals);
    const campaign = {
      type: CampaignType.ACQUISITION,
      effectiveness: 1,
      startTime: 0,
      endTime: 1000,
    };
    const camp = stepAudience({ entries: [entry()], time: 0, campaign });
    expect(camp.entries.p1.arrivals).toBeGreaterThan(ref.entries.p1.arrivals);
  });

  it("les partants redeviennent libres, et un concurrent attrayant les récupère", () => {
    const step = stepAudience({
      entries: [
        entry({ users: 100 }),
        entry({ key: "r1", ours: false, appeal: K * 10 }),
      ],
      diffuse: { [OUTIL]: pop - 100 },
      time: 0,
    });
    expect(step.entries.p1.departures).toBeCloseTo(3);
    expect(step.entries.r1.arrivals).toBeGreaterThan(step.entries.p1.arrivals);
  });

  it("le départ ponctuel s'ajoute à l'attrition", () => {
    const step = stepAudience({
      entries: [entry({ users: 100, shock: 0.1 })],
      diffuse: { [OUTIL]: 0 },
      time: 0,
    });
    expect(step.entries.p1.departures).toBeCloseTo(100 * (1 - 0.97 * 0.9));
  });

  it("saturation : plus le segment est occupé, moins il arrive de monde", () => {
    const half = stepAudience({
      entries: [entry()],
      diffuse: { [OUTIL]: pop / 2 },
      time: 0,
    });
    const full = stepAudience({
      entries: [entry()],
      diffuse: { [OUTIL]: pop },
      time: 0,
    });
    expect(full.entries.p1.arrivals).toBeLessThan(half.entries.p1.arrivals);
    // Segment plein : seuls les partants du mois sont à prendre.
    expect(full.segments[OUTIL].free).toBeLessThan(pop * BASE_CHURN[OUTIL]);
  });

  it("krach : l'excédent part au prorata", () => {
    const step = stepAudience({
      entries: [entry({ users: pop })],
      diffuse: { [OUTIL]: pop },
      time: 0,
      confidence: { [OUTIL]: 0.5 },
    });
    // Population divisée par 4 par rapport aux utilisateurs : 3/4 partent.
    expect(step.entries.p1.departures).toBeGreaterThan(pop * 0.75);
    expect(
      step.entries.p1.users + step.segments[OUTIL].diffuse,
    ).toBeLessThanOrEqual(step.segments[OUTIL].population + 1e-6);
  });

  it("aucun segment ne compte plus d'utilisateurs que sa population, jamais de négatif", () => {
    let users = 0;
    let diffuse: number | undefined;
    for (let m = 0; m < 120; m++) {
      const step = stepAudience({
        entries: [entry({ users, appeal: K * 3 })],
        diffuse: diffuse === undefined ? {} : { [OUTIL]: diffuse },
        time: 0,
      });
      users = step.entries.p1.users;
      diffuse = step.segments[OUTIL].diffuse;
      expect(users).toBeGreaterThanOrEqual(0);
      expect(step.segments[OUTIL].free).toBeGreaterThanOrEqual(0);
      expect(users + diffuse).toBeLessThanOrEqual(pop + 1e-6);
    }
    // À long terme, une attractivité 3K garde ≈ 3/4 du segment occupé.
    expect(users / (users + diffuse!)).toBeCloseTo(0.75, 1);
  });

  it("un modèle récurrent bâtit sa base ; la vente encaisse tout de suite", () => {
    const sub = (users: number) =>
      entry({
        model: BusinessModel.ANNUAL_LICENSE,
        price: defaultPrice(BusinessModel.ANNUAL_LICENSE, OUTIL),
        users,
      });
    const first = stepAudience({ entries: [sub(0)], time: 0 });
    const sale = stepAudience({ entries: [entry()], time: 0 });
    expect(first.entries.p1.revenue).toBeLessThan(sale.entries.p1.revenue);
    expect(
      monthlyRevenue({
        model: BusinessModel.ANNUAL_LICENSE,
        genre: OUTIL,
        price: 650,
        users: 120,
        arrivals: 0,
      }),
    ).toBeCloseTo(6500);
  });
});
