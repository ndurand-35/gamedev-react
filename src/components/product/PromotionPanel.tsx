import { FC, useState } from "react";
import { Link } from "react-router-dom";
import { Megaphone } from "iconoir-react";

import { Product, ProductStatus } from "@/data/interface";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { selectMarketers } from "@/data/redux/selectors";
import { formatPrice } from "@/data/utils";
import { campaignEffectiveness } from "@/data/utils/economy";
import {
  POPULARITY_MAX,
  PROMOTION_COST,
  PROMOTION_DURATION_HOURS,
  busyMarketerIds,
  canPromote,
  isPromotionActive,
  popularityLabel,
  popularityProfile,
  productPopularity,
} from "@/data/utils/popularity";
import { startPromotionThunk } from "@/data/utils/productLifecycle";
import { useTrends } from "@/data/hooks/useTrends";
import { productTrends, trendLabel } from "@/data/utils/trends";
import { TrendBadge } from "@/components/product/Trends";

/**
 * Popularité d'un produit et sa promotion : la jauge, la campagne en cours,
 * ou le choix du marketeur qui la mènera. La règle est dite en clair ; le
 * gain attendu, lui, n'est pas calculé à la place du joueur.
 */
export const PromotionPanel: FC<{ product: Product }> = ({ product: p }) => {
  const dispatch = useAppDispatch();
  const time = useAppSelector((s) => s.engine.time);
  const money = useAppSelector((s) => s.company.money);
  const products = useAppSelector((s) => s.product.products);
  const campaign = useAppSelector((s) => s.company.activeCampaign);
  const marketers = useAppSelector(selectMarketers);
  const [chosenId, setChosenId] = useState<number | null>(null);
  const touching = productTrends(p, useTrends());

  const popularity = productPopularity(p);
  const rounded = Math.round(popularity);
  const promoting = isPromotionActive(p, time);
  const busy = busyMarketerIds(products, campaign, time);
  const free = marketers.filter((m) => !busy.has(m.id));
  const chosen =
    free.find((m) => m.id === chosenId) ?? free[0] ?? undefined;
  const promoter = promoting
    ? marketers.find((m) => m.id === p.promotion?.marketerId)
    : undefined;
  const retired = p.status === ProductStatus.RETIRED;

  const daysLeft = p.promotion
    ? Math.ceil(Math.max(0, p.promotion.endTime - time) / 24)
    : 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-row items-center justify-between gap-2 text-xs">
        <span className="inline-flex items-center gap-1 font-medium">
          <Megaphone width={14} height={14} /> Popularité
        </span>
        <span className="tabular-nums">
          <span className="font-semibold">{rounded}</span>/{POPULARITY_MAX} ·{" "}
          {popularityLabel(popularity)}
        </span>
      </div>
      <progress
        className="progress progress-warning h-2 w-full"
        value={popularity}
        max={POPULARITY_MAX}
        aria-label={`Popularité ${rounded} sur ${POPULARITY_MAX}`}
      />

      {touching.length > 0 && (
        <ul className="space-y-1 text-[11px]">
          {touching.map((t) => (
            <li key={`promo_trend_${t.id}`} className="flex flex-row items-center gap-2">
              <TrendBadge direction={t.direction} />
              <span className="opacity-70">
                {trendLabel(t)} :{" "}
                {t.direction === "up"
                  ? "le bouche-à-oreille et la publicité portent plus loin."
                  : "le bouche-à-oreille et la publicité portent moins loin."}
              </span>
            </li>
          ))}
        </ul>
      )}

      {promoting && p.promotion ? (
        <div className="space-y-1 rounded-lg border border-warning/50 bg-warning/5 p-2 text-xs">
          <p>
            <span className="font-medium">Promotion en cours</span>
            {promoter
              ? ` — menée par ${promoter.firstName} ${promoter.lastName}`
              : ""}
            , encore {daysLeft} jour{daysLeft > 1 ? "s" : ""}.
          </p>
          <progress
            className="progress progress-warning h-1 w-full"
            value={time - p.promotion.startTime}
            max={p.promotion.endTime - p.promotion.startTime}
            aria-label="Avancement de la promotion"
          />
        </div>
      ) : retired ? null : marketers.length === 0 ? (
        <p className="text-xs opacity-70">
          Aucun marketeur au studio :{" "}
          <Link to="/game/employe/recruit" className="link">
            recrutez un profil Marketing
          </Link>{" "}
          pour promouvoir vos produits.
        </p>
      ) : free.length === 0 ? (
        <p className="text-xs opacity-70">
          Tous vos marketeurs mènent déjà une campagne : un marketeur ne gère
          qu'une campagne à la fois.
        </p>
      ) : (
        <div className="flex flex-row flex-wrap items-center gap-2">
          <select
            className="select select-sm select-bordered min-w-0 flex-1"
            value={chosen?.id ?? ""}
            onChange={(e) => setChosenId(Number(e.target.value))}
            aria-label="Marketeur qui mènera la promotion"
          >
            {free.map((m) => (
              <option key={m.id} value={m.id}>
                {m.firstName} {m.lastName} — efficacité{" "}
                {Math.round(
                  campaignEffectiveness(
                    m.communicationStat,
                    m.campaignManagementStat,
                  ) * 100,
                )}{" "}
                %
              </option>
            ))}
          </select>
          <div
            className={money < PROMOTION_COST ? "tooltip" : ""}
            data-tip={money < PROMOTION_COST ? "Fonds insuffisants" : undefined}
          >
            <button
              type="button"
              className="btn btn-sm btn-warning"
              disabled={!chosen || money < PROMOTION_COST || !canPromote(p, time)}
              onClick={() => chosen && dispatch(startPromotionThunk(p.id, chosen.id))}
            >
              <Megaphone width={16} height={16} />
              Promouvoir · −{formatPrice(PROMOTION_COST)} €
            </button>
          </div>
        </div>
      )}

      {!retired && (
        // Les règles, dites en clair ; le niveau naturel du produit, lui,
        // n'est pas affiché — le joueur le devine à sa note et à ses bugs.
        <div className="space-y-1 text-[11px] opacity-60">
          <p>
            <span className="font-medium">{p.genre} :</span>{" "}
            {popularityProfile(p.genre).hint}
          </p>
          <p>
            Une promotion dure {PROMOTION_DURATION_HOURS / 24} jours et monte
            d'autant plus vite que le marketeur est bon et que le produit est
            peu connu. Sans promotion, la popularité revient chaque mois vers
            ce que le produit vaut aux yeux du public : sa qualité, sa taille,
            et ses bugs non corrigés.
            {p.status === ProductStatus.DEVELOPING &&
              " Pas encore sorti, il n'a personne pour en parler : sa popularité retombe sans promotion — mais promu avant sa sortie, il arrive avec un pic de lancement plus fort."}
          </p>
        </div>
      )}
    </div>
  );
};
