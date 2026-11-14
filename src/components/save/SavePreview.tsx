import type { FC } from "react";
import { Calendar, Coins, Trophy, Group } from "iconoir-react";

import { formatPrice } from "@/data/utils";
import type { SaveMeta } from "@/data/utils/saveStorage";

// Les 4 champs d'aperçu figés (contrat MYL-24, dans l'ordre) :
// 1. Date in-game  2. Trésorerie  3. Niveau/titre  4. Effectif.
export const SavePreview: FC<{ meta: SaveMeta }> = ({ meta }) => (
  <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold">
    <li className="flex items-center gap-1.5 whitespace-nowrap">
      <Calendar className="h-4 w-4 opacity-60" aria-hidden />
      <span className="tabular-nums">{meta.inGameDateLabel}</span>
    </li>
    <li className="flex items-center gap-1.5 whitespace-nowrap">
      <Coins className="h-4 w-4 opacity-60" aria-hidden />
      <span className="tabular-nums">{formatPrice(meta.money)}</span>
    </li>
    <li className="flex items-center gap-1.5 whitespace-nowrap">
      <Trophy className="h-4 w-4 opacity-60" aria-hidden />
      <span>{meta.milestoneTitle}</span>
    </li>
    <li className="flex items-center gap-1.5 whitespace-nowrap">
      <Group className="h-4 w-4 opacity-60" aria-hidden />
      <span className="tabular-nums">
        {meta.headcount} employé{meta.headcount > 1 ? "s" : ""}
      </span>
    </li>
  </ul>
);
