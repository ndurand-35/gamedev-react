import { FC, useState } from "react";
import { Megaphone, WarningTriangle } from "iconoir-react";

import {
  ActiveCampaign,
  CAMPAIGNS,
  CampaignType,
  campaignEffectiveness,
} from "@/data/utils/economy";
import { launchCampaign } from "@/data/redux/companySlice";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { selectActiveCampaign, selectMarketers } from "@/data/redux/selectors";
import { formatPrice } from "@/data/utils";
import { busyMarketerIds } from "@/data/utils/popularity";
import { Marketing } from "@/data/interface";
import { CodexLink } from "@/components/codex/CodexLink";

export const CAMPAIGN_PANEL_ID = "campaign_panel";

const CAMPAIGN_ORDER: CampaignType[] = [
  CampaignType.NOTORIETY,
  CampaignType.ACQUISITION,
  CampaignType.RETENTION,
];

const CampaignProgress: FC<{ campaign: ActiveCampaign; time: number }> = ({
  campaign,
  time,
}) => {
  const total = campaign.endTime - campaign.startTime;
  const elapsed = Math.min(total, Math.max(0, time - campaign.startTime));
  const remainingDays = Math.ceil((total - elapsed) / 24);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-sm font-bold">
        <span className="font-display font-semibold">{campaign.type}</span>
        <span className="text-base-content/70 tabular-nums">
          {remainingDays} j restants
        </span>
      </div>
      <progress className="progress h-2 w-full" value={elapsed} max={total} />
    </div>
  );
};

export const CampaignPanel: FC = () => {
  const dispatch = useAppDispatch();
  const money = useAppSelector((s) => s.company.money);
  const time = useAppSelector((s) => s.engine.time);
  const activeCampaign = useAppSelector(selectActiveCampaign);
  const products = useAppSelector((s) => s.product.products);
  const marketers = useAppSelector(selectMarketers);
  // Un marketeur ne mène qu'une campagne à la fois : ceux qui promeuvent un
  // produit ne sont pas disponibles pour la campagne du studio. Parmi les
  // libres, le plus efficace la prend en charge.
  const busy = busyMarketerIds(products, activeCampaign, time);
  const effectivenessOf = (m: Marketing) =>
    campaignEffectiveness(m.communicationStat, m.campaignManagementStat);
  const bestMarketer = marketers
    .filter((m) => !busy.has(m.id))
    .reduce<
      Marketing | undefined
    >((best, m) => (!best || effectivenessOf(m) > effectivenessOf(best) ? m : best), undefined);
  const runner = activeCampaign?.marketerId
    ? marketers.find((m) => m.id === activeCampaign.marketerId)
    : undefined;

  const [selected, setSelected] = useState<CampaignType>(
    CampaignType.NOTORIETY,
  );

  const effectiveness = bestMarketer ? effectivenessOf(bestMarketer) : 0;

  const def = CAMPAIGNS[selected];
  const insufficientFunds = money < def.cost;
  const noMarketer = !bestMarketer;
  const campaignRunning = !!activeCampaign;
  const launchDisabled = insufficientFunds || noMarketer || campaignRunning;

  const launch = () => {
    if (launchDisabled || !bestMarketer) return;
    dispatch(
      launchCampaign({
        type: selected,
        effectiveness,
        time,
        marketerId: bestMarketer.id,
      }),
    );
  };

  return (
    <dialog
      id={CAMPAIGN_PANEL_ID}
      className="modal"
      role="dialog"
      aria-label="Campagne marketing"
    >
      <div className="modal-box max-w-md p-0">
        <div className="flex items-center gap-2.5 border-b-[3px] border-ink bg-white px-6 py-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border-[2.5px] border-ink bg-role-marketing">
            <Megaphone width={17} height={17} strokeWidth={2.4} />
          </span>
          <h3 className="font-display text-xl font-bold">Campagne marketing</h3>
          <CodexLink id="marketing" />
        </div>

        {campaignRunning && activeCampaign ? (
          <div className="flex flex-col gap-3 px-6 py-5">
            <p className="text-sm font-semibold text-base-content/70">
              Campagne en cours
              {runner
                ? `, menée par ${runner.firstName} ${runner.lastName}`
                : ""}{" "}
              :
            </p>
            <div className="toy-tile px-4 py-3">
              <CampaignProgress campaign={activeCampaign} time={time} />
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4 px-6 py-5">
              {noMarketer && (
                <p className="flex items-center gap-2 text-sm font-bold">
                  <WarningTriangle
                    width={16}
                    height={16}
                    className="shrink-0 text-error"
                  />
                  {marketers.length === 0
                    ? "Aucun marketeur recruté : embauchez un profil Marketing pour lancer une campagne."
                    : "Tous vos marketeurs promeuvent déjà un produit."}
                </p>
              )}
              <div className="flex flex-col gap-2">
                {CAMPAIGN_ORDER.map((type) => {
                  const c = CAMPAIGNS[type];
                  return (
                    <label
                      key={type}
                      className="toy-tile flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-[#fffcf5] has-checked:bg-[#fff0c2]"
                    >
                      <input
                        type="radio"
                        name="campaign_type"
                        className="radio radio-sm mt-0.5"
                        checked={selected === type}
                        onChange={() => setSelected(type)}
                      />
                      <div className="flex-1">
                        <div className="flex justify-between gap-2">
                          <span className="font-extrabold">{c.label}</span>
                          <span className="text-sm font-bold tabular-nums">
                            {formatPrice(c.cost)} €
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-base-content/60">
                          {c.description}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="flex flex-col gap-0.5 text-xs font-semibold text-base-content/70">
                <div>
                  {bestMarketer ? (
                    <>
                      Efficacité estimée (d'après {bestMarketer.firstName}{" "}
                      {bestMarketer.lastName}) :{" "}
                      <span className="font-extrabold text-base-content tabular-nums">
                        {Math.round(effectiveness * 100)}%
                      </span>
                    </>
                  ) : (
                    "Efficacité indisponible (aucun marketeur)."
                  )}
                </div>
                <div>Durée : 30 jours.</div>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t-[3px] border-ink bg-white px-6 py-4">
              <form method="dialog">
                <button
                  type="submit"
                  className="btn btn-ghost underline underline-offset-4"
                >
                  Annuler
                </button>
              </form>
              <div
                className={"ml-auto " + (insufficientFunds ? "tooltip" : "")}
                data-tip={
                  insufficientFunds ? "Trésorerie insuffisante" : undefined
                }
              >
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={launchDisabled}
                  onClick={launch}
                >
                  Lancer · {formatPrice(def.cost)} €
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit">close</button>
      </form>
    </dialog>
  );
};
