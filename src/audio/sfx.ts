// ── Effets sonores d'interface ───────────────────────────────────────────────
// Tout est synthétisé (oscillateurs + enveloppes + filtres) et passe par le bus
// « effets » du moteur partagé (`engine.ts`) : le curseur de volume des effets
// les règle tous d'un coup. Sons courts et feutrés : l'interface se clique des
// centaines de fois par partie, rien ne doit fatiguer l'oreille.

import { AudioBus, getAudioBus, getAudioSettings } from "@/audio/engine";

interface Tone {
  freq: number;
  /** Décalage de départ (s) par rapport à maintenant. */
  at?: number;
  duration: number;
  gain: number;
  type?: OscillatorType;
  /** Fréquence d'arrivée (glissando exponentiel), si différente. */
  toFreq?: number;
  filterFreq?: number;
}

function tone(b: AudioBus, t: Tone): void {
  const { ctx, sfx } = b;
  const start = ctx.currentTime + (t.at ?? 0);
  const end = start + t.duration;
  const osc = ctx.createOscillator();
  osc.type = t.type ?? "sine";
  osc.frequency.setValueAtTime(t.freq, start);
  if (t.toFreq) osc.frequency.exponentialRampToValueAtTime(t.toFreq, end);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(t.gain, start + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, end);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = t.filterFreq ?? 4000;

  osc.connect(filter).connect(env).connect(sfx);
  osc.start(start);
  osc.stop(end + 0.02);
}

// Anti-rafale : un même son relancé trop vite (clics en série, notifications
// groupées à vitesse x3) n'est joué qu'une fois.
const lastPlayed = new Map<string, number>();

function play(key: string, minGapMs: number, draw: (b: AudioBus) => void): void {
  if (getAudioSettings().sfx <= 0) return;
  const b = getAudioBus();
  if (!b || b.ctx.state !== "running") return;
  const now = performance.now();
  if (now - (lastPlayed.get(key) ?? -Infinity) < minGapMs) return;
  lastPlayed.set(key, now);
  try {
    draw(b);
  } catch {
    // Non bloquant : un échec audio n'interrompt jamais le jeu.
  }
}

/** Clic de bouton / lien : petit « tic » boisé. */
export const playClick = (): void =>
  play("click", 35, (b) =>
    tone(b, { freq: 1400, toFreq: 700, duration: 0.05, gain: 0.12 }),
  );

/** Survol d'une entrée de menu : effleurement très bref, presque inaudible. */
export const playHover = (): void =>
  play("hover", 45, (b) =>
    tone(b, { freq: 2200, toFreq: 2600, duration: 0.035, gain: 0.035 }),
  );

/** Case cochée / décochée : deux hauteurs pour distinguer les deux sens. */
export const playToggle = (on: boolean): void =>
  play("toggle", 35, (b) =>
    tone(b, {
      freq: on ? 880 : 660,
      toFreq: on ? 1320 : 440,
      duration: 0.07,
      gain: 0.1,
      type: "triangle",
    }),
  );

export type NotifySound = "success" | "info" | "warning" | "error";

/** Signature sonore d'une notification, selon sa gravité. */
export const playNotify = (kind: NotifySound): void =>
  play(`notify:${kind}`, 250, (b) => {
    switch (kind) {
      case "success": // quarte montante, claire
        tone(b, { freq: 659.25, duration: 0.18, gain: 0.14, type: "triangle" });
        tone(b, { freq: 880, at: 0.09, duration: 0.3, gain: 0.14, type: "triangle" });
        break;
      case "info": // goutte unique
        tone(b, { freq: 987.77, toFreq: 1174.66, duration: 0.16, gain: 0.08 });
        break;
      case "warning": // tierce mineure descendante
        tone(b, { freq: 587.33, duration: 0.18, gain: 0.13, type: "triangle" });
        tone(b, { freq: 493.88, at: 0.12, duration: 0.28, gain: 0.13, type: "triangle" });
        break;
      case "error": // deux coups graves et ronds
        tone(b, { freq: 196, duration: 0.14, gain: 0.2, type: "square", filterFreq: 900 });
        tone(b, { freq: 174.61, at: 0.15, duration: 0.24, gain: 0.2, type: "square", filterFreq: 900 });
        break;
    }
  });

/** Une décision attend le joueur : petite cloche à deux tons. */
export const playAttention = (): void =>
  play("attention", 1000, (b) => {
    for (const [freq, at] of [
      [783.99, 0],
      [1046.5, 0.14],
    ] as const) {
      tone(b, { freq, at, duration: 0.9, gain: 0.12 });
      // Partiel inharmonique léger : timbre de cloche plutôt que de bip.
      tone(b, { freq: freq * 2.76, at, duration: 0.35, gain: 0.025 });
    }
  });

/** Faillite : arpège descendant, lent. */
export const playGameOver = (): void =>
  play("gameover", 3000, (b) => {
    [523.25, 466.16, 392, 311.13].forEach((freq, i) =>
      tone(b, {
        freq,
        at: i * 0.32,
        duration: 0.6,
        gain: 0.16,
        type: "triangle",
        filterFreq: 2200,
      }),
    );
  });

/**
 * Sting de succès « studio ouvert » : arpège majeur ascendant (do-mi-sol-do) +
 * un halo sinus dessous pour la chaleur. Bref (~0,55 s), lumineux.
 */
export const playStudioOpenSting = (): void =>
  play("studio", 500, (b) => {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) =>
      tone(b, {
        freq,
        at: i * 0.085,
        duration: 0.22,
        gain: 0.2,
        type: "triangle",
        filterFreq: 6000,
      }),
    );
    tone(b, { freq: 261.63, duration: 0.6, gain: 0.09 });
  });
