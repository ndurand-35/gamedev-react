import { useAppSelector } from "@/data/redux/hooks";
import { FounderSkillId, hasFounderSkill } from "@/data/utils/research";

/**
 * Le fondateur possède-t-il cette compétence ? Sert de garde aux aides
 * d'analyse de l'interface : sans la formation, l'outil ne s'affiche pas
 * (cf. `utils/research`).
 */
export const useFounderSkill = (id: FounderSkillId): boolean =>
  useAppSelector((s) => hasFounderSkill(s.research.acquired, id));
