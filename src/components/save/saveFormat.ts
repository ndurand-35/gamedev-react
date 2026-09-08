// Helpers d'affichage pour l'écran de gestion des sauvegardes (MYL-24).
import dayjs from "dayjs";

import { formatPrice } from "@/data/utils";
import type { Integrity, SaveMeta } from "@/data/utils/saveStorage";

/** Libellé court de l'horodatage réel d'une sauvegarde. */
export const formatRealTimestamp = (ms: number): string =>
  dayjs(ms).format("DD/MM/YYYY HH:mm");

/**
 * Aperçu 1 ligne d'un slot (MYL-26 §1, ex. « 01/01/1970 00H · 45 320 € ·
 * Garage ») : date in-game · trésorerie · jalon courant. Sert au sous-titre du
 * bouton « Continuer » de l'écran d'accueil.
 */
export const formatSavePreviewLine = (meta: SaveMeta): string =>
  `${meta.inGameDateLabel} · ${formatPrice(meta.money)} · ${meta.milestoneTitle}`;

/** Libellé d'état d'intégrité pour un badge. */
export const INTEGRITY_LABEL: Record<Integrity, string> = {
  ok: "Occupé",
  corrupt: "Corrompu",
  outdated: "Version obsolète",
};

/** Classe DaisyUI du badge selon l'intégrité. */
export const INTEGRITY_BADGE_CLASS: Record<Integrity, string> = {
  ok: "badge-neutral",
  corrupt: "badge-error",
  outdated: "badge-warning",
};
