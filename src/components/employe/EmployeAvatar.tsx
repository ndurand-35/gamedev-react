import { FC } from "react";

import { Employe, PersonType } from "@/data/interface";

/** Fond de la pastille par rôle : le métier se lit à la couleur de l'avatar. */
const ROLE_AVATAR_CLASS: Record<PersonType, string> = {
  [PersonType.PROD]: "bg-role-prod",
  [PersonType.QA]: "bg-role-qa",
  [PersonType.MARKETING]: "bg-role-marketing",
};

interface EmployeAvatarProps {
  employe: Pick<Employe, "firstName" | "lastName" | "personType">;
  /** Diamètre (px). */
  size?: number;
}

/** Pastille ronde aux initiales, cerclée d'encre, teintée selon le rôle. */
export const EmployeAvatar: FC<EmployeAvatarProps> = ({
  employe,
  size = 48,
}) => {
  const initials = (employe.firstName[0] ?? "") + (employe.lastName[0] ?? "");
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full border-ink font-display font-bold text-ink ${ROLE_AVATAR_CLASS[employe.personType] ?? "bg-base-300"}`}
      style={{
        width: size,
        height: size,
        borderWidth: size >= 40 ? 3 : 2,
        fontSize: Math.round(size * 0.38),
      }}
    >
      {initials.toUpperCase()}
    </span>
  );
};
