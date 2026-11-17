import { FC } from "react";

import { CodexLink } from "@/components/codex/CodexLink";
import {
  COMPATIBILITY_CLASS,
  COMPATIBILITY_SIGN,
} from "@/components/employe/compatibilityStyle";
import { useFounderSkill } from "@/data/hooks/useFounderSkill";
import { useAppSelector } from "@/data/redux/hooks";
import { Building, Person } from "@/data/interface";
import {
  CHARACTER_TYPES,
  COMPATIBILITY_LABEL,
  ambianceMorale,
  characterOf,
  personCompatibility,
} from "@/data/utils/compatibility";
import { FOUNDER_ID } from "@/data/utils/research";

const initials = (p: Person) =>
  `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase();

/** Grille des ententes d'un bâtiment : chaque occupant face à chaque autre. */
const BuildingGrid: FC<{ building: Building; employes: Person[] }> = ({
  building,
  employes,
}) => {
  const people = employes.filter(
    (e) => e.buildingId === building.id && e.leaveUntil == null,
  );
  if (people.length < 2) return null;
  return (
    <section
      aria-label={`Ententes : ${building.name}`}
      className="toy-tile space-y-2 p-4"
    >
      <h3 className="font-display text-base font-semibold">{building.name}</h3>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-1 text-xs">
          <thead>
            <tr>
              <th />
              {people.map((p) => (
                <th
                  key={p.id}
                  scope="col"
                  title={`${p.firstName} ${p.lastName}`}
                  className="w-8 font-extrabold text-base-content/70"
                >
                  {initials(p)}
                </th>
              ))}
              <th
                scope="col"
                className="pl-2 text-left font-extrabold text-base-content/70"
              >
                Moral / mois
              </th>
            </tr>
          </thead>
          <tbody>
            {people.map((row) => {
              const delta = ambianceMorale(row, employes);
              return (
                <tr key={row.id}>
                  <th
                    scope="row"
                    className="pr-2 text-left font-bold whitespace-nowrap"
                  >
                    {row.firstName} {row.lastName}
                    <span className="font-semibold text-base-content/60">
                      {" "}
                      · {CHARACTER_TYPES[characterOf(row)].label}
                    </span>
                  </th>
                  {people.map((col) => {
                    if (col.id === row.id) {
                      return (
                        <td
                          key={col.id}
                          aria-hidden
                          className="size-8 rounded-md bg-base-300/50"
                        />
                      );
                    }
                    const level = personCompatibility(row, col);
                    return (
                      <td
                        key={col.id}
                        title={`${row.firstName} et ${col.firstName} : ${COMPATIBILITY_LABEL[level]}`}
                        className={
                          "size-8 rounded-md border-2 text-center font-black " +
                          COMPATIBILITY_CLASS[level]
                        }
                      >
                        <span className="sr-only">
                          {COMPATIBILITY_LABEL[level]}
                        </span>
                        <span aria-hidden>{COMPATIBILITY_SIGN[level]}</span>
                      </td>
                    );
                  })}
                  <td
                    className={
                      "pl-2 font-extrabold whitespace-nowrap tabular-nums " +
                      (row.id === FOUNDER_ID
                        ? "text-base-content/50"
                        : delta < 0
                          ? "text-error"
                          : delta > 0
                            ? "text-success"
                            : "text-base-content/60")
                    }
                  >
                    {row.id === FOUNDER_ID
                      ? "fondateur"
                      : delta === 0
                        ? "0"
                        : `${delta > 0 ? "+" : "−"}${Math.abs(delta)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

/**
 * Ententes de chaque bâtiment occupé. Rien sans la formation « Climat
 * social » : le joueur ne voit alors que le moral bouger.
 */
export const CompatibilityGrids: FC = () => {
  const known = useFounderSkill("social_climate");
  const buildings = useAppSelector((s) => s.company.buildingList);
  const employes = useAppSelector((s) => s.employe.employeList);
  if (!known) return null;
  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-1.5 font-display text-xl font-semibold">
        Ententes par bâtiment <CodexLink id="caracteres" />
      </h2>
      {buildings.some(
        (b) =>
          employes.filter((e) => e.buildingId === b.id && e.leaveUntil == null)
            .length >= 2,
      ) ? (
        buildings.map((b) => (
          <BuildingGrid key={b.id} building={b} employes={employes} />
        ))
      ) : (
        <p className="text-sm font-semibold text-base-content/70">
          Aucun bâtiment n'accueille encore deux personnes.
        </p>
      )}
    </div>
  );
};
