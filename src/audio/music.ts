// ── Musique de fond générative ───────────────────────────────────────────────
// Boucle lo-fi calme, synthétisée en direct : nappe d'accords, basse ronde,
// mélodie pentatonique tirée au hasard (jamais deux fois la même), batterie
// feutrée avec un peu de swing. Une grille d'accords est tirée toutes les
// 4 mesures, la batterie se tait de temps en temps pour laisser respirer.
//
// Ordonnancement classique Web Audio : un minuteur court planifie les notes un
// peu à l'avance sur l'horloge du contexte (précise), pas sur setTimeout.

import { AudioBus, getAudioBus } from "@/audio/engine";

// ── Théorie (pur, testé) ─────────────────────────────────────────────────────

export const midiToFreq = (midi: number): number =>
  440 * Math.pow(2, (midi - 69) / 12);

export interface Chord {
  /** Basse (octave 2). */
  root: number;
  /** Voicing de la nappe (octaves 3–4). */
  voicing: number[];
}

/** Grilles de 4 mesures, en do majeur (une mesure par accord). */
export const PROGRESSIONS: Chord[][] = [
  // Fmaj7 – Em7 – Dm7 – Cmaj7
  [
    { root: 41, voicing: [53, 57, 60, 64] },
    { root: 40, voicing: [52, 55, 59, 62] },
    { root: 38, voicing: [50, 53, 57, 60] },
    { root: 36, voicing: [48, 52, 55, 59] },
  ],
  // Am7 – Dm7 – G7 – Cmaj7
  [
    { root: 45, voicing: [55, 57, 60, 64] },
    { root: 38, voicing: [53, 57, 60, 62] },
    { root: 43, voicing: [53, 55, 59, 62] },
    { root: 36, voicing: [52, 55, 59, 60] },
  ],
  // Dm7 – G7 – Em7 – Am7
  [
    { root: 38, voicing: [50, 53, 57, 60] },
    { root: 43, voicing: [53, 55, 59, 62] },
    { root: 40, voicing: [52, 55, 59, 62] },
    { root: 45, voicing: [52, 55, 57, 60] },
  ],
];

/** Gamme de la mélodie : do majeur pentatonique, octaves 5–6. */
export const MELODY_SCALE = [72, 74, 76, 79, 81, 84, 86, 88];

/**
 * Marche aléatoire dans la gamme : petits pas (−2..+2), bornés. `rand` ∈ [0,1).
 */
export const nextMelodyIndex = (prev: number, rand: number): number => {
  const step = Math.floor(rand * 5) - 2;
  return Math.max(0, Math.min(MELODY_SCALE.length - 1, prev + step));
};

// ── Synthèse ─────────────────────────────────────────────────────────────────

const BPM = 78;
const STEP = 60 / BPM / 2; // une croche
const STEPS_PER_BAR = 8;
const BARS_PER_PHRASE = 4;
const SWING = 0.16 * STEP; // croches impaires retardées
const LOOKAHEAD = 0.3;
const TICK_MS = 80;

interface MusicGraph {
  b: AudioBus;
  /** Entrée de la musique (fondu d'entrée / de sortie). */
  input: GainNode;
  reverb: GainNode;
  delay: GainNode;
  noise: AudioBuffer;
}

let graph: MusicGraph | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let nextTime = 0;
let stepIndex = 0;
let progression: Chord[] = PROGRESSIONS[0];
let drumsOn = false;
let melodyIndex = 3;

function makeImpulse(ctx: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
  }
  return buf;
}

function makeNoise(ctx: AudioContext): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function buildGraph(b: AudioBus): MusicGraph {
  const { ctx } = b;
  const input = ctx.createGain();
  input.gain.value = 0.0001;
  // Légère coupe des aigus sur tout le mix : son « cassette », moins fatigant.
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 5000;
  input.connect(tone).connect(b.music);

  const convolver = ctx.createConvolver();
  convolver.buffer = makeImpulse(ctx, 2.8);
  const reverbWet = ctx.createGain();
  reverbWet.gain.value = 0.32;
  const reverb = ctx.createGain();
  reverb.connect(convolver).connect(reverbWet).connect(input);

  const delayNode = ctx.createDelay(2);
  delayNode.delayTime.value = STEP * 1.5;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.32;
  const delayWet = ctx.createGain();
  delayWet.gain.value = 0.28;
  const delay = ctx.createGain();
  delay.connect(delayNode);
  delayNode.connect(feedback).connect(delayNode);
  delayNode.connect(delayWet).connect(input);

  return { b, input, reverb, delay, noise: makeNoise(ctx) };
}

/** Enveloppe ADSR simple sur un gain. */
function envelope(
  g: GainNode,
  t: number,
  peak: number,
  attack: number,
  hold: number,
  release: number,
): number {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  return t + attack + hold + release;
}

function pad(m: MusicGraph, chord: Chord, t: number): void {
  const { ctx } = m.b;
  const length = STEP * STEPS_PER_BAR;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(700, t);
  filter.frequency.linearRampToValueAtTime(1300, t + length * 0.6);
  filter.frequency.linearRampToValueAtTime(800, t + length + 1);
  const env = ctx.createGain();
  const end = envelope(env, t, 0.05, 0.9, length - 0.9, 1.4);
  filter.connect(env);
  env.connect(m.input);
  env.connect(m.reverb);
  for (const note of chord.voicing) {
    for (const detune of [-7, 7]) {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = midiToFreq(note);
      osc.detune.value = detune;
      osc.connect(filter);
      osc.start(t);
      osc.stop(end + 0.05);
    }
  }
}

function bass(m: MusicGraph, midi: number, t: number, dur: number): void {
  const { ctx } = m.b;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = midiToFreq(midi);
  const env = ctx.createGain();
  const end = envelope(env, t, 0.22, 0.02, dur * 0.6, dur * 0.4 + 0.2);
  osc.connect(env).connect(m.input);
  osc.start(t);
  osc.stop(end + 0.05);
}

function pluck(m: MusicGraph, midi: number, t: number, velocity: number): void {
  const { ctx } = m.b;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(3200, t);
  filter.frequency.exponentialRampToValueAtTime(900, t + 0.5);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(0.07 * velocity, t + 0.006);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  filter.connect(env);
  env.connect(m.input);
  env.connect(m.delay);
  env.connect(m.reverb);
  for (const [type, mult, level] of [
    ["triangle", 1, 1],
    ["sine", 2, 0.35],
  ] as const) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = midiToFreq(midi) * mult;
    const g = ctx.createGain();
    g.gain.value = level;
    osc.connect(g).connect(filter);
    osc.start(t);
    osc.stop(t + 1);
  }
}

function kick(m: MusicGraph, t: number): void {
  const { ctx } = m.b;
  const osc = ctx.createOscillator();
  osc.frequency.setValueAtTime(115, t);
  osc.frequency.exponentialRampToValueAtTime(42, t + 0.22);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(0.32, t + 0.005);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
  osc.connect(env).connect(m.input);
  osc.start(t);
  osc.stop(t + 0.35);
}

function noiseHit(
  m: MusicGraph,
  t: number,
  opts: { type: BiquadFilterType; freq: number; gain: number; decay: number },
): void {
  const { ctx } = m.b;
  const src = ctx.createBufferSource();
  src.buffer = m.noise;
  const filter = ctx.createBiquadFilter();
  filter.type = opts.type;
  filter.frequency.value = opts.freq;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(opts.gain, t + 0.004);
  env.gain.exponentialRampToValueAtTime(0.0001, t + opts.decay);
  src.connect(filter).connect(env).connect(m.input);
  // Départ aléatoire dans le tampon : chaque frappe a un grain différent.
  src.start(t, Math.random() * 0.5, opts.decay + 0.05);
}

function scheduleStep(m: MusicGraph, step: number, t: number): void {
  const inBar = step % STEPS_PER_BAR;
  const bar = Math.floor(step / STEPS_PER_BAR);
  const barInPhrase = bar % BARS_PER_PHRASE;
  const phrase = Math.floor(bar / BARS_PER_PHRASE);

  if (inBar === 0 && barInPhrase === 0) {
    progression =
      phrase === 0
        ? PROGRESSIONS[0]
        : PROGRESSIONS[Math.floor(Math.random() * PROGRESSIONS.length)];
    // Intro sans batterie, puis une phrase sur quatre en respiration.
    drumsOn = phrase > 0 && phrase % 4 !== 3;
  }
  const chord = progression[barInPhrase];
  const swung = inBar % 2 === 1 ? t + SWING : t;

  if (inBar === 0) {
    pad(m, chord, t);
    bass(m, chord.root, t, STEP * 3);
  }
  if (inBar === 5 && Math.random() < 0.6) bass(m, chord.root + 12, swung, STEP);
  if (inBar === 6 && Math.random() < 0.4) bass(m, chord.root + 7, t, STEP * 1.5);

  // Mélodie : plus clairsemée en fin de phrase, jamais sur l'intro complète.
  const density = barInPhrase === 3 ? 0.18 : 0.38;
  if (phrase > 0 || bar >= 2) {
    if (Math.random() < density) {
      melodyIndex = nextMelodyIndex(melodyIndex, Math.random());
      const accent = inBar % 2 === 0 ? 1 : 0.7;
      pluck(m, MELODY_SCALE[melodyIndex], swung, accent);
    }
  }

  if (drumsOn) {
    if (inBar === 0 || inBar === 4 || (inBar === 5 && Math.random() < 0.3)) {
      kick(m, swung);
    }
    if (inBar === 2 || inBar === 6) {
      noiseHit(m, t, { type: "bandpass", freq: 1700, gain: 0.09, decay: 0.18 });
    }
    noiseHit(m, swung, {
      type: "highpass",
      freq: 7000,
      gain: inBar % 2 === 0 ? 0.035 : 0.022,
      decay: 0.05,
    });
  }
}

function tick(): void {
  if (!graph) return;
  const { ctx } = graph.b;
  while (nextTime < ctx.currentTime + LOOKAHEAD) {
    scheduleStep(graph, stepIndex, nextTime);
    nextTime += STEP;
    stepIndex++;
  }
}

export const isMusicPlaying = (): boolean => timer !== null;

/** Lance la musique (fondu d'entrée). Sans effet si elle joue déjà. */
export function startMusic(): void {
  if (timer) return;
  const b = getAudioBus();
  if (!b) return;
  try {
    if (!graph) graph = buildGraph(b);
    const now = b.ctx.currentTime;
    graph.input.gain.cancelScheduledValues(now);
    graph.input.gain.setValueAtTime(Math.max(0.0001, graph.input.gain.value), now);
    graph.input.gain.exponentialRampToValueAtTime(1, now + 4);
    nextTime = now + 0.1;
    stepIndex = 0;
    melodyIndex = 3;
    timer = setInterval(tick, TICK_MS);
    tick();
  } catch {
    stopMusic();
  }
}

/** Arrête la musique (fondu de sortie court, les queues de réverb s'éteignent). */
export function stopMusic(): void {
  if (timer) clearInterval(timer);
  timer = null;
  if (!graph) return;
  const now = graph.b.ctx.currentTime;
  graph.input.gain.cancelScheduledValues(now);
  graph.input.gain.setValueAtTime(Math.max(0.0001, graph.input.gain.value), now);
  graph.input.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
}
