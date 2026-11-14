import { FC } from "react";
import { NavLink } from "react-router-dom";

import { TopMenuItem } from "@/data/interface";

interface SectionTabsProps {
  items: TopMenuItem[];
  /** Nom accessible de la barre d'onglets (ex. « Section Employés »). */
  ariaLabel: string;
}

/**
 * Sous-pages d'une section en onglets de classeur, posés sur le cadre de la
 * page qui suit (`toy-frame`) : l'onglet courant se fond dans le cadre.
 */
export const SectionTabs: FC<SectionTabsProps> = ({ items, ariaLabel }) => (
  <nav
    aria-label={ariaLabel}
    className="relative z-10 flex gap-1 pl-3 sm:gap-1.5 sm:pl-6"
  >
    {items.map((item) => (
      <NavLink
        key={item.link}
        to={item.link}
        // Une sous-page (ex. un dossier du Pôle Emploi) garde son onglet
        // actif, sauf pour l'entrée dont les autres sont des sous-chemins.
        end={items.some(
          (other) => other !== item && other.link.startsWith(item.link + "/"),
        )}
        className={({ isActive }) =>
          "-mb-[3px] min-w-0 truncate rounded-t-[0.9rem] border-[3px] px-2.5 py-1.5 font-display text-sm font-semibold whitespace-nowrap text-ink transition-colors sm:px-4 sm:text-[15px] " +
          (isActive
            ? "border-ink border-b-base-100 bg-base-100"
            : "border-ink bg-base-300 hover:bg-base-100")
        }
      >
        {item.name}
      </NavLink>
    ))}
  </nav>
);
