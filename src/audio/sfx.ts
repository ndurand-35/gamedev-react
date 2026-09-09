// ── MapMonde — Effets sonores procéduraux (MYL-22, Stage 2 / Audio) ──────────
// Web Audio API pure, ZÉRO dépendance, ZÉRO fichier asset : tout est synthétisé
// à la volée (oscillateurs + gain + filtre). Lot Audio « non bloquant v1 » : si le
// navigateur n'expose pas Web Audio, ou si le contexte refuse de démarrer hors
// d'un geste utilisateur, chaque fonction est un no-op silencieux — jamais
// d'exception qui remonterait dans le gameplay.
//
// Un seul son (le feedback de sélection de pin est parti avec la mappemonde) :
//   • `playStudioOpenSting()`  → sting court de succès au déblocage d'un studio
//                                 (accroché à `studio.pendingReveal`, contrat
//                                 Stage 1 — voir `useStudioOpenChime`).
//
// Tout passe par un GainNode maître unique → `setAudioMuted(true)` coupe tout
// instantanément (point d'accroche pour un futur bouton mute global).

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

/** Récupère (ou crée paresseusement) le contexte + le bus maître. */
function ensureAudio(): { ctx: AudioContext; master: GainNode } | null {
  if (typeof window === "undefined") return null;

  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null; // Web Audio indisponible → silence.
    try {
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
      master = null;
      return null;
    }
  }

  // Politique d'autoplay : le contexte démarre « suspended » tant qu'aucun geste
  // utilisateur n'a eu lieu. Nos sons sont tous déclenchés par un clic (ouverture
  // de studio / sélection de pin) → `resume()` réussit dans ce contexte.
  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => undefined);
  }

  return master ? { ctx, master } : null;
}

/** Coupe / rétablit tout l'audio (bus maître). Persiste si le contexte n'existe pas encore. */
export function setAudioMuted(next: boolean): void {
  muted = next;
  if (master) master.gain.value = next ? 0 : 1;
}

export function isAudioMuted(): boolean {
  return muted;
}

/**
 * Joue une suite de notes mélodiques (arpège) — un oscillateur par note, enveloppe
 * attaque/déclin courte, le tout filtré passe-bas pour adoucir l'attaque.
 */
function playNotes(
  bus: { ctx: AudioContext; master: GainNode },
  notes: number[],
  opts: {
    type?: OscillatorType;
    noteDuration?: number;
    gap?: number;
    gain?: number;
    filterFreq?: number;
  } = {},
): void {
  const {
    type = "triangle",
    noteDuration = 0.16,
    gap = 0.075,
    gain = 0.22,
    filterFreq = 5200,
  } = opts;
  const { ctx, master } = bus;
  const now = ctx.currentTime;

  notes.forEach((freq, i) => {
    const start = now + i * gap;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(gain, start + 0.012); // attaque douce
    env.gain.exponentialRampToValueAtTime(0.0001, start + noteDuration);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(filterFreq, start);

    osc.connect(filter).connect(env).connect(master);
    osc.start(start);
    osc.stop(start + noteDuration + 0.02);
  });
}

/**
 * Sting de succès « studio ouvert » : arpège majeur ascendant (do-mi-sol-do) en
 * triangle + un léger halo sinus dessous pour la chaleur. Bref (~0,55 s),
 * lumineux, jamais agressif (UX §7 : célébration discrète).
 */
export function playStudioOpenSting(): void {
  const bus = ensureAudio();
  if (!bus) return;
  try {
    // Arpège brillant : C5 → E5 → G5 → C6.
    playNotes(bus, [523.25, 659.25, 783.99, 1046.5], {
      type: "triangle",
      noteDuration: 0.22,
      gap: 0.085,
      gain: 0.2,
      filterFreq: 6000,
    });

    // Halo sinus tenu sous l'arpège (fondamentale C4) → corps chaleureux.
    const { ctx, master } = bus;
    const now = ctx.currentTime;
    const pad = ctx.createOscillator();
    pad.type = "sine";
    pad.frequency.setValueAtTime(261.63, now);
    const padEnv = ctx.createGain();
    padEnv.gain.setValueAtTime(0.0001, now);
    padEnv.gain.exponentialRampToValueAtTime(0.09, now + 0.06);
    padEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    pad.connect(padEnv).connect(master);
    pad.start(now);
    pad.stop(now + 0.65);
  } catch {
    // Non bloquant v1 : on n'interrompt jamais le jeu pour un échec audio.
  }
}
