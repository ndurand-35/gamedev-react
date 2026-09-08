import type { FC } from "react";
import { Calendar, Coins, Trophy, Group } from "iconoir-react";

import { formatPrice } from "@/data/utils";
import type { SaveMeta } from "@/data/utils/saveStorage";

// Les 4 champs d'aperçu figés (contrat MYL-24, dans l'ordre) :
// 1. Date in-game  2. Trésorerie  3. Niveau/titre  4. Effectif.
export const SavePreview: FC<{ meta: SaveMeta }> = ({ meta }) => (
  <ul className="grid grid-cols-2 gap-2 text-sm">
    <li className="flex items-center gap-2">
      <Calendar className="w-4 h-4 opacity-60" aria-hidden />
      <span className="tabular-nums">{meta.inGameDateLabel}</span>
    </li>
    <li className="flex items-center gap-2">
      <Coins className="w-4 h-4 opacity-60" aria-hidden />
      <span className="tabular-nums">{formatPrice(meta.money)}</span>
    </li>
    <li className="flex items-center gap-2">
      <Trophy className="w-4 h-4 opacity-60" aria-hidden />
      <span>{meta.milestoneTitle}</span>
    </li>
    <li className="flex items-center gap-2">
      <Group className="w-4 h-4 opacity-60" aria-hidden />
      <span className="tabular-nums">
        {meta.headcount} employé{meta.headcount > 1 ? "s" : ""}
      </span>
    </li>
  </ul>
);
