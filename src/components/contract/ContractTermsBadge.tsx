import { FC } from "react";

import { StartedContract } from "@/data/interface";
import { CONTRACT_TERMS } from "@/data/utils/task";

const TONE = {
  souple: "bg-info/12 text-info",
  serre: "bg-warning/15 text-warning",
} as const;

/** Formule négociée d'un contrat signé ; rien pour un contrat standard. */
export const ContractTermsBadge: FC<{ contract: StartedContract }> = ({
  contract,
}) => {
  const terms = contract.terms;
  if (!terms || terms === "standard") return null;
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${TONE[terms]}`}
      title="Formule négociée à la signature"
    >
      {CONTRACT_TERMS[terms].label}
    </span>
  );
};
