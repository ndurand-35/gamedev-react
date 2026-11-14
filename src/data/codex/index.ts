// Point d'entrée du codex : toutes les entrées, dans l'ordre de lecture (le
// sommaire les regroupe par catégorie en gardant cet ordre).

import type { CodexEntry } from "@/data/codex/types";
import { COMPANY_ENTRIES } from "@/data/codex/entries/company";
import { PRODUCTION_ENTRIES } from "@/data/codex/entries/production";
import { CONTRACT_ENTRIES } from "@/data/codex/entries/contracts";
import { PRODUCT_ENTRIES } from "@/data/codex/entries/products";
import { TEAM_ENTRIES } from "@/data/codex/entries/team";

export const CODEX_ENTRIES: CodexEntry[] = [
  ...COMPANY_ENTRIES,
  ...PRODUCTION_ENTRIES,
  ...CONTRACT_ENTRIES,
  ...PRODUCT_ENTRIES,
  ...TEAM_ENTRIES,
];

const BY_ID = new Map(CODEX_ENTRIES.map((e) => [e.id, e]));

export const getCodexEntry = (id: string): CodexEntry | undefined =>
  BY_ID.get(id);
