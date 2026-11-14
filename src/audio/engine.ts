// ── Moteur audio partagé ─────────────────────────────────────────────────────
// Web Audio API pure, zéro dépendance, zéro fichier : effets et musique sont
// synthétisés à la volée. Un contexte unique, deux bus (effets / musique) sous
// un bus maître. Non bloquant : sans Web Audio (tests, vieux navigateur), tout
// est un no-op silencieux, jamais une exception qui remonterait dans le jeu.
//
// Les réglages (volume musique / effets) sont des préférences du joueur, pas
// de la partie : ils vivent dans localStorage, hors des sauvegardes.

export interface AudioSettings {
  /** Volume de la musique, 0 (coupée) à 1. */
  music: number;
  /** Volume des effets d'interface, 0 (coupés) à 1. */
  sfx: number;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = { music: 0.5, sfx: 0.7 };

const STORAGE_KEY = "audio-settings";

const clamp01 = (n: unknown, fallback: number): number =>
  typeof n === "number" && Number.isFinite(n)
    ? Math.max(0, Math.min(1, n))
    : fallback;

/** Relit des réglages stockés, en tolérant un contenu absent ou corrompu. */
export const parseAudioSettings = (raw: string | null): AudioSettings => {
  if (!raw) return { ...DEFAULT_AUDIO_SETTINGS };
  try {
    const data = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      music: clamp01(data.music, DEFAULT_AUDIO_SETTINGS.music),
      sfx: clamp01(data.sfx, DEFAULT_AUDIO_SETTINGS.sfx),
    };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
};

const readStoredSettings = (): AudioSettings => {
  try {
    return parseAudioSettings(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
};

let settings: AudioSettings =
  typeof window === "undefined"
    ? { ...DEFAULT_AUDIO_SETTINGS }
    : readStoredSettings();

const listeners = new Set<() => void>();

export const getAudioSettings = (): AudioSettings => settings;

export const subscribeAudioSettings = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// Courbe perceptive : un curseur à mi-course doit « sonner » à mi-volume.
const perceived = (v: number): number => v * v;

export const setAudioSettings = (patch: Partial<AudioSettings>): void => {
  settings = {
    music: clamp01(patch.music, settings.music),
    sfx: clamp01(patch.sfx, settings.sfx),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Stockage indisponible (navigation privée) : le réglage vaut pour la session.
  }
  if (bus) {
    const t = bus.ctx.currentTime;
    bus.sfx.gain.setTargetAtTime(perceived(settings.sfx), t, 0.05);
    bus.music.gain.setTargetAtTime(perceived(settings.music), t, 0.2);
  }
  listeners.forEach((l) => l());
};

export interface AudioBus {
  ctx: AudioContext;
  master: GainNode;
  sfx: GainNode;
  music: GainNode;
}

let bus: AudioBus | null = null;
let unavailable = false;

/**
 * Contexte + bus, créés paresseusement. Le contexte démarre « suspended » tant
 * qu'aucun geste du joueur n'a eu lieu (politique d'autoplay) : `unlockAudio`
 * le relance au premier clic.
 */
export function getAudioBus(): AudioBus | null {
  if (bus) return bus;
  if (unavailable || typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) {
    unavailable = true;
    return null;
  }
  try {
    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = 0.9;
    // Limiteur doux : effets + musique superposés ne saturent jamais.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 8;
    master.connect(limiter).connect(ctx.destination);
    const sfx = ctx.createGain();
    sfx.gain.value = perceived(settings.sfx);
    sfx.connect(master);
    const music = ctx.createGain();
    music.gain.value = perceived(settings.music);
    music.connect(master);
    bus = { ctx, master, sfx, music };
    return bus;
  } catch {
    unavailable = true;
    return null;
  }
}

/** Le contexte joue-t-il déjà (geste du joueur reçu) ? */
export const isAudioRunning = (): boolean => bus?.ctx.state === "running";

/** À appeler depuis un geste du joueur : autorise le son. */
export function unlockAudio(): void {
  const b = getAudioBus();
  if (b && b.ctx.state === "suspended") void b.ctx.resume().catch(() => {});
}

/** Onglet masqué : on coupe tout (la musique ne joue pas en arrière-plan). */
export function setAudioSuspended(suspended: boolean): void {
  if (!bus) return;
  if (suspended && bus.ctx.state === "running") {
    void bus.ctx.suspend().catch(() => {});
  } else if (!suspended && bus.ctx.state === "suspended") {
    void bus.ctx.resume().catch(() => {});
  }
}
