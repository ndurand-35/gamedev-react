// ── Façade d'un studio, dessinée à partir de son type ────────────────────────
// Tracés SVG (repère 220 × 130, sol à y = 118) calculés depuis le type de
// local, ses niveaux et ses places. Pur : le composant `StudioFacade` se
// contente de peindre ces tracés.

import type { Building } from "@/data/interface";
import {
  STUDIO_KINDS,
  inferStudioKind,
  studioFloors,
} from "@/data/utils/studioListing";

export const FACADE_WIDTH = 220;
export const FACADE_HEIGHT = 130;
export const FACADE_GROUND = 118;

export interface FacadePaths {
  body: string;
  roof: string;
  windows: string;
  door: string;
  /** Traits fins : lames du rideau de garage, liston de la péniche. */
  lines: string;
  water: string;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

const roundedRect = (x: number, y: number, w: number, h: number, r: number) => {
  const k = Math.max(0.5, Math.min(r, w / 2, h / 2));
  return (
    `M${r1(x + k)} ${r1(y)}h${r1(w - 2 * k)}a${k} ${k} 0 0 1 ${k} ${k}` +
    `v${r1(h - 2 * k)}a${k} ${k} 0 0 1 ${-k} ${k}h${r1(-(w - 2 * k))}` +
    `a${k} ${k} 0 0 1 ${-k} ${-k}v${r1(-(h - 2 * k))}a${k} ${k} 0 0 1 ${k} ${-k}z`
  );
};

const circle = (cx: number, cy: number, r: number) =>
  `M${r1(cx - r)} ${r1(cy)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;

export const studioFacade = (
  b: Pick<Building, "kind" | "place" | "floors">,
): FacadePaths => {
  const G = FACADE_GROUND;
  const mid = FACADE_WIDTH / 2;
  const kind = inferStudioKind(b);
  const def = STUDIO_KINDS[kind];
  const out: FacadePaths = {
    body: "",
    roof: "",
    windows: "",
    door: "",
    lines: "",
    water: "",
  };

  if (def.roof === "boat") {
    const w = 150;
    const x0 = mid - w / 2;
    out.water = `M0 108H${FACADE_WIDTH}V${FACADE_HEIGHT}H0z`;
    out.body = `M${x0 - 8} 92H${x0 + w + 8}L${x0 + w - 8} 114H${x0 + 8}Z`;
    out.roof = roundedRect(x0 + w * 0.22, 66, w * 0.56, 26, 4);
    for (let p = 0; p < 4; p++)
      out.windows += circle(x0 + w * 0.3 + p * w * 0.13, 79, 4);
    out.lines = `M${x0 + 4} 100H${x0 + w - 4}`;
    return out;
  }

  const floors = studioFloors(b);
  const isGarage = kind === "GARAGE";
  const cols = Math.max(
    2,
    Math.min(7, Math.ceil(b.place / floors) + (def.roof === "saw" ? 0 : 1)),
  );
  const fh = isGarage ? 40 : Math.min(22, 86 / floors);
  const w = Math.min(196, def.roof === "saw" ? 60 + cols * 22 : 34 + cols * 22);
  const x0 = mid - w / 2;
  const top = G - floors * fh;

  out.body = `M${r1(x0)} ${r1(top)}h${r1(w)}V${G}H${r1(x0)}z`;
  if (def.roof === "flat") out.roof = roundedRect(x0 - 4, top - 7, w + 8, 7, 2);
  if (def.roof === "gable") {
    out.roof = `M${r1(x0 - 7)} ${r1(top)}L${mid} ${r1(top - 30)}L${r1(x0 + w + 7)} ${r1(top)}Z`;
  }
  if (def.roof === "saw") {
    const n = Math.max(2, Math.round(w / 34));
    const tw = w / n;
    let d = `M${r1(x0)} ${r1(top)}`;
    for (let s = 0; s < n; s++) {
      d += `L${r1(x0 + s * tw)} ${r1(top - 16)}L${r1(x0 + (s + 1) * tw)} ${r1(top)}`;
    }
    out.roof = `${d}Z`;
  }

  if (isGarage) {
    const gw = w * 0.62;
    const gx = mid - gw / 2;
    const gt = G - fh + 10;
    out.door = `M${r1(gx)} ${r1(gt)}h${r1(gw)}V${G}H${r1(gx)}z`;
    for (let g = 1; g < 5; g++) {
      out.lines += `M${r1(gx + 2)} ${r1(gt + (g * (G - gt)) / 5)}h${r1(gw - 4)}`;
    }
    return out;
  }

  const cw = (w - 12) / cols;
  const doorCol = Math.floor(cols / 2);
  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < cols; c++) {
      const wx = x0 + 6 + c * cw + 3;
      if (f === floors - 1 && c === doorCol) {
        const dh = Math.min(20, fh - 2);
        out.door = `M${r1(wx + (cw - 6) / 2 - 7)} ${r1(G - dh)}h14V${G}h-14z`;
        continue;
      }
      out.windows += roundedRect(
        wx,
        top + f * fh + 4,
        cw - 6,
        Math.max(5, fh - 9),
        2,
      );
    }
  }
  return out;
};
