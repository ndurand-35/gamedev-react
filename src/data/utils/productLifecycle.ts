import { Product, ProductStatus, isProductReady } from "@/data/interface";
import { removeComponents } from "@/data/redux/componentSlice";
import { addReputation, setMoney } from "@/data/redux/companySlice";
import { pushNotification } from "@/data/redux/notificationSlice";
import {
  addFeature,
  applyProductLifecycle,
  investInProduct,
  launchProduct,
  normalizeProducts,
  patchProduct,
  advancePromotions,
  startPromotion,
  stopPromotion,
} from "@/data/redux/productSlice";
import { AppDispatch, RootState } from "@/data/redux/store";
import { selectBestComponents } from "@/data/utils/component";
import {
  aggregateQaDetection,
  campaignEffectiveness,
  qaCancelProbability,
} from "@/data/utils/economy";
import {
  PROMOTION_COST,
  PROMOTION_DURATION_HOURS,
  busyMarketerIds,
  canPromote,
  popularityHype,
  popularityLabel,
  productPopularity,
} from "@/data/utils/popularity";
import {
  FEATURE_BY_ID,
  availableFeatures,
  featureRequirements,
} from "@/data/utils/feature";
import {
  PATCH_CODE_PER_BUG,
  computeProductRevenues,
  launchHype,
  launchReputationDelta,
  launchScore,
  rollProductBug,
} from "@/data/utils/product";
import { getTimeAsDate } from "@/data/utils/time";
import { formatPrice } from "@/data/utils";
import {
  COMPONENT_TYPE_ORDER,
  ComponentType,
  Marketing,
  PersonType,
  QA,
} from "@/data/interface";

// ─────────────────────────────────────────────────────────────────────────────
// Effets de la vie d'un produit : lancement (note, réputation, hype), mise à
// jour (composants consommés), tick mensuel (bugs). Les règles sont dans
// `utils/product.ts` ; ici on lit l'état, on décide, on dispatche.
// ─────────────────────────────────────────────────────────────────────────────

const formatScore = (score: number): string =>
  score.toFixed(1).replace(".", ",");

/**
 * Développement : verse dans le produit les meilleurs composants du stock qui
 * manquent encore, type par type. Partiel si le stock ne suit pas — ce qui
 * est là part, le reste attendra la prochaine production.
 */
export const investProductThunk =
  (productId: number) => (dispatch: AppDispatch, getState: () => RootState) => {
    const state = getState();
    const product = state.product.products.find((p) => p.id === productId);
    if (!product || product.status !== ProductStatus.DEVELOPING) return;

    const stock = state.component.stock;
    const requirements = COMPONENT_TYPE_ORDER.map((t) => ({
      type: t,
      quantity: Math.min(
        Math.max(0, product.requirements[t] - product.invested[t]),
        stock.filter((c) => c.type === t).length,
      ),
    })).filter((r) => r.quantity > 0);
    const selection = selectBestComponents(stock, requirements);
    if (selection.consumed.length === 0) {
      dispatch(
        pushNotification({
          message: "Aucun composant disponible pour investir.",
          type: "warning",
        }),
      );
      return;
    }
    dispatch(removeComponents(selection.consumed.map((c) => c.id)));
    dispatch(investInProduct({ productId, consumed: selection.consumed }));
    dispatch(
      pushNotification({
        message: `${selection.consumed.length} composant(s) investi(s) dans « ${product.name} ».`,
        type: "info",
      }),
    );
  };

/**
 * Sortie d'un produit complet : la hype vient de la popularité acquise avant
 * la sortie (promotion) ou d'une campagne Notoriété en cours — la plus forte
 * des deux. La note publique fait bouger la réputation, et le joueur apprend
 * d'un coup ce que le marché lui donne.
 */
export const launchProductThunk =
  (productId: number) => (dispatch: AppDispatch, getState: () => RootState) => {
    const state = getState();
    const product = state.product.products.find((p) => p.id === productId);
    if (!product || product.status !== ProductStatus.DEVELOPING) return;
    if (!isProductReady(product)) return;

    const time = state.engine.time;
    const hype = Math.max(
      launchHype(state.company.activeCampaign, time),
      popularityHype(product),
    );
    dispatch(launchProduct({ productId, time, hype }));

    const launched = getState().product.products.find(
      (p) => p.id === productId,
    );
    if (!launched) return;
    const score = launched.launchScore ?? launchScore(launched);
    const delta = launchReputationDelta(score);
    if (delta !== 0) dispatch(addReputation(delta));

    const revenue =
      computeProductRevenues(
        getState().product.products,
        time,
        state.company.activeCampaign,
        state.competitor?.products ?? [],
        state.product.confidence,
      )[productId] ?? 0;

    const reputation =
      delta > 0
        ? ` (+${delta} réputation)`
        : delta < 0
          ? ` (${delta} réputation)`
          : "";
    dispatch(
      pushNotification({
        message: `« ${launched.name} » lancé — note ${formatScore(score)}/10${reputation}. Revenu attendu ce mois : ${formatPrice(revenue)}.`,
        type: delta < 0 ? "warning" : "success",
      }),
    );
  };

const missingLabel = (
  missing: { type: ComponentType; quantity: number }[],
): string => missing.map((m) => `${m.quantity} ${m.type}`).join(", ");

/**
 * Ajoute une fonctionnalité à un produit lancé. Son coût est prélevé d'un
 * coup sur les meilleurs composants du stock — pas de fonctionnalité à
 * moitié livrée : s'il manque quelque chose, rien n'est consommé.
 */
export const addFeatureThunk =
  (productId: number, featureId: string) =>
  (dispatch: AppDispatch, getState: () => RootState) => {
    const state = getState();
    const product = state.product.products.find((p) => p.id === productId);
    if (!product || product.status !== ProductStatus.LAUNCHED) return;
    const feature = FEATURE_BY_ID[featureId];
    if (!feature) return;
    if (
      !availableFeatures(product, state.engine.time).some(
        (f) => f.id === featureId,
      )
    ) {
      return;
    }

    const selection = selectBestComponents(
      state.component.stock,
      featureRequirements(feature),
    );
    if (selection.missing.length > 0) {
      dispatch(
        pushNotification({
          message: `Stock insuffisant pour « ${feature.label} » : il manque ${missingLabel(selection.missing)}.`,
          type: "warning",
        }),
      );
      return;
    }

    dispatch(removeComponents(selection.consumed.map((c) => c.id)));
    dispatch(
      addFeature({
        productId,
        featureId,
        consumed: selection.consumed,
        time: state.engine.time,
      }),
    );
    const fixed = product.bugs ?? 0;
    dispatch(
      pushNotification({
        message:
          `« ${feature.label} » ajouté à « ${product.name} »` +
          (fixed > 0
            ? `, ${fixed} bug${fixed > 1 ? "s" : ""} corrigé${fixed > 1 ? "s" : ""}`
            : "") +
          ".",
        type: "success",
      }),
    );
  };

/**
 * Correctif : purge les bugs d'un produit lancé contre `PATCH_CODE_PER_BUG`
 * composants Code par bug. Sans assez de stock, rien n'est consommé.
 */
export const patchProductThunk =
  (productId: number) => (dispatch: AppDispatch, getState: () => RootState) => {
    const state = getState();
    const product = state.product.products.find((p) => p.id === productId);
    if (!product || product.status !== ProductStatus.LAUNCHED) return;
    const bugs = product.bugs ?? 0;
    if (bugs === 0) return;

    const selection = selectBestComponents(state.component.stock, [
      { type: ComponentType.CODE, quantity: bugs * PATCH_CODE_PER_BUG },
    ]);
    if (selection.missing.length > 0) {
      dispatch(
        pushNotification({
          message: `Correctif impossible : il manque ${missingLabel(selection.missing)}.`,
          type: "warning",
        }),
      );
      return;
    }

    dispatch(removeComponents(selection.consumed.map((c) => c.id)));
    dispatch(patchProduct(productId));
    dispatch(
      pushNotification({
        message: `« ${product.name} » corrigé : ${bugs} bug${bugs > 1 ? "s" : ""} purgé${bugs > 1 ? "s" : ""}.`,
        type: "success",
      }),
    );
  };

/**
 * Tick mensuel des produits, à la première heure du mois : chaque produit
 * lancé peut attraper un bug, que la QA intercepte une fois sur deux au mieux.
 * Une partie antérieure aux genres est d'abord remise au format courant.
 */
export const processProductLifecycle = (
  dispatch: AppDispatch,
  state: RootState,
) => {
  const time = state.engine.time;
  const date = getTimeAsDate(time);
  if (date.date() !== 1 || date.hour() !== 0) return;
  if (state.product.lastLifecycleTime === time) return;

  const products: Product[] = state.product.products;
  if (products.some((p) => p.genre === undefined || p.features === undefined)) {
    dispatch(normalizeProducts());
  }

  const testers = state.employe.employeList.filter(
    (e) => e.personType === PersonType.QA,
  ) as QA[];
  const cancel = qaCancelProbability(aggregateQaDetection(testers));

  const bugged: number[] = [];
  for (const p of products) {
    if (p.status !== ProductStatus.LAUNCHED) continue;
    if (rollProductBug(p, time, cancel, Math.random())) bugged.push(p.id);
  }

  // Tendances et confiance du public ont été mises à jour juste avant par
  // `processMarketTick` (cf. `utils/market`) : le bouche-à-oreille en tient
  // compte dès cette clôture-ci.
  dispatch(applyProductLifecycle({ time, bugged }));

  for (const id of bugged) {
    const p = products.find((x) => x.id === id);
    if (!p) continue;
    const total = (p.bugs ?? 0) + 1;
    dispatch(
      pushNotification({
        message: `Bug signalé sur « ${p.name} » (${total} en attente) : une mise à jour le corrigera.`,
        type: "warning",
      }),
    );
  }
};

// ── Promotions de produit ────────────────────────────────────────────────────

/**
 * Lance une promotion de 30 jours sur un produit, menée par un marketeur
 * précis. Refusée (rien n'est débité) si le produit est retiré ou déjà
 * promu, si le marketeur est déjà en campagne, ou si les fonds manquent.
 * Renvoie `true` si la promotion a démarré.
 */
export const startPromotionThunk =
  (productId: number, marketerId: number) =>
  (dispatch: AppDispatch, getState: () => RootState): boolean => {
    const state = getState();
    const time = state.engine.time;
    const product = state.product.products.find((p) => p.id === productId);
    const marketer = state.employe.employeList.find(
      (e) => e.id === marketerId && e.personType === PersonType.MARKETING,
    ) as Marketing | undefined;
    if (!product || !marketer || !canPromote(product, time)) return false;
    const busy = busyMarketerIds(
      state.product.products,
      state.company.activeCampaign,
      time,
    );
    if (busy.has(marketerId)) return false;
    if (state.company.money < PROMOTION_COST) {
      dispatch(
        pushNotification({
          message: `Fonds insuffisants pour promouvoir « ${product.name} » (${formatPrice(PROMOTION_COST)} €).`,
          type: "error",
        }),
      );
      return false;
    }

    dispatch(setMoney(state.company.money - PROMOTION_COST));
    dispatch(
      startPromotion({
        productId,
        marketerId,
        effectiveness: campaignEffectiveness(
          marketer.communicationStat,
          marketer.campaignManagementStat,
        ),
        time,
      }),
    );
    dispatch(
      pushNotification({
        message: `${marketer.firstName} ${marketer.lastName} lance la promotion de « ${product.name} » pour ${PROMOTION_DURATION_HOURS / 24} jours.`,
        type: "info",
      }),
    );
    return true;
  };

/**
 * Tick horaire des promotions : fait monter la popularité des produits
 * promus, clôt les promotions arrivées à terme et interrompt celles dont le
 * marketeur a quitté le studio (licenciement, démission).
 */
export const processPromotionTick = (
  dispatch: AppDispatch,
  state: RootState,
) => {
  const time = state.engine.time;
  const promoted = state.product.products.filter((p) => p.promotion);
  if (promoted.length === 0) return;

  const staff = new Set(state.employe.employeList.map((e) => e.id));
  for (const p of promoted) {
    const promo = p.promotion!;
    if (!staff.has(promo.marketerId)) {
      dispatch(stopPromotion(p.id));
      dispatch(
        pushNotification({
          message: `Promotion de « ${p.name} » interrompue : son marketeur a quitté le studio.`,
          type: "warning",
        }),
      );
      continue;
    }
    if (time >= promo.endTime) {
      const popularity = Math.round(productPopularity(p));
      dispatch(
        pushNotification({
          message: `Promotion de « ${p.name} » terminée : popularité ${popularity}/100 (${popularityLabel(popularity)}).`,
          type: "success",
        }),
      );
    }
  }
  dispatch(advancePromotions(time));
};
