import {
  CSSProperties,
  ReactElement,
  useEffect,
  useRef,
  useState,
} from "react";

import { STUDIO_ASSET_ROOT } from "@/components/studio/isoStudio";

// Cache module-level : chaque SVG n'est fetché qu'une fois, partagé entre toutes
// les instances (une scène a beaucoup de dalles/overlays identiques).
const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

const loadSvg = (file: string): Promise<string> => {
  const cached = cache.get(file);
  if (cached !== undefined) return Promise.resolve(cached);
  const existing = inflight.get(file);
  if (existing) return existing;
  const p = fetch(`${STUDIO_ASSET_ROOT}${file}`)
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(r.statusText))))
    .then((text) => {
      cache.set(file, text);
      inflight.delete(file);
      return text;
    })
    .catch((err) => {
      inflight.delete(file);
      throw err;
    });
  inflight.set(file, p);
  return p;
};

interface InlineSvgProps {
  /** Chemin relatif à public/assets/studio/ (ex. "tiles/floor-a.svg"). */
  file: string;
  className?: string;
  style?: CSSProperties;
  /** --accent (recolor data-driven). */
  accent?: string;
  /** --morale-color (recolor data-driven). */
  moraleColor?: string;
  title?: string;
  /**
   * Pilotage data-driven du SVG après inline : reçoit l'élément hôte, permet de
   * régler les `#id` du markup (texte, largeurs, fill/opacity). Rejoué à chaque
   * changement de `drive` (passer une closure capturant les données courantes).
   */
  onReady?: (root: HTMLElement) => void;
}

/**
 * Inline un SVG du lot studio dans un wrapper, en posant les CSS custom properties
 * --accent / --morale-color (un <img> n'hérite pas des variables CSS de l'hôte).
 * Utilisé en flux (HUD, cartes, icônes) ; `IsoSvg` en est l'habillage absolu.
 */
export const InlineSvg = ({
  file,
  className,
  style,
  accent,
  moraleColor,
  title,
  onReady,
}: InlineSvgProps): ReactElement => {
  const [markup, setMarkup] = useState<string>(() => cache.get(file) ?? "");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    if (cache.has(file)) {
      setMarkup(cache.get(file) ?? "");
      return;
    }
    loadSvg(file)
      .then((text) => {
        if (active) setMarkup(text);
      })
      .catch(() => {
        /* asset manquant : on laisse le wrapper vide */
      });
    return () => {
      active = false;
    };
  }, [file]);

  // Pilotage data-driven : rejoué quand le markup arrive ou que `onReady` change
  // (le caller recrée la closure à chaque rendu pour refléter les données à jour).
  useEffect(() => {
    if (markup && ref.current && onReady) onReady(ref.current);
  }, [markup, onReady]);

  const mergedStyle: CSSProperties = { ...style };
  if (accent) (mergedStyle as Record<string, string>)["--accent"] = accent;
  if (moraleColor)
    (mergedStyle as Record<string, string>)["--morale-color"] = moraleColor;

  return (
    <div
      ref={ref}
      className={className}
      style={mergedStyle}
      title={title}
      aria-hidden={title ? undefined : true}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
};
