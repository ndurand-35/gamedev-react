import { CSSProperties, ReactElement } from "react";

import {
  Candidate,
  ComponentType,
  PersonType,
  ProductionPerson,
} from "@/data/interface";
import { formatPrice } from "@/data/utils";
import { InlineSvg } from "@/components/studio/InlineSvg";
import {
  ACCENT_BY_COMPONENT,
  ACCENT_BY_ROLE,
  deriveRole,
} from "@/components/studio/isoStudio";

const ROLE_LABEL = {
  dev: "Développeur",
  designer: "Designer",
  qa: "QA",
  marketing: "Marketing",
} as const;

export const CANDIDATE_CARD_W = 190;
export const CANDIDATE_CARD_H = 112;

interface CandidateCardProps {
  candidate: Candidate;
  style?: CSSProperties;
  className?: string;
}

/**
 * Carte candidat diégétique (asset hud/candidate-card.svg) pilotée par le modèle
 * réel. Réutilisable côté recrutement (Pole Emploi) sans toucher au tableau de
 * gestion de masse.
 */
export const CandidateCard = ({
  candidate,
  style,
  className,
}: CandidateCardProps): ReactElement => {
  const role = deriveRole(candidate);
  const prod =
    candidate.personType === PersonType.PROD
      ? (candidate as ProductionPerson)
      : null;
  const specialty = prod?.specialty;
  const accent =
    specialty && specialty !== "FULLSTACK"
      ? ACCENT_BY_COMPONENT[specialty as ComponentType]
      : ACCENT_BY_ROLE[role];
  const roleText =
    role === "dev" || role === "designer"
      ? `${ROLE_LABEL[role]} · ${specialty ?? "Fullstack"}`
      : ROLE_LABEL[role];
  const done = !!candidate.revealedStats;

  const drive = (root: HTMLElement) => {
    const set = (id: string, text: string) => {
      const el = root.querySelector(`#${id}`);
      if (el) el.textContent = text;
    };
    set("name", `${candidate.firstName} ${candidate.lastName}`);
    set("role", roleText);
    set("expected", formatPrice(candidate.expectedSalary ?? candidate.salary));

    // Toggle de l'état d'entretien (Requis amber → Fait vert).
    const grp = root.querySelector("#interview");
    if (grp) {
      const txt = grp.querySelector("text");
      if (txt) txt.textContent = done ? "Profil vérifié" : "Entretien requis";
      const rect = grp.querySelector("rect");
      const dot = grp.querySelector("circle");
      const stroke = done ? "#22C55E" : "#F59E0B";
      const bg = done ? "#DCFCE7" : "#FEF3C7";
      const fg = done ? "#15803D" : "#B45309";
      rect?.setAttribute("fill", bg);
      rect?.setAttribute("stroke", stroke);
      dot?.setAttribute("fill", stroke);
      txt?.setAttribute("fill", fg);
    }
  };

  return (
    <InlineSvg
      file="hud/candidate-card.svg"
      accent={accent}
      className={className}
      style={{ width: CANDIDATE_CARD_W, height: CANDIDATE_CARD_H, ...style }}
      onReady={drive}
    />
  );
};
