import { FC } from "react";

import {
  AvatarConfig,
  ComponentType,
  Employe,
  PersonType,
  Specialty,
} from "@/data/interface";
import { avatarOf } from "@/data/utils/avatar";
import { AvatarArt } from "@/components/employe/AvatarArt";

/**
 * Fond de la pastille selon la fonction : le métier se lit à la couleur de
 * l'avatar. En production, c'est la spécialité (teinte claire du composant) ;
 * ailleurs, le rôle.
 */
const SPECIALTY_AVATAR_CLASS: Record<Specialty, string> = {
  FULLSTACK: "bg-role-fullstack",
  [ComponentType.CODE]: "bg-code-soft",
  [ComponentType.VISUEL]: "bg-visuel-soft",
  [ComponentType.UX]: "bg-ux-soft",
};

const ROLE_AVATAR_CLASS: Record<PersonType, string> = {
  [PersonType.PROD]: "bg-role-prod",
  [PersonType.QA]: "bg-role-qa",
  [PersonType.MARKETING]: "bg-role-marketing",
};

type AvatarPerson = Pick<Employe, "firstName" | "lastName" | "personType"> & {
  avatar?: AvatarConfig;
  specialty?: Specialty;
};

const avatarBackground = (p: AvatarPerson): string => {
  if (p.personType === PersonType.PROD) {
    return (
      SPECIALTY_AVATAR_CLASS[p.specialty ?? "FULLSTACK"] ??
      ROLE_AVATAR_CLASS[PersonType.PROD]
    );
  }
  return ROLE_AVATAR_CLASS[p.personType] ?? "bg-base-300";
};

interface EmployeAvatarProps {
  employe: AvatarPerson;
  /** Diamètre (px). */
  size?: number;
}

/**
 * Pastille ronde cerclée d'encre, teintée selon la fonction, où se tient le
 * buste dessiné de la personne (le sien, ou celui que son nom désigne).
 */
export const EmployeAvatar: FC<EmployeAvatarProps> = ({
  employe,
  size = 48,
}) => (
  <span
    aria-hidden="true"
    className={`block shrink-0 overflow-hidden rounded-full border-ink ${avatarBackground(employe)}`}
    style={{ width: size, height: size, borderWidth: size >= 40 ? 3 : 2 }}
  >
    <AvatarArt avatar={avatarOf(employe)} size={size} />
  </span>
);
