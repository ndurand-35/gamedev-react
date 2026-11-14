import { describe, it, expect } from "vitest";

import {
  DEFAULT_AUDIO_SETTINGS,
  getAudioSettings,
  parseAudioSettings,
  setAudioSettings,
} from "@/audio/engine";
import {
  MELODY_SCALE,
  PROGRESSIONS,
  midiToFreq,
  nextMelodyIndex,
  startMusic,
  stopMusic,
} from "@/audio/music";
import { playClick, playNotify, playToggle } from "@/audio/sfx";

describe("réglages audio", () => {
  it("retombe sur les valeurs par défaut si rien n'est stocké ou si c'est corrompu", () => {
    expect(parseAudioSettings(null)).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(parseAudioSettings("{pas du json")).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(parseAudioSettings('{"music":"fort"}')).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it("borne les volumes entre 0 et 1", () => {
    expect(parseAudioSettings('{"music":3,"sfx":-1}')).toEqual({
      music: 1,
      sfx: 0,
    });
  });

  it("persiste un changement et garde l'autre volume", () => {
    setAudioSettings({ music: 0.2 });
    const sfx = getAudioSettings().sfx;
    setAudioSettings({ sfx: 0.4 });
    expect(getAudioSettings()).toEqual({ music: 0.2, sfx: 0.4 });
    expect(parseAudioSettings(localStorage.getItem("audio-settings"))).toEqual({
      music: 0.2,
      sfx: 0.4,
    });
    expect(sfx).toBeGreaterThanOrEqual(0);
  });
});

describe("musique", () => {
  it("convertit les notes MIDI en fréquences", () => {
    expect(midiToFreq(69)).toBeCloseTo(440);
    expect(midiToFreq(60)).toBeCloseTo(261.63, 1);
  });

  it("garde la basse sous la nappe, sur des grilles de 4 mesures", () => {
    for (const progression of PROGRESSIONS) {
      expect(progression).toHaveLength(4);
      for (const chord of progression) {
        expect(chord.voicing).toHaveLength(4);
        expect(Math.min(...chord.voicing)).toBeGreaterThan(chord.root);
      }
    }
  });

  it("fait marcher la mélodie à petits pas, sans sortir de la gamme", () => {
    expect(nextMelodyIndex(0, 0)).toBe(0);
    expect(nextMelodyIndex(MELODY_SCALE.length - 1, 0.99)).toBe(
      MELODY_SCALE.length - 1,
    );
    for (let i = 0; i < 200; i++) {
      const prev = i % MELODY_SCALE.length;
      const next = nextMelodyIndex(prev, Math.random());
      expect(Math.abs(next - prev)).toBeLessThanOrEqual(2);
    }
  });
});

describe("sans Web Audio", () => {
  it("reste silencieux sans lever d'exception", () => {
    expect(() => {
      playClick();
      playToggle(true);
      playNotify("error");
      startMusic();
      stopMusic();
    }).not.toThrow();
  });
});
