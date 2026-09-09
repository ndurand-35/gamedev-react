import { FC, useMemo } from "react";

import {
  CLIENT_TIER_BADGE_CLASS,
  Client,
  clientTier,
} from "@/data/interface";
import { useAppSelector } from "@/data/redux/hooks";
import { loyaltyBonus } from "@/data/utils/client";

/** Actifs d'abord, puis par relation décroissante, les rompus en fin de liste. */
const byStanding = (a: Client, b: Client): number => {
  if (a.lost !== b.lost) return a.lost ? 1 : -1;
  if (b.relation !== a.relation) return b.relation - a.relation;
  return b.delivered - a.delivered;
};

/**
 * Carnet d'adresses : la contrepartie lisible des clients à mémoire. On y voit
 * qui revient (et à quelle prime), et qui a claqué la porte — un contrat raté
 * ne coûte pas qu'un malus, il retire un nom de cette liste pour de bon.
 */
export const ClientNetwork: FC = () => {
  const clients = useAppSelector((state) => state.task.clients);

  const sorted = useMemo(
    () => Object.values(clients ?? {}).sort(byStanding),
    [clients],
  );

  if (sorted.length === 0) {
    return (
      <p className="p-4 text-sm opacity-60">
        Aucun client au carnet. Signez un contrat : le client s'en souviendra.
      </p>
    );
  }

  const active = sorted.filter((c) => !c.lost).length;

  return (
    <div className="p-4 space-y-3">
      <p className="text-sm opacity-60">
        {active} client{active > 1 ? "s" : ""} actif{active > 1 ? "s" : ""} sur{" "}
        {sorted.length} rencontré{sorted.length > 1 ? "s" : ""}. Livrer en avance
        fait revenir un client avec de meilleurs contrats ; manquer une deadline
        le fait disparaître.
      </p>
      <div className="flex flex-row flex-wrap gap-2">
        {sorted.map((client) => {
          const tier = clientTier(client);
          const bonus = client.lost ? 0 : loyaltyBonus(client.relation);
          return (
            <div
              key={`client_${client.id}`}
              className={
                "flex flex-col gap-1 px-3 py-2 rounded-box bg-base-200 " +
                (client.lost ? "opacity-40" : "")
              }
            >
              <div className="flex flex-row items-center gap-2">
                <span
                  className={
                    "text-sm font-medium " + (client.lost ? "line-through" : "")
                  }
                >
                  {client.name}
                </span>
                <span className={`badge badge-xs ${CLIENT_TIER_BADGE_CLASS[tier]}`}>
                  {tier}
                </span>
              </div>
              <span className="text-xs opacity-70 tabular-nums">
                {client.delivered} livré{client.delivered > 1 ? "s" : ""}
                {client.early > 0 && ` · ${client.early} en avance`}
                {bonus > 0 && ` · +${Math.round(bonus * 100)} % sur ses prix`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
