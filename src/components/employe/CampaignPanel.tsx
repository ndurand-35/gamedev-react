import { FC, useState } from "react";
import { Megaphone } from "iconoir-react";

import {
  ActiveCampaign,
  CAMPAIGNS,
  CampaignType,
  campaignEffectiveness,
} from "@/data/utils/economy";
import { launchCampaign } from "@/data/redux/companySlice";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import {
  selectActiveCampaign,
  selectBestMarketer,
} from "@/data/redux/selectors";
import { formatPrice } from "@/data/utils";

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
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span>{campaign.type}</span>
        <span className="opacity-70">{remainingDays} j restants</span>
      </div>
      <progress
        className="progress progress-warning w-full"
        value={elapsed}
        max={total}
      />
    </div>
  );
};

export const CampaignPanel: FC = () => {
  const dispatch = useAppDispatch();
  const money = useAppSelector((s) => s.company.money);
  const time = useAppSelector((s) => s.engine.time);
  const activeCampaign = useAppSelector(selectActiveCampaign);
  const bestMarketer = useAppSelector(selectBestMarketer);

  const [selected, setSelected] = useState<CampaignType>(CampaignType.NOTORIETY);

  const effectiveness = bestMarketer
    ? campaignEffectiveness(
        bestMarketer.communicationStat,
        bestMarketer.campaignManagementStat,
      )
    : 0;

  const def = CAMPAIGNS[selected];
  const insufficientFunds = money < def.cost;
  const noMarketer = !bestMarketer;
  const campaignRunning = !!activeCampaign;
  const launchDisabled =
    insufficientFunds || noMarketer || campaignRunning;

  const launch = () => {
    if (launchDisabled || !bestMarketer) return;
    dispatch(
      launchCampaign({ type: selected, effectiveness, time }),
    );
  };

  return (
    <dialog
      id={CAMPAIGN_PANEL_ID}
      className="modal"
      role="dialog"
      aria-label="Campagne marketing"
    >
      <div className="modal-box max-w-md">
        <h3 className="font-bold text-lg flex items-center gap-2 mb-3">
          <Megaphone width={20} height={20} />
          Campagne marketing
        </h3>

        {campaignRunning && activeCampaign ? (
          <div className="space-y-3">
            <p className="text-sm opacity-70">Campagne en cours :</p>
            <CampaignProgress campaign={activeCampaign} time={time} />
            <p className="text-xs opacity-60">
              Une seule campagne à la fois — patientez la fin de celle-ci.
            </p>
          </div>
        ) : (
          <>
            {noMarketer && (
              <p className="text-sm text-error mb-2">
                Aucun marketeur recruté : embauchez un profil Marketing pour
                lancer une campagne.
              </p>
            )}
            <div className="space-y-2 mb-3">
              {CAMPAIGN_ORDER.map((type) => {
                const c = CAMPAIGNS[type];
                return (
                  <label
                    key={type}
                    className="flex items-start gap-3 cursor-pointer rounded-lg border border-base-300 p-2 hover:border-warning"
                  >
                    <input
                      type="radio"
                      name="campaign_type"
                      className="radio radio-warning radio-sm mt-1"
                      checked={selected === type}
                      onChange={() => setSelected(type)}
                    />
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <span className="font-medium">{c.label}</span>
                        <span className="text-sm opacity-70">
                          {formatPrice(c.cost)}
                        </span>
                      </div>
                      <p className="text-xs opacity-60">{c.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="text-xs opacity-70 mb-3">
              {bestMarketer ? (
                <>
                  Efficacité estimée (d'après {bestMarketer.firstName}{" "}
                  {bestMarketer.lastName}) :{" "}
                  <span className="font-medium">
                    {Math.round(effectiveness * 100)}%
                  </span>
                </>
              ) : (
                "Efficacité indisponible (aucun marketeur)."
              )}
              <br />
              Durée : 30 jours.
            </div>

            <div className="modal-action">
              <form method="dialog">
                <button type="submit" className="btn">
                  Annuler
                </button>
              </form>
              <div
                className={insufficientFunds ? "tooltip" : ""}
                data-tip={
                  insufficientFunds ? "Trésorerie insuffisante" : undefined
                }
              >
                <button
                  type="button"
                  className={
                    "btn btn-warning" + (launchDisabled ? " btn-disabled" : "")
                  }
                  disabled={launchDisabled}
                  onClick={launch}
                >
                  Lancer · -{formatPrice(def.cost)}
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
