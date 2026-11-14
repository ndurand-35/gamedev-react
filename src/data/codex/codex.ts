// ── Codex : recherche et visibilité (logique pure, testée) ───────────────────

import type { FounderSkillId } from "@/data/utils/research";
import type { CodexBlock, CodexEntry } from "@/data/codex/types";

/** Minuscules sans accents : « Réputation » se trouve en tapant « reputation ». */
export const normalizeText = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const blockText = (b: CodexBlock): string => {
  if (b.type === "p") return b.text;
  if (b.type === "list") return b.items.join(" ");
  return [...b.head, ...b.rows.flat()].join(" ");
};

/** Une entrée réservée à une compétence n'apparaît qu'une fois celle-ci acquise. */
export const isEntryVisible = (
  entry: CodexEntry,
  acquired: readonly FounderSkillId[],
): boolean => !entry.requiresSkill || acquired.includes(entry.requiresSkill);

/**
 * Entrées correspondant à la recherche : tous les mots doivent apparaître
 * (titre, résumé ou contenu). Les correspondances dans le titre passent en
 * tête, puis celles du résumé, puis le reste ; l'ordre du codex départage.
 */
export const searchCodex = (
  entries: readonly CodexEntry[],
  query: string,
): CodexEntry[] => {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...entries];
  const scored: { entry: CodexEntry; score: number; index: number }[] = [];
  entries.forEach((entry, index) => {
    const title = normalizeText(entry.title);
    const summary = normalizeText(entry.summary);
    const body = normalizeText(entry.body.map(blockText).join(" "));
    let score = 0;
    for (const w of words) {
      if (title.includes(w)) score += 3;
      else if (summary.includes(w)) score += 2;
      else if (body.includes(w)) score += 1;
      else return;
    }
    scored.push({ entry, score, index });
  });
  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((s) => s.entry);
};

/** Découpe un texte en segments normaux / **gras**. */
export const parseInline = (text: string): { text: string; bold: boolean }[] =>
  text
    .split(/(\*\*[^*]+\*\*)/)
    .filter(Boolean)
    .map((part) =>
      part.startsWith("**") && part.endsWith("**")
        ? { text: part.slice(2, -2), bold: true }
        : { text: part, bold: false },
    );
