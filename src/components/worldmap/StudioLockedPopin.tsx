import { FC, useEffect, useRef, useState } from "react";
import { Lock } from "iconoir-react";

import type { StudioLockedPopinProps } from "@/data/utils/studios";
import { studioUnlockProgress } from "@/data/utils/studios";
import { formatPrice } from "@/data/utils";

// ── MapMonde §4.2 — Pop-in « Studio verrouillé » (MYL-21, Stage 2) ───────────
// Pop-in MÉCANIQUE (elle porte des chiffres), distincte de l'aperçu carte-postale
// §4.1. Gabarit verrouillé avec l'éco :
//   • 1 SEULE jauge, et elle ne mesure QUE la réputation : clamp(peak/seuil,0,1).
//     Le cash n'est JAMAIS une 2ᵉ jauge → ligne de texte binaire « Coût … € ».
//   • sous-titre toujours affiché : « Réputation : {peak} / {seuil} ».
//   • bouton à 3 états (machine d'état ci-dessous) avec les indices texte exacts.
//   • le cadre pulse UNE fois quand la jauge atteint 100 % (studio ouvrable) —
//     gardé par prefers-reduced-motion (cf. index.css).
//
// Accessibilité : la jauge ne véhicule jamais l'info seule. Le ratio {peak}/{seuil}
// + l'état texte du bouton suffisent à comprendre la situation sans percevoir la
// couleur/longueur de barre. Présentationnel pur : le câblage state (statut,
// money, onUnlock → thunk unlockStudio) vient au Stage 3.

const labelId = (id: string) => `studio-locked-${id}`;

export const StudioLockedPopin: FC<StudioLockedPopinProps> = ({
  def,
  peakReputation,
  money,
  status,
  onUnlock,
}) => {
  const progress = studioUnlockProgress(peakReputation, def.reputationThreshold);
  const isFull = progress >= 1; // pic ≥ seuil → studio ouvrable
  const canAfford = money >= def.openingCost;
  const percent = Math.round(progress * 100);

  // ── Machine d'état du bouton (§4.2) ──────────────────────────────────────
  // status === "locked"      → peak < seuil : désactivé/neutre.
  // status === "unlockable"  → peak ≥ seuil ; selon le cash : actif/accent ou grisé.
  const canUnlock = status === "unlockable" && canAfford;

  // Pulse du cadre : une fois, à la transition locked → unlockable (jauge pleine).
  // On déclenche par effet en suivant le passage de `isFull` à true.
  const [pulse, setPulse] = useState(false);
  const wasFull = useRef(isFull);
  useEffect(() => {
    if (isFull && !wasFull.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 750);
      return () => clearTimeout(t);
    }
    wasFull.current = isFull;
  }, [isFull]);

  return (
    <article
      className={`card card-compact bg-base-100 shadow-lg border w-80 ${
        isFull ? "border-accent" : "border-base-300"
      } ${pulse ? "studio-frame-pulse" : ""}`}
      aria-labelledby={labelId(def.id)}
    >
      <div className="card-body gap-2">
        {/* Nom propre + zone (jamais « Studio AAA »). */}
        <header className="flex items-start justify-between gap-2">
          <h3
            id={labelId(def.id)}
            className="card-title text-base leading-tight flex items-center gap-1.5"
          >
            <Lock width={16} height={16} className="opacity-60 shrink-0" />
            {def.name}
          </h3>
          <span className="badge badge-ghost badge-sm shrink-0 capitalize">
            {def.zone}
          </span>
        </header>

        {/* Accroche §4.1 grisée tant que verrouillé (même texte que l'aperçu). */}
        <p className="text-sm opacity-50 leading-snug">{def.tagline}</p>

        <div className="divider my-0" />

        {/* Jauge réputation §4.2 — clamp(peak/seuil,0,1), mesure la SEULE réputation. */}
        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span className="opacity-70">Réputation requise</span>
            <span className="tabular-nums font-medium">
              {def.reputationThreshold}
            </span>
          </div>
          <progress
            className={`progress w-full ${isFull ? "progress-accent" : "progress-primary"}`}
            value={percent}
            max={100}
            aria-label={`Progression de réputation : ${peakReputation} sur ${def.reputationThreshold}`}
          />
          {/* Sous-titre toujours affiché — porte l'info sans dépendre de la barre. */}
          <p className="text-xs opacity-70 tabular-nums mt-0.5">
            Réputation : {peakReputation} / {def.reputationThreshold}
            <span className="opacity-60"> ({percent} %)</span>
          </p>
        </div>

        {/* Coût = LIGNE BINAIRE (jamais une 2ᵉ jauge). */}
        <p className="text-sm tabular-nums">
          Coût d'ouverture :{" "}
          <span className="font-medium">{formatPrice(def.openingCost)} €</span>
        </p>

        {/* Bouton à 3 états + indice texte exact de la spec. */}
        <div className="card-actions mt-1 flex-col items-stretch gap-1">
          <button
            type="button"
            className={`btn btn-sm w-full ${canUnlock ? "btn-accent" : "btn-disabled"}`}
            disabled={!canUnlock}
            aria-disabled={!canUnlock}
            onClick={canUnlock ? onUnlock : undefined}
          >
            {status === "unlockable"
              ? `Ouvrir — ${formatPrice(def.openingCost)} €`
              : "Réputation insuffisante"}
          </button>

          {/* Indice sous le bouton : dépend du verrou courant. */}
          {status === "locked" && (
            <p className="text-xs opacity-70 text-center">
              Atteins <strong>{def.reputationThreshold}</strong> de réputation
              pour débloquer ce studio.
            </p>
          )}
          {status === "unlockable" && !canAfford && (
            <p className="text-xs opacity-70 text-center">
              Fonds insuffisants (il manque{" "}
              <strong>{formatPrice(def.openingCost - money)} €</strong>).
            </p>
          )}
        </div>
      </div>
    </article>
  );
};
