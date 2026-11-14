import { useEffect, useSyncExternalStore } from "react";

import {
  AudioSettings,
  getAudioSettings,
  setAudioSuspended,
  subscribeAudioSettings,
  unlockAudio,
} from "@/audio/engine";
import { isMusicPlaying, startMusic, stopMusic } from "@/audio/music";
import { playClick, playToggle } from "@/audio/sfx";

/** Réglages audio courants, re-rendus à chaque changement. */
export const useAudioSettings = (): AudioSettings =>
  useSyncExternalStore(subscribeAudioSettings, getAudioSettings);

// Éléments dont le clic mérite un son. Les curseurs (range) et listes
// déroulantes n'en font pas : on les manipule en continu.
const CLICKABLE =
  'button, a[href], [role="button"], [role="tab"], summary, input[type="checkbox"], input[type="radio"]';

let unlocked = false;

const syncMusic = () => {
  const wantMusic = unlocked && getAudioSettings().music > 0;
  if (wantMusic && !isMusicPlaying()) startMusic();
  if (!wantMusic && isMusicPlaying()) stopMusic();
};

/**
 * Chef d'orchestre, monté une fois à la racine de l'app (menu compris) :
 * débloque l'audio au premier geste du joueur, sonorise les clics, démarre ou
 * coupe la musique selon le réglage, et se tait quand l'onglet est masqué.
 */
export function useAudioDirector(): void {
  useEffect(() => {
    // Politique d'autoplay : rien ne sonne avant un geste du joueur.
    const onFirstGesture = () => {
      unlocked = true;
      unlockAudio();
      syncMusic();
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const el = target?.closest?.(CLICKABLE);
      if (!el || el.matches(":disabled")) return;
      if (el instanceof HTMLInputElement) playToggle(el.checked);
      else playClick();
    };
    const onVisibility = () => setAudioSuspended(document.hidden);
    const unsubscribe = subscribeAudioSettings(syncMusic);

    document.addEventListener("pointerdown", onFirstGesture, { once: true });
    document.addEventListener("keydown", onFirstGesture, { once: true });
    document.addEventListener("click", onClick, true);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      unsubscribe();
      document.removeEventListener("pointerdown", onFirstGesture);
      document.removeEventListener("keydown", onFirstGesture);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
}
