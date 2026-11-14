import { FC } from "react";

import { AvatarConfig, Employe, PersonType } from "@/data/interface";
import { avatarOf } from "@/data/utils/avatar";
import { AvatarArt } from "@/components/employe/AvatarArt";

/** Fond de la pastille par rôle : le métier se lit à la couleur de l'avatar. */
const ROLE_AVATAR_CLASS: Record<PersonType, string> = {
  [PersonType.PROD]: "bg-role-prod",
  [PersonType.QA]: "bg-role-qa",
  [PersonType.MARKETING]: "bg-role-marketing",
};

interface EmployeAvatarProps {
  employe: Pick<Employe, "firstName" | "lastName" | "personType"> & {
    avatar?: AvatarConfig;
  };
  /** Diamètre (px). */
  size?: number;
}

/**
 * Pastille ronde cerclée d'encre, teintée selon le rôle, où se tient le
 * buste dessiné de la personne (le sien, ou celui que son nom désigne).
 */
export const EmployeAvatar: FC<EmployeAvatarProps> = ({
  employe,
  size = 48,
}) => (
  <span
    aria-hidden="true"
    className={`block shrink-0 overflow-hidden rounded-full border-ink ${ROLE_AVATAR_CLASS[employe.personType] ?? "bg-base-300"}`}
    style={{ width: size, height: size, borderWidth: size >= 40 ? 3 : 2 }}
  >
    <AvatarArt avatar={avatarOf(employe)} size={size} />
  </span>
);
