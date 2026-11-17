import { FC, useMemo, useState } from "react";

import { SortableHeader } from "@/components/SortableHeader";
import { CodexLink } from "@/components/codex/CodexLink";
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
import { AUDIENCE_UNIT, formatUsers } from "@/data/utils/audience";
import { formatPriceWithUnit } from "@/components/product/businessModelView";
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

/** Tris proposés dans le menu du téléphone (mêmes clés que les en-têtes). */
const MOBILE_SORTS: { key: CompetitorSortKey; label: string }[] = [
  { key: "name", label: "Studio" },
  { key: "relation", label: "Relation" },
  { key: "delivered", label: "Contrats livrés" },
  { key: "lastSeen", label: "Dernier contact" },
];

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
      <td data-stack="title">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-base-200 text-xs font-extrabold"
          >
            {initials(competitor.name)}
          </span>
          <span className={"font-extrabold " + (lost ? "line-through" : "")}>
            {competitor.name}
          </span>
        </div>
      </td>
      <td data-label="Relation">
        <div className="flex items-center gap-2">
          <span className={`badge badge-sm ${CLIENT_TIER_BADGE_CLASS[tier]}`}>
            {tier}
          </span>
          {client && !lost && (
            <span className="text-xs font-bold text-base-content/70 tabular-nums">
              {client.relation} / {CLIENT_RELATION_MAX}
            </span>
          )}
        </div>
      </td>
      <td className="tabular-nums" data-label="Contrats livrés">
        {client ? (
          <>
            {client.delivered}
            {client.early > 0 && (
              <span className="text-base-content/70">
                {" "}
                · {client.early} en avance
              </span>
            )}
          </>
        ) : (
          <span className="text-base-content/40">—</span>
        )}
      </td>
      <td className="text-right tabular-nums" data-label="Prime sur ses prix">
        {bonus > 0 ? (
          <span className="font-extrabold text-success">
            +{Math.round(bonus * 100)} %
          </span>
        ) : (
          <span className="text-base-content/40">—</span>
        )}
      </td>
      <td className="tabular-nums" data-label="Dernier contact">
        {client ? (
          getTimeAsDate(client.lastSeen).format("DD/MM/YYYY")
        ) : (
          <span className="text-base-content/60">Jamais</span>
        )}
      </td>
      <td data-label="Produits">
        {products.length === 0 ? (
          <span className="text-base-content/40">—</span>
        ) : (
          <ul className="flex flex-wrap gap-1">
            {products.map((p) => (
              <li
                key={`rival_${p.id}`}
                className="badge badge-sm badge-ghost gap-1"
                title={`${p.genre} · ${p.model} · ${formatPriceWithUnit(p.model, p.price)} · lancé le ${getTimeAsDate(p.launchTime).format("DD/MM/YYYY")}`}
              >
                {p.name}
                <span className="font-semibold text-base-content/60">
                  {p.genre} · {p.model} · {formatUsers(p.users)}{" "}
                  {AUDIENCE_UNIT[p.genre]}
                </span>
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
      <p className="text-sm font-semibold text-base-content/70">
        Aucun studio connu pour l'instant. <CodexLink id="concurrents" />
      </p>
    );
  }

  const worked = standings.filter((s) => s.client).length;
  const lost = standings.filter((s) => s.tier === ClientTier.PERDU).length;

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-base-content/70">
        {plural(standings.length, "studio")} sur le marché
        {worked > 0 && ` · ${worked} avec qui vous avez travaillé`}
        {lost > 0 && ` · ${plural(lost, "rompu")}`}. <CodexLink id="clients" />
      </p>
      {/* Téléphone : lignes en cartes, l'en-tête est masqué ; le tri passe
          par ce menu. */}
      <label className="flex items-center gap-2 text-sm font-bold sm:hidden">
        Trier par
        <select
          className="select select-sm w-auto rounded-full border-0 bg-white [--input-color:transparent]"
          value={sort ? `${sort.key}:${sort.direction}` : ""}
          onChange={(e) => {
            const [key, direction] = e.target.value.split(":");
            setSort(
              key
                ? {
                    key: key as CompetitorSortKey,
                    direction: direction as CompetitorSort["direction"],
                  }
                : null,
            );
          }}
        >
          <option value="">Ordre par défaut</option>
          {MOBILE_SORTS.map(({ key, label }) => (
            <optgroup key={key} label={label}>
              <option value={`${key}:asc`}>{label} ↑</option>
              <option value={`${key}:desc`}>{label} ↓</option>
            </optgroup>
          ))}
        </select>
      </label>
      <div className="overflow-x-auto">
        <table className="table table-stack">
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
    </div>
  );
};
