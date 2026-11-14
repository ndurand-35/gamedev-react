import { describe, it, expect } from "vitest";

import { CODEX_ENTRIES, getCodexEntry } from "@/data/codex";
import {
  isEntryVisible,
  normalizeText,
  parseInline,
  searchCodex,
} from "@/data/codex/codex";
import { CODEX_CATEGORIES, CodexEntry } from "@/data/codex/types";
import { FOUNDER_SKILLS } from "@/data/utils/research";

// Points d'ancrage promis aux écrans (liens « ? ») et aux renvois entre entrées.
const ANCHORS = [
  "composants", "production", "stock", "affectation",
  "contrats", "livraison", "clients",
  "produits", "fonctionnalites", "bugs", "marche", "technologies", "tendances",
  "concurrents", "popularite",
  "employes", "competences", "recrutement", "entretien", "negociation", "moral",
  "formation", "debauchage", "qa", "marketing", "salaires",
  "objectif", "temps", "reputation", "paliers", "tresorerie", "faillite",
  "banque-prets", "batiments", "studios", "competences-fondateur",
  "evenements", "alertes", "sauvegardes",
];

describe("contenu du codex", () => {
  it("a des identifiants uniques en kebab-case", () => {
    const ids = CODEX_ENTRIES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("contient tous les points d'ancrage", () => {
    for (const id of ANCHORS) expect(getCodexEntry(id), id).toBeDefined();
  });

  it("ne renvoie qu'à des entrées existantes, jamais à elle-même", () => {
    for (const e of CODEX_ENTRIES) {
      for (const r of e.related ?? []) {
        expect(getCodexEntry(r), `${e.id} → ${r}`).toBeDefined();
        expect(r).not.toBe(e.id);
      }
    }
  });

  it("range chaque entrée dans une catégorie connue, avec un contenu", () => {
    const cats = CODEX_CATEGORIES.map((c) => c.id);
    const skills = FOUNDER_SKILLS.map((s) => s.id);
    for (const e of CODEX_ENTRIES) {
      expect(cats).toContain(e.category);
      expect(e.title.trim()).not.toBe("");
      expect(e.summary.length, e.id).toBeLessThanOrEqual(160);
      expect(e.body.length, e.id).toBeGreaterThan(0);
      if (e.requiresSkill) expect(skills).toContain(e.requiresSkill);
    }
  });

  it("garde un gras bien fermé (nombre pair de **)", () => {
    const texts = CODEX_ENTRIES.flatMap((e) => [
      e.summary,
      ...e.body.flatMap((b) =>
        b.type === "p" ? [b.text] : b.type === "list" ? b.items : b.rows.flat(),
      ),
    ]);
    for (const t of texts) expect((t.match(/\*\*/g) ?? []).length % 2, t).toBe(0);
  });
});

const entry = (over: Partial<CodexEntry>): CodexEntry => ({
  id: "x",
  category: "bases",
  title: "Titre",
  summary: "Résumé",
  body: [{ type: "p", text: "Contenu" }],
  ...over,
});

describe("recherche", () => {
  const list = [
    entry({ id: "a", title: "Trésorerie", summary: "L'argent du studio." }),
    entry({ id: "b", title: "Faillite", summary: "Quand la trésorerie manque." }),
    entry({ id: "c", title: "Moral", body: [{ type: "list", items: ["démission"] }] }),
  ];

  it("ignore les accents et la casse", () => {
    expect(normalizeText("Réputation ÉLEVÉE")).toBe("reputation elevee");
    expect(searchCodex(list, "tresorerie").map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("exige tous les mots et cherche jusque dans le contenu", () => {
    expect(searchCodex(list, "demission").map((e) => e.id)).toEqual(["c"]);
    expect(searchCodex(list, "tresorerie demission")).toEqual([]);
    expect(searchCodex(list, "  ")).toHaveLength(3);
  });
});

describe("visibilité et mise en forme", () => {
  it("cache une entrée réservée tant que la compétence manque", () => {
    const gated = entry({ requiresSkill: "cv_reading" });
    expect(isEntryVisible(gated, [])).toBe(false);
    expect(isEntryVisible(gated, ["cv_reading"])).toBe(true);
  });

  it("découpe le gras", () => {
    expect(parseInline("a **b** c")).toEqual([
      { text: "a ", bold: false },
      { text: "b", bold: true },
      { text: " c", bold: false },
    ]);
  });
});
