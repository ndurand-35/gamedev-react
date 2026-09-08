// ── MapMonde — Barrel des panneaux UI (MYL-21, Stage 2) ──────────────────────
// ⚠️ Volontairement SÉPARÉ de `index.ts` : ces panneaux sont du daisyui/Tailwind
// pur (aucune dépendance Three/R3F). Les importer d'ici (pas depuis `index.ts`,
// qui tire le bundle Three) évite d'alourdir tout consommateur des panneaux.
// Câblés sur le state réel au Stage 3 (selectStudioStatus, money, peakReputation,
// thunk unlockStudio / clearStudioReveal).
export * from "@/components/worldmap/StudioPreviewPanel";
export * from "@/components/worldmap/StudioLockedPopin";
export * from "@/components/worldmap/RevealBanner";
