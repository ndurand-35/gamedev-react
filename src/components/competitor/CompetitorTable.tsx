import { FC, useMemo, useState } from "react";

import { SortableHeader } from "@/components/SortableHeader";
import {
  CLIENT_RELATION_MAX,
  CLIENT_TIER_BADGE_CLASS,
  ClientTier,
  CompetitorProduct,
} from "@/data/interface";
import { useAppSelector } from "@/data/redux/hooks";
import {
  CompetitorSort,
  CompetitorSortKey,
  CompetitorStanding,
  competitorStandings,
  nextCompetitorSort,
  sortCompetitors,
} from "@/data/utils/competitor";
import { rivalsOf } from "@/data/utils/competitorProduct";
import { getTimeAsDate } from "@/data/utils/time";

// ─────────────────────────────────────────────────────────────────────────────
// Le marché vu depuis notre carnet d'adresses. Chaque studio du roster est là,
// qu'on ait travaillé avec lui ou non ; la ligne dit où en est la relation :
// qui revient (et à quelle prime), qui n'a encore rien signé, et qui a claqué
// la porte — un contrat raté ne coûte pas qu'un malus, il retire un donneur
// d'ordre pour de bon.
// ─────────────────────────────────────────────────────────────────────────────

/** Initiales d'un nom de studio (« Hettinger LLC » → « HL »). */
const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

const plural = (n: number, word: string): string =>
  `${n} ${word}${n > 1 ? "s" : ""}`;

const StandingRow: FC<{
  standing: CompetitorStanding;
  products: CompetitorProduct[];
}> = ({ standing, products }) => {
  const { competitor, client, tier, bonus } = standing;
  const lost = client?.lost ?? false;
  return (
    <tr className={lost ? "opacity-50" : ""}>
      <td>
        <div className="flex items-center gap-3">
          <div className="avatar avatar-placeholder">
            <div className="w-8 rounded-full bg-neutral text-neutral-content">
              <span className="text-xs">{initials(competitor.name)}</span>
            </div>
          </div>
          <span className={"font-medium " + (lost ? "line-through" : "")}>
            {competitor.name}
          </span>
        </div>
      </td>
      <td>
        <div className="flex items-center gap-2">
          <span className={`badge badge-sm ${CLIENT_TIER_BADGE_CLASS[tier]}`}>
            {tier}
          </span>
          {client && !lost && (
            <span className="text-xs tabular-nums opacity-70">
              {client.relation} / {CLIENT_RELATION_MAX}
            </span>
          )}
        </div>
      </td>
      <td className="tabular-nums">
        {client ? (
          <>
            {client.delivered}
            {client.early > 0 && (
              <span className="opacity-70"> · {client.early} en avance</span>
            )}
          </>
        ) : (
          <span className="opacity-40">—</span>
        )}
      </td>
      <td className="text-right tabular-nums">
        {bonus > 0 ? (
          <span className="text-success">+{Math.round(bonus * 100)} %</span>
        ) : (
          <span className="opacity-40">—</span>
        )}
      </td>
      <td className="tabular-nums">
        {client ? (
          getTimeAsDate(client.lastSeen).format("DD/MM/YYYY")
        ) : (
          <span className="opacity-60">Jamais</span>
        )}
      </td>
      <td>
        {products.length === 0 ? (
          <span className="opacity-40">—</span>
        ) : (
          <ul className="flex flex-wrap gap-1">
            {products.map((p) => (
              <li
                key={`rival_${p.id}`}
                className="badge badge-sm badge-ghost gap-1"
                title={`${p.genre} · lancé le ${getTimeAsDate(p.launchTime).format("DD/MM/YYYY")}`}
              >
                {p.name}
                <span className="opacity-60">{p.genre}</span>
              </li>
            ))}
          </ul>
        )}
      </td>
    </tr>
  );
};

export const CompetitorTable: FC = () => {
  const roster = useAppSelector((state) => state.competitor.roster);
  const rivals = useAppSelector((state) => state.competitor.products);
  const clients = useAppSelector((state) => state.task.clients);

  const standings = useMemo(
    () => competitorStandings(roster, clients ?? {}),
    [roster, clients],
  );

  const [sort, setSort] = useState<CompetitorSort | null>(null);
  const toggleSort = (key: CompetitorSortKey) =>
    setSort((prev) => nextCompetitorSort(prev, key));
  const sorted = useMemo(
    () => sortCompetitors(standings, sort),
    [standings, sort],
  );
  const headerProps = { sort, onSort: toggleSort };

  if (standings.length === 0) {
    return (
      <p className="p-4 text-sm opacity-60">
        Aucun studio connu pour l'instant. Lancez le jeu : le marché se découvre
        au premier lot de contrats.
      </p>
    );
  }

  const worked = standings.filter((s) => s.client).length;
  const lost = standings.filter((s) => s.tier === ClientTier.PERDU).length;

  return (
    <div className="space-y-3">
      <p className="text-sm opacity-60">
        {plural(standings.length, "studio")} sur le marché
        {worked > 0 && ` · ${worked} avec qui vous avez travaillé`}
        {lost > 0 && ` · ${plural(lost, "rompu")}`}. Livrer en avance fait
        revenir un studio avec de meilleurs contrats ; manquer une deadline le
        fait rompre pour de bon.
      </p>
      <table className="table table-zebra bg-base-100 rounded-box shadow">
        <thead>
          <tr>
            <SortableHeader label="Studio" sortKey="name" {...headerProps} />
            <SortableHeader
              label="Relation"
              sortKey="relation"
              {...headerProps}
            />
            <SortableHeader
              label="Contrats livrés"
              sortKey="delivered"
              {...headerProps}
            />
            <th className="text-right">Prime sur ses prix</th>
            <SortableHeader
              label="Dernier contact"
              sortKey="lastSeen"
              {...headerProps}
            />
            <th>Produits</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((standing) => (
            <StandingRow
              key={`competitor_${standing.competitor.id}`}
              standing={standing}
              products={rivalsOf(rivals ?? [], standing.competitor.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};
