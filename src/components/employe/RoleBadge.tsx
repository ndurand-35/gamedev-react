import { FC } from "react";
import { Bug, Megaphone, User } from "iconoir-react";

import { PersonType } from "@/data/interface";

interface RoleBadgeStyle {
  label: string;
  badgeClass: string;
  Icon: typeof User;
}

// Modèle visuel partagé par rôle (cf. spec UX §1) : couleur DaisyUI + icône +
// libellé, consommé par PoleEmploye / EmployeList / EmployeModal pour éviter les
// divergences. La couleur n'est jamais seule porteuse d'info (badge + libellé).
export const ROLE_BADGE: Record<PersonType, RoleBadgeStyle> = {
  [PersonType.PROD]: {
    label: "Prod",
    badgeClass: "badge badge-ghost badge-sm",
    Icon: User,
  },
  [PersonType.QA]: {
    label: "QA",
    badgeClass: "badge badge-info badge-sm",
    Icon: Bug,
  },
  [PersonType.MARKETING]: {
    label: "Marketing",
    badgeClass: "badge badge-warning badge-sm",
    Icon: Megaphone,
  },
};

export const RoleBadge: FC<{ personType: PersonType }> = ({ personType }) => {
  const style = ROLE_BADGE[personType] ?? ROLE_BADGE[PersonType.PROD];
  const { label, badgeClass, Icon } = style;
  return (
    <span className={badgeClass + " gap-1"}>
      <Icon width={12} height={12} />
      {label}
    </span>
  );
};
