import { FC } from "react";
import { Star } from "iconoir-react";

import type { StudioPreviewPanelProps } from "@/data/utils/studios";

// ── MapMonde §4.1 — Panneau d'aperçu « carte-postale » (MYL-21, Stage 2) ─────
// Studio DÉBLOQUÉ, affiché au survol/sélection d'un pin allumé. Couche 1 = une
// accroche carte-postale (3ᵉ pers., sans chiffres : les chiffres viennent du
// state). Conteneur dimensionné 2 lignes / ~70 car. pour absorber « Le Garage »
// (67 car.) sans troncature ; les autres accroches tiennent sur 1 ligne.
//
// Présentationnel pur : aucune dépendance Redux/Three. Le câblage state (statut,
// réputation réelle) vient au Stage 3. Emplacement réservé pour la couche 2
// « Spécialité : … » (libellé éco/design différé, non maquetté).

export const StudioPreviewPanel: FC<StudioPreviewPanelProps> = ({
  def,
  reputation,
}) => {
  return (
    <article
      className="card card-compact bg-base-100 shadow-md border border-base-300 w-72"
      aria-label={`Aperçu du studio ${def.name}`}
    >
      <div className="card-body">
        {/* Nom propre + zone : jamais « Studio AAA » (Lore §0). */}
        <header className="flex items-start justify-between gap-2">
          <h3 className="card-title text-base leading-tight">{def.name}</h3>
          <span className="badge badge-success badge-sm gap-1 shrink-0">
            <Star width={12} height={12} />
            Ouvert
          </span>
        </header>

        {/* Accroche carte-postale §4.1 — conteneur 2 lignes / ~70 car. */}
        <p className="text-sm opacity-80 leading-snug min-h-[2.5rem]">
          {def.tagline}
        </p>

        {/* Couche 2 « Spécialité » différée : emplacement réservé, non maquetté
            (dépend d'un libellé mécanique éco/design pas encore livré). On ne
            rend la couche réputation que si la donnée optionnelle est fournie. */}
        {reputation !== undefined && (
          <p className="text-xs opacity-60 tabular-nums">
            Réputation du lieu : {reputation}
          </p>
        )}
      </div>
    </article>
  );
};
