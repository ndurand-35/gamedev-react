import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

import {
  ConsumedComponent,
  Product,
  COMPONENT_KIND_BY_ID,
  TIER_FINISH,
  kindValue,
  recipeEntries,
  ProductGenre,
  ProductStatus,
  isProductReady,
  productSize,
} from "@/data/interface";
import {
  FEATURE_BY_ID,
  featureCost,
  featureFits,
  featuresRequirements,
  isAssemblyUnlocked,
  isValidAssembly,
} from "@/data/utils/feature";
import { isFeatureUnlocked } from "@/data/utils/technology";
import {
  launchScore,
  naturalPopularity,
  normalizeProduct,
  updateRewindHours,
} from "@/data/utils/product";
import { MarketTrend, trendReachFactor } from "@/data/utils/trends";
import {
  AD_PRESSURE_REFERENCE,
  BusinessModel,
  availableModels,
  clampAdPressure,
  defaultPrice,
  leverShock,
  modelDef,
  modelsForGenre,
} from "@/data/utils/businessModel";
import { AUDIENCE_HISTORY_MONTHS, EntryResult } from "@/data/utils/audience";
import type { MarketConfidence } from "@/data/utils/marketDemand";
import {
  PROMOTION_DURATION_HOURS,
  driftedPopularity,
  isPromotionActive,
  popularityAfterPromotion,
  popularityProfile,
} from "@/data/utils/popularity";

export interface ProductState {
  products: Product[];
  nextProductId: number;
  // Compteur cumulé de produits lancés (stat de l'écran de bilan WF-3).
  productsLaunched: number;
  /** Dernier tick mensuel de vie des produits (bugs) : garde anti-doublon. */
  lastLifecycleTime: number | null;
  /**
   * Tendances du marché en cours (cf. `utils/trends`). Absentes d'une partie
   * antérieure : lues comme une liste vide.
   */
  trends?: MarketTrend[];
  nextTrendId?: number;
  /**
   * Confiance du public par segment (cf. `utils/marketConfidence`). Absente
   * d'une partie antérieure : pleine confiance partout.
   */
  confidence?: MarketConfidence;
  /** Dernier tick mensuel du marché : garde anti-doublon. */
  lastMarketTime?: number | null;
  /**
   * Utilisateurs de la concurrence diffuse par segment (cf. `utils/audience`).
   * Absents en début de partie : le moteur part de l'équilibre.
   */
  diffuseUsers?: Partial<Record<ProductGenre, number>>;
  /** Dernière clôture d'audience : garde anti-doublon (clôture rejouée). */
  lastAudienceTime?: number | null;
}

const initialState: ProductState = {
  products: [],
  nextProductId: 1,
  productsLaunched: 0,
  lastLifecycleTime: null,
  trends: [],
  nextTrendId: 1,
  confidence: {},
  lastMarketTime: null,
  diffuseUsers: {},
  lastAudienceTime: null,
};

/** Départs ponctuels cumulés : 1 − (1 − a)(1 − b). */
const combineShocks = (a = 0, b = 0): number => 1 - (1 - a) * (1 - b);

/**
 * Verse des pièces dans un produit : elles comptent dans son avancement, et
 * leur finition (selon le niveau, pondérée par leur valeur) dans la sienne.
 */
const absorb = (p: Product, consumed: ConsumedComponent[]) => {
  for (const c of consumed) {
    p.invested[c.kind] = (p.invested[c.kind] ?? 0) + 1;
    const value = kindValue(c.kind);
    p.qualitySum += TIER_FINISH[COMPONENT_KIND_BY_ID[c.kind].tier] * value;
    p.qualityCount += value;
  }
};

export const productSlice = createSlice({
  name: "product",
  initialState,
  reducers: {
    initializeProductState(state) {
      state.products = [];
      state.nextProductId = 1;
      state.productsLaunched = 0;
      state.lastLifecycleTime = null;
      state.trends = [];
      state.nextTrendId = 1;
      state.confidence = {};
      state.lastMarketTime = null;
      state.diffuseUsers = {};
      state.lastAudienceTime = null;
    },
    /** État du marché après le tick mensuel (cf. `utils/market`). */
    setMarketState(
      state,
      action: PayloadAction<{
        time: number;
        trends: MarketTrend[];
        nextTrendId: number;
        confidence: MarketConfidence;
      }>,
    ) {
      state.lastMarketTime = action.payload.time;
      state.trends = action.payload.trends;
      state.nextTrendId = action.payload.nextTrendId;
      state.confidence = action.payload.confidence;
    },
    /** Tendances après le tirage mensuel (cf. `rollTrends`). */
    setTrends(
      state,
      action: PayloadAction<{ trends: MarketTrend[]; nextTrendId: number }>,
    ) {
      state.trends = action.payload.trends;
      state.nextTrendId = action.payload.nextTrendId;
    },
    // Un produit naît d'un assemblage : le socle du genre et ce qu'on y
    // ajoute. Les besoins en composants en découlent ; un assemblage bancal
    // (socle absent, doublon, id inconnu) est ignoré.
    createProduct(
      state,
      action: PayloadAction<{
        name: string;
        genre: ProductGenre;
        features: string[];
        /** Heure de jeu : refuse une fonctionnalité pas encore inventée. */
        time?: number;
        /** Modèle économique ; vente unitaire par défaut. */
        model?: BusinessModel;
        /** Prix (€) ; la référence par défaut. */
        price?: number;
        /** Pression publicitaire 1–5 (publicité). */
        adPressure?: number;
      }>,
    ) {
      const { name, genre, features, time } = action.payload;
      if (!isValidAssembly(genre, features)) return;
      if (time !== undefined && !isAssemblyUnlocked(features, time)) return;
      const model = action.payload.model ?? BusinessModel.SALE;
      const allowed =
        time !== undefined ? availableModels(genre, time) : modelsForGenre(genre);
      if (!allowed.includes(model)) return;
      const price = Math.max(0, action.payload.price ?? defaultPrice(model, genre));
      state.products.push({
        id: state.nextProductId++,
        name,
        status: ProductStatus.DEVELOPING,
        genre,
        features: [...features],
        requirements: featuresRequirements(features),
        invested: {},
        qualitySum: 0,
        qualityCount: 0,
        bugs: 0,
        hype: 0,
        updates: 0,
        popularity: 0,
        model,
        price,
        adPressure:
          modelDef(model).lever === "adPressure"
            ? clampAdPressure(action.payload.adPressure ?? AD_PRESSURE_REFERENCE)
            : undefined,
        users: 0,
        usersHistory: [],
      });
    },
    /**
     * Nouveau prix. Sur un produit lancé, une hausse d'un modèle récurrent
     * provoque un départ ponctuel à la prochaine clôture.
     */
    setProductPrice(
      state,
      action: PayloadAction<{ productId: number; price: number }>,
    ) {
      const p = state.products.find((p) => p.id === action.payload.productId);
      if (!p || p.status === ProductStatus.RETIRED) return;
      if (modelDef(p.model).lever !== "price") return;
      const price = Math.max(0, action.payload.price);
      if (p.status === ProductStatus.LAUNCHED) {
        p.pendingShock = combineShocks(
          p.pendingShock,
          leverShock(p.model, p.genre, p.price, price),
        );
      }
      p.price = price;
    },
    /** Nouvelle pression publicitaire ; une hausse provoque un départ ponctuel. */
    setAdPressure(
      state,
      action: PayloadAction<{ productId: number; level: number }>,
    ) {
      const p = state.products.find((p) => p.id === action.payload.productId);
      if (!p || p.status === ProductStatus.RETIRED) return;
      if (modelDef(p.model).lever !== "adPressure") return;
      const level = clampAdPressure(action.payload.level);
      const before = p.adPressure ?? AD_PRESSURE_REFERENCE;
      if (p.status === ProductStatus.LAUNCHED) {
        p.pendingShock = combineShocks(
          p.pendingShock,
          leverShock(p.model, p.genre, before, level),
        );
      }
      p.adPressure = level;
    },
    /**
     * Clôture d'audience du mois (cf. `stepMarketAudience`) : utilisateurs,
     * bilan du mois dans l'historique, concurrence diffuse. Idempotente.
     */
    applyAudienceStep(
      state,
      action: PayloadAction<{
        time: number;
        products: Record<number, EntryResult>;
        diffuse: Partial<Record<ProductGenre, number>>;
      }>,
    ) {
      const { time, products, diffuse } = action.payload;
      if (state.lastAudienceTime === time) return;
      state.lastAudienceTime = time;
      state.diffuseUsers = { ...diffuse };
      for (const p of state.products) {
        const r = products[p.id];
        if (!r || p.status !== ProductStatus.LAUNCHED) continue;
        p.users = r.users;
        p.pendingShock = undefined;
        const history = [...(p.usersHistory ?? [])];
        history.push({
          time,
          users: r.users,
          arrivals: r.arrivals,
          departures: r.departures,
          revenue: Math.round(r.revenue),
        });
        p.usersHistory = history.slice(-AUDIENCE_HISTORY_MONTHS);
      }
    },
    investInProduct(
      state,
      action: PayloadAction<{
        productId: number;
        consumed: ConsumedComponent[];
      }>,
    ) {
      const p = state.products.find((p) => p.id === action.payload.productId);
      if (!p) return;
      if (p.status !== ProductStatus.DEVELOPING) return;
      absorb(p, action.payload.consumed);
    },
    // Validation (produit complet), hype et réputation : thunk
    // `launchProductThunk`. Ici on ne fait que figer l'état de sortie.
    launchProduct(
      state,
      action: PayloadAction<{ productId: number; time: number; hype: number }>,
    ) {
      const p = state.products.find((p) => p.id === action.payload.productId);
      if (!p) return;
      if (!isProductReady(p)) return;
      p.status = ProductStatus.LAUNCHED;
      p.launchTime = action.payload.time;
      p.freshAt = action.payload.time;
      p.hype = Math.max(0, Math.min(1, action.payload.hype));
      p.launchScore = launchScore(p);
      p.bugs = 0;
      state.productsLaunched += 1;
    },
    /**
     * Mise à jour d'un produit lancé : une fonctionnalité de plus. Ses
     * composants grossissent le produit et pèsent dans sa qualité moyenne, les
     * bugs connus sont corrigés au passage, et l'ancre de fraîcheur avance au
     * prorata de la taille ajoutée — sans jamais dépasser le présent. Le
     * stock est débité par le thunk `addFeatureThunk`.
     */
    addFeature(
      state,
      action: PayloadAction<{
        productId: number;
        featureId: string;
        consumed: ConsumedComponent[];
        time: number;
      }>,
    ) {
      const p = state.products.find((p) => p.id === action.payload.productId);
      if (!p) return;
      if (p.status !== ProductStatus.LAUNCHED) return;
      const feature = FEATURE_BY_ID[action.payload.featureId];
      if (!feature || feature.coreOf !== undefined) return;
      if (!featureFits(feature, p.genre)) return;
      if (!isFeatureUnlocked(feature.id, action.payload.time)) return;
      if (!p.features) p.features = [];
      if (p.features.includes(feature.id)) return;
      const sizeBefore = productSize(p);
      p.features.push(feature.id);
      for (const [kind, q] of recipeEntries(feature.cost)) {
        p.requirements[kind] = (p.requirements[kind] ?? 0) + q;
      }
      absorb(p, action.payload.consumed);
      const anchor = p.freshAt ?? p.launchTime ?? action.payload.time;
      p.freshAt = Math.min(
        action.payload.time,
        anchor + updateRewindHours(sizeBefore, featureCost(feature)),
      );
      p.bugs = 0;
      p.updates = (p.updates ?? 0) + 1;
    },
    /** Correctif : les bugs connus sont purgés, rien d'autre ne bouge. */
    patchProduct(state, action: PayloadAction<number>) {
      const p = state.products.find((p) => p.id === action.payload);
      if (!p || p.status !== ProductStatus.LAUNCHED) return;
      p.bugs = 0;
    },
    /**
     * Tick mensuel : bugs apparus ce mois-ci, par produit, puis bouche-à-
     * oreille — la popularité des produits qu'aucune promotion ne soutient se
     * rapproche de leur niveau naturel (bugs du mois compris).
     */
    applyProductLifecycle(
      state,
      action: PayloadAction<{ time: number; bugged: number[] }>,
    ) {
      state.lastLifecycleTime = action.payload.time;
      for (const id of action.payload.bugged) {
        const p = state.products.find((p) => p.id === id);
        if (!p || p.status !== ProductStatus.LAUNCHED) continue;
        p.bugs = (p.bugs ?? 0) + 1;
      }
      for (const p of state.products) {
        if (p.status === ProductStatus.RETIRED) continue;
        if (isPromotionActive(p, action.payload.time)) continue;
        p.popularity = driftedPopularity(
          p.popularity ?? 0,
          naturalPopularity(p, state.trends ?? []),
          p.genre,
        );
      }
    },
    // Validation (argent, marketeur libre) et débit : thunk
    // `startPromotionThunk`. Ici on ne fait qu'enregistrer la promotion.
    startPromotion(
      state,
      action: PayloadAction<{
        productId: number;
        marketerId: number;
        effectiveness: number;
        time: number;
      }>,
    ) {
      const { productId, marketerId, effectiveness, time } = action.payload;
      const p = state.products.find((p) => p.id === productId);
      if (!p || p.status === ProductStatus.RETIRED) return;
      if (isPromotionActive(p, time)) return;
      p.promotion = {
        marketerId,
        effectiveness: Math.max(0, Math.min(1, effectiveness)),
        startTime: time,
        endTime: time + PROMOTION_DURATION_HOURS,
      };
    },
    /**
     * Une heure de jeu : chaque promotion en cours fait monter la popularité
     * de son produit ; une promotion arrivée à terme est close.
     */
    advancePromotions(state, action: PayloadAction<number>) {
      const time = action.payload;
      for (const p of state.products) {
        if (!p.promotion) continue;
        if (time >= p.promotion.endTime || p.status === ProductStatus.RETIRED) {
          p.promotion = undefined;
          continue;
        }
        // La portée de la publicité dépend du segment (cf. profils) et des
        // tendances qui touchent le produit.
        p.popularity = popularityAfterPromotion(
          p.popularity ?? 0,
          p.promotion.effectiveness,
          1,
          popularityProfile(p.genre).promotionReach *
            trendReachFactor(p, state.trends ?? []),
        );
      }
    },
    /** Interrompt la promotion d'un produit (marketeur parti, abandon). */
    stopPromotion(state, action: PayloadAction<number>) {
      const p = state.products.find((p) => p.id === action.payload);
      if (p) p.promotion = undefined;
    },
    /** Produits d'une partie antérieure aux genres : remis au format courant. */
    normalizeProducts(state) {
      state.products = state.products.map(normalizeProduct);
    },
    retireProduct(state, action: PayloadAction<number>) {
      const p = state.products.find((p) => p.id === action.payload);
      if (!p) return;
      p.status = ProductStatus.RETIRED;
      // Le marketeur qui le soutenait est libéré.
      p.promotion = undefined;
      // Ses utilisateurs redeviennent libres.
      p.users = 0;
      p.pendingShock = undefined;
    },
  },
});

export const {
  initializeProductState,
  createProduct,
  investInProduct,
  launchProduct,
  addFeature,
  patchProduct,
  applyProductLifecycle,
  setTrends,
  setMarketState,
  startPromotion,
  advancePromotions,
  stopPromotion,
  normalizeProducts,
  retireProduct,
  setProductPrice,
  setAdPressure,
  applyAudienceStep,
} = productSlice.actions;

export default productSlice.reducer;
