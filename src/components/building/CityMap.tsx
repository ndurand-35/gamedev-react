import { FC, ReactElement, useMemo } from "react";

import {
  CITY_MAP_HEIGHT,
  CITY_MAP_WIDTH,
  CityBlock,
  CityPlan,
} from "@/data/utils/city";

const INK = "var(--color-ink)";
const WATER = "#D3E2E2";
const PARK = "#DCE5CB";
const TREE = "#C5D6AD";
/** Une teinte papier par quartier : on les distingue sans les colorer. */
const DISTRICT_TONES = ["#E9DCC6", "#EFE4D1", "#E3D5BC", "#ECDFC8", "#E6D8C0"];

export type CityPinVariant = "listing" | "over" | "owned";

export interface CityPin {
  id: number;
  lot: number;
  variant: CityPinVariant;
  /** Texte de la pastille (places) ; les locaux possédés montrent une maison. */
  text?: string;
  label: string;
  ariaLabel: string;
}

interface CityMapProps {
  plan: CityPlan;
  pins: CityPin[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

const blockPath = ({ x, y, w, h }: CityBlock, r = 9) => {
  const k = Math.min(r, w / 2, h / 2);
  return (
    `M${r1(x + k)} ${r1(y)}h${r1(w - 2 * k)}a${k} ${k} 0 0 1 ${k} ${k}` +
    `v${r1(h - 2 * k)}a${k} ${k} 0 0 1 ${-k} ${k}h${r1(-(w - 2 * k))}` +
    `a${k} ${k} 0 0 1 ${-k} ${-k}v${r1(-(h - 2 * k))}a${k} ${k} 0 0 1 ${k} ${-k}z`
  );
};

/** Quelques arbres par parc, toujours aux mêmes endroits pour un îlot donné. */
const treesPath = (b: CityBlock) => {
  let d = "";
  for (let n = 0; n < 4; n++) {
    const fx = ((b.id * 37 + n * 53) % 100) / 100;
    const fy = ((b.id * 61 + n * 29) % 100) / 100;
    const r = 5 + ((b.id + n) % 4);
    const cx = b.x + 12 + fx * Math.max(0, b.w - 24);
    const cy = b.y + 12 + fy * Math.max(0, b.h - 24);
    d += `M${r1(cx - r)} ${r1(cy)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
  }
  return d;
};

const pinHead: Record<CityPinVariant, string> = {
  listing: "bg-sun shadow-[0_3px_0_var(--color-ink)]",
  over: "border-dashed bg-base-100",
  owned: "bg-ink text-base-100",
};

/**
 * Plan d'une ville générée : îlots teintés par quartier, parcs, rivière et
 * ponts, avec une pastille par studio (annonce ou locaux possédés).
 */
export const CityMap: FC<CityMapProps> = ({
  plan,
  pins,
  selectedId,
  onSelect,
}): ReactElement => {
  const layers = useMemo(() => {
    const tones = DISTRICT_TONES.map(() => "");
    let parks = "";
    let trees = "";
    for (const b of plan.blocks) {
      if (b.park) {
        parks += blockPath(b);
        trees += treesPath(b);
      } else {
        tones[b.district % tones.length] += blockPath(b);
      }
    }
    const bridges = plan.bridges
      .map((br) => `M${r1(br.x)} ${r1(br.y)}h${r1(br.w)}v${br.h}h${r1(-br.w)}z`)
      .join("");
    const rails = plan.bridges
      .map(
        (br) =>
          `M${r1(br.x)} ${r1(br.y)}v${br.h}M${r1(br.x + br.w)} ${r1(br.y)}v${br.h}`,
      )
      .join("");
    return { tones, parks, trees, bridges, rails };
  }, [plan]);

  const selectedPin = pins.find((p) => p.id === selectedId);
  const selectedBlock = selectedPin ? plan.blocks[selectedPin.lot] : undefined;

  return (
    // Deux couches : le plan, rogné par le cadre arrondi, et les pastilles,
    // libres d'en déborder (un studio en haut du plan reste lisible).
    <div
      className="relative"
      style={{ aspectRatio: `${CITY_MAP_WIDTH} / ${CITY_MAP_HEIGHT}` }}
    >
      <div className="absolute inset-0 overflow-hidden rounded-[1.1rem] border-[3px] border-ink bg-base-100">
        <svg
          viewBox={`0 0 ${CITY_MAP_WIDTH} ${CITY_MAP_HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          className="absolute inset-0 block h-full w-full"
        >
          {layers.tones.map((d, i) => (
            <path
              key={i}
              d={d}
              fill={DISTRICT_TONES[i]}
              stroke={INK}
              strokeWidth={3}
              strokeLinejoin="round"
            />
          ))}
          <path
            d={layers.parks}
            fill={PARK}
            stroke={INK}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <path d={layers.trees} fill={TREE} stroke={INK} strokeWidth={2} />
          {selectedBlock && (
            <path
              d={blockPath(selectedBlock)}
              fill={
                selectedPin?.variant === "owned"
                  ? "var(--color-base-300)"
                  : "#FFE08A"
              }
              stroke={INK}
              strokeWidth={4}
              strokeLinejoin="round"
            />
          )}
          <path d={plan.river} fill="none" stroke={INK} strokeWidth={76} />
          <path d={plan.river} fill="none" stroke={WATER} strokeWidth={70} />
          <path
            d={plan.river}
            fill="none"
            stroke="color-mix(in oklab, var(--color-ink) 18%, transparent)"
            strokeWidth={2}
            strokeDasharray="10 18"
            strokeLinecap="round"
          />
          <path d={layers.bridges} fill="var(--color-base-100)" />
          <path d={layers.rails} fill="none" stroke={INK} strokeWidth={3} />
        </svg>

        {plan.districts.map((d) => (
          <span
            key={d.name}
            aria-hidden="true"
            className="pointer-events-none absolute z-[1] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-display text-[11px] font-semibold uppercase tracking-[0.15em] text-ink/60 sm:text-[13px]"
            style={{
              left: `${(d.x / CITY_MAP_WIDTH) * 100}%`,
              top: `${(d.y / CITY_MAP_HEIGHT) * 100}%`,
              textShadow:
                "0 0 3px var(--color-base-100), 0 0 3px var(--color-base-100), 0 0 3px var(--color-base-100)",
            }}
          >
            {d.name}
          </span>
        ))}
      </div>

      {pins.map((p) => {
        const block = plan.blocks[p.lot];
        if (!block) return null;
        const selected = p.id === selectedId;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            aria-label={p.ariaLabel}
            aria-pressed={selected}
            title={p.ariaLabel}
            className={`group absolute flex -translate-x-1/2 -translate-y-full cursor-pointer flex-col items-center focus-visible:outline-none ${selected ? "z-[5]" : "z-[2] hover:z-[4]"}`}
            style={{
              left: `${(block.cx / CITY_MAP_WIDTH) * 100}%`,
              top: `${(block.cy / CITY_MAP_HEIGHT) * 100}%`,
            }}
          >
            <span
              className={`flex h-8 min-w-8 items-center justify-center rounded-full border-[3px] border-ink px-1.5 font-display text-sm font-bold transition-transform group-hover:-translate-y-0.5 group-focus-visible:outline-3 group-focus-visible:outline-offset-2 group-focus-visible:outline-accent sm:h-9 sm:min-w-9 sm:text-[15px] ${pinHead[p.variant]} ${selected ? "scale-[1.18] shadow-[0_0_0_4px_var(--color-base-100),0_0_0_7px_var(--color-ink)]" : ""}`}
            >
              {p.variant === "owned" ? <HouseIcon /> : p.text}
            </span>
            <span className="h-2.5 w-[3px] rounded-b-sm bg-ink" />
            <span
              className={`absolute top-full left-1/2 mt-1 -translate-x-1/2 whitespace-nowrap rounded-full border-2 border-ink px-2 py-0.5 text-xs font-extrabold ${selected ? "block bg-ink text-base-100" : "hidden bg-base-100 group-hover:block group-focus-visible:block"}`}
            >
              {p.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

const HouseIcon: FC = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 11l9-7 9 7" />
    <path d="M5 10v10h14V10" />
    <path d="M10 20v-6h4v6" />
  </svg>
);
