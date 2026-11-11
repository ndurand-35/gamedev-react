import { PRODUCT_GENRE_ORDER } from "@/data/interface";
import { raiseExpectedSalaries } from "@/data/redux/employeSlice";
import { pushNotification } from "@/data/redux/notificationSlice";
import { setMarketState } from "@/data/redux/productSlice";
import type { AppDispatch, RootState } from "@/data/redux/store";
import { FEATURE_BY_ID } from "@/data/utils/feature";
import {
  CONFIDENCE_RECOVERED,
  CONFIDENCE_WARNING,
  computeMarketConfidence,
} from "@/data/utils/marketConfidence";
import {
  formatDemandChange,
  segmentConfidence,
  yearReview,
} from "@/data/utils/marketDemand";
import {
  monthlyTechnologyEvents,
  techSalaryIndex,
} from "@/data/utils/technology";
import { addMonthsToTime, getTimeAsDate } from "@/data/utils/time";
import { rollTrends, trendLabel } from "@/data/utils/trends";

// ── Tick mensuel du marché ───────────────────────────────────────────────────
// Le 1er de chaque mois, avant la vie des produits (bouche-à-oreille) :
//   1. les technologies apparues ce mois-ci sont annoncées ;
//   2. les tendances avancent (celles des technologies, puis les engouements) ;
//   3. la confiance du public dans chaque segment est recalculée d'après les
//      sorties des 12 derniers mois — c'est ce qui fait les krachs ;
//   4. le 1er janvier : bilan de l'année, et les salaires du marché suivent
//      les technologies (les employés attendent davantage).
// Le journal ne dit que ce qui est arrivé, jamais ce qui va arriver.

/** En dessous de cette hausse annuelle, on ne parle pas des salaires. */
const SALARY_NOTICE_THRESHOLD = 0.005;

export const processMarketTick = (dispatch: AppDispatch, state: RootState) => {
  const time = state.engine.time;
  const date = getTimeAsDate(time);
  if (date.date() !== 1 || date.hour() !== 0) return;
  if (state.product.lastMarketTime === time) return;

  // 1. Technologies du mois.
  const events = monthlyTechnologyEvents(time);
  for (const tech of events.arrivals) {
    const features = tech.unlocks
      .map((id) => FEATURE_BY_ID[id]?.label)
      .filter(Boolean)
      .join(", ");
    dispatch(
      pushNotification({
        message: `${tech.year} — ${tech.name} : ${tech.headline}${
          features ? ` Nouvelles fonctionnalités : ${features}.` : ""
        }`,
        type: "success",
      }),
    );
  }

  // 2. Tendances.
  const roll = rollTrends(
    state.product.trends ?? [],
    time,
    state.product.nextTrendId ?? 1,
    Math.random,
    events,
  );
  for (const t of roll.ended) {
    dispatch(
      pushNotification({
        message: `Fin de tendance — ${trendLabel(t)} : c'est terminé.`,
        type: "info",
      }),
    );
  }
  for (const t of roll.started) {
    dispatch(
      pushNotification({
        message: `Tendance : ${trendLabel(t)}.`,
        type: t.direction === "up" ? "success" : "warning",
      }),
    );
  }

  // 3. Confiance du public.
  const before = state.product.confidence;
  const confidence = computeMarketConfidence(
    before,
    state.product.products,
    state.competitor?.products ?? [],
    time,
  );
  for (const genre of PRODUCT_GENRE_ORDER) {
    const was = segmentConfidence(genre, before);
    const now = confidence[genre];
    if (was >= CONFIDENCE_WARNING && now < CONFIDENCE_WARNING) {
      dispatch(
        pushNotification({
          message: `Krach sur le segment ${genre} : trop de sorties médiocres, le public se méfie et la demande chute.`,
          type: "error",
        }),
      );
    } else if (was < CONFIDENCE_RECOVERED && now >= CONFIDENCE_RECOVERED) {
      dispatch(
        pushNotification({
          message: `Le segment ${genre} a retrouvé la confiance du public.`,
          type: "success",
        }),
      );
    }
  }

  dispatch(
    setMarketState({
      time,
      trends: roll.active,
      nextTrendId: roll.nextId,
      confidence,
    }),
  );

  // 4. Le 1er janvier : bilan et salaires.
  if (date.month() === 0 && time > 0) {
    const review = yearReview(time);
    dispatch(
      pushNotification({
        message: `Marché ${review.year}, potentiel sur un an : ${review.changes
          .map((c) => `${c.genre} ${formatDemandChange(c.change)}`)
          .join(", ")}.`,
        type: "info",
      }),
    );

    const ratio =
      techSalaryIndex(time) / techSalaryIndex(addMonthsToTime(time, -12));
    if (ratio - 1 >= SALARY_NOTICE_THRESHOLD) {
      dispatch(raiseExpectedSalaries(ratio));
      dispatch(
        pushNotification({
          message: `Les salaires du marché ont augmenté de ${Math.round(
            (ratio - 1) * 100,
          )} % : vos employés attendent davantage, et leur moral baisse si leur salaire reste en dessous.`,
          type: "warning",
        }),
      );
    }
  }
};
