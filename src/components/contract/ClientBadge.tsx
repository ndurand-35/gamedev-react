import { FC } from "react";

import {
  CLIENT_TIER_BADGE_CLASS,
  Client,
  ClientTier,
  clientTier,
} from "@/data/interface";
import { useAppSelector } from "@/data/redux/hooks";

interface ClientBadgeProps {
  clientId: string;
  /** Nom porté par le contrat : fait foi tant que le client n'est pas au carnet. */
  name: string;
  /** Prime de fidélité du contrat affiché (0 pour un premier contact). */
  loyaltyBonus?: number;
}

const tierTitle = (client: Client | undefined, tier: ClientTier): string => {
  if (!client) return "Premier contact — jamais travaillé ensemble";
  if (client.lost) return "Relation rompue : ce client ne reviendra pas";
  return (
    `${tier} · relation ${client.relation}` +
    ` · ${client.delivered} contrat${client.delivered > 1 ? "s" : ""} livré${client.delivered > 1 ? "s" : ""}` +
    (client.early > 0 ? ` dont ${client.early} en avance` : "")
  );
};

/**
 * Identité d'un client sur une ligne de contrat : son nom, son palier de
 * relation, et la prime de fidélité déjà incluse dans les prix affichés. C'est
 * ce badge qui transforme la liste hebdomadaire en visages reconnaissables.
 */
export const ClientBadge: FC<ClientBadgeProps> = ({
  clientId,
  name,
  loyaltyBonus = 0,
}) => {
  const client = useAppSelector((state) =>
    clientId ? state.task.clients?.[clientId] : undefined,
  );
  const tier = clientTier(client);

  return (
    <div className="flex flex-row items-center gap-1.5">
      <span className="text-sm whitespace-nowrap">{name}</span>
      <span
        className={`badge badge-xs ${CLIENT_TIER_BADGE_CLASS[tier]}`}
        title={tierTitle(client, tier)}
      >
        {tier}
      </span>
      {loyaltyBonus > 0 && (
        <span
          className="badge badge-xs badge-outline badge-success tabular-nums"
          title="Prime de fidélité déjà comprise dans l'acompte et le solde"
        >
          +{Math.round(loyaltyBonus * 100)} %
        </span>
      )}
    </div>
  );
};
