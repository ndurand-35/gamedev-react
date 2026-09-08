// ── MapMonde — Convention d'échelle du globe (MYL-19, Stage 2) ───────────────
// Le rayon du globe est DÉFINI PAR LE CODE (contrat pour le lot Asset MYL-20) :
// l'asset .glb et les pins doivent se poser sur cette même sphère via
// `latLonToVec3(lat, lon, GLOBE_RADIUS)`. Unités world R3F (sans dimension).

/** Rayon de la sphère monde. Toute géométrie (placeholder ou .glb) s'y aligne. */
export const GLOBE_RADIUS = 1.5;

/** Décalage radial des pins au-dessus de la surface (évite le z-fighting). */
export const PIN_SURFACE_OFFSET = 0.04;
