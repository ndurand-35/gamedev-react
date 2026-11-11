import { CompetitorProduct } from "@/data/interface";
import { applyMarketTick } from "@/data/redux/competitorSlice";
import { pushNotification } from "@/data/redux/notificationSlice";
import { AppDispatch, RootState } from "@/data/redux/store";
import {
  expiredRivals,
  rivalsOf,
  rollRivalLaunch,
} from "@/data/utils/competitorProduct";
import { getTimeAsDate } from "@/data/utils/time";
import { trendingGenres } from "@/data/utils/trends";
import { PRODUCT_GENRE_ORDER, ProductStatus } from "@/data/interface";
import { segmentDemand } from "@/data/utils/marketDemand";
import { segmentAttraction } from "@/data/utils/competitorProduct";

/**
 * Tick mensuel du marché, à la première heure du mois : les produits
 * concurrents en fin de vie se retirent, puis chaque studio tente sa chance.
 * Les lancements sont annoncés — c'est le signal qu'un segment se resserre.
 */
export const processCompetitorMarket = (
  dispatch: AppDispatch,
  state: RootState,
) => {
  const time = state.engine.time;
  const date = getTimeAsDate(time);
  if (date.date() !== 1 || date.hour() !== 0) return;
  if (state.competitor.lastMarketTime === time) return;

  const rivals: CompetitorProduct[] = state.competitor.products ?? [];
  const retired = expiredRivals(rivals, time);
  const retiredIds = new Set(retired.map((r) => r.id));
  const alive = rivals.filter((r) => !retiredIds.has(r.id));
  const clients = state.task.clients ?? {};

  // Les studios suivent l'argent : demande réelle du segment (technologies et
  // confiance du public) par produit déjà présent, les nôtres compris.
  const genreWeights = Object.fromEntries(
    PRODUCT_GENRE_ORDER.map((g) => {
      const present =
        alive.filter((r) => r.genre === g).length +
        state.product.products.filter(
          (p) => p.genre === g && p.status === ProductStatus.LAUNCHED,
        ).length;
      return [
        g,
        segmentAttraction(
          segmentDemand(g, time, state.product.confidence),
          present,
        ),
      ];
    }),
  );

  const launched: Omit<CompetitorProduct, "id">[] = [];
  for (const competitor of state.competitor.roster) {
    const launch = rollRivalLaunch({
      competitor,
      client: clients[competitor.id],
      ourProducts: state.product.products,
      reputation: state.company.reputation,
      time,
      activeCount: rivalsOf(alive, competitor.id).length,
      trendingGenres: trendingGenres(state.product.trends ?? []),
      genreWeights,
    });
    if (launch) launched.push(launch);
  }

  dispatch(
    applyMarketTick({ time, launched, retired: retired.map((r) => r.id) }),
  );

  const byId = new Map(state.competitor.roster.map((c) => [c.id, c.name]));
  for (const launch of launched) {
    dispatch(
      pushNotification({
        message: `${byId.get(launch.competitorId) ?? "Un studio"} lance « ${launch.name} » (${launch.genre}).`,
        type: "info",
      }),
    );
  }
};
