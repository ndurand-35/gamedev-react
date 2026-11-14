// ── Dialogue d'entretien ────────────────────────────────────────────────────
// Le texte qui défile pendant un entretien mené par le fondateur. Chaque
// réplique du candidat s'appuie sur son profil (séniorité, niveau, trait,
// tempérament) : la conversation laisse deviner ce que la révélation va
// confirmer. Formulations neutres en genre. Logique pure.

import {
  ComponentType,
  Person,
  PersonType,
  ProductionPerson,
  TraitId,
} from "@/data/interface";
import { computeCandidateLevel } from "@/data/utils/recruitment";

export interface DialogueLine {
  speaker: "founder" | "candidate";
  text: string;
  /** Moment d'apparition, en fraction de la durée de l'entretien (0..1). */
  at: number;
}

const domainOf = (p: Person): string => {
  if (p.personType === PersonType.QA) return "les tests";
  if (p.personType === PersonType.MARKETING) return "le marketing";
  switch ((p as ProductionPerson).specialty) {
    case ComponentType.CODE:
      return "le code";
    case ComponentType.VISUEL:
      return "le graphisme";
    case ComponentType.UX:
      return "l'UX";
    default:
      return "le jeu vidéo";
  }
};

const introOf = (p: Person): string => {
  const domain = domainOf(p);
  switch (p.seniority) {
    case "junior":
      return `Je débute dans ${domain}, mais j'apprends très vite.`;
    case "confirme":
      return `Ça fait quelques années que je travaille dans ${domain}.`;
    case "senior":
      return `J'ai une longue carrière dans ${domain} derrière moi.`;
    default:
      return `Je travaille dans ${domain} depuis un moment.`;
  }
};

const skillsOf = (p: Person): string => {
  const level = computeCandidateLevel(p);
  if (level < 0.3) return "Voilà… j'ai encore des lacunes, mais je progresse.";
  if (level < 0.6) return "Voici mes derniers projets, plutôt solides je crois.";
  return "Tenez, mon portfolio : quelques projets qui ont très bien marché.";
};

const MOTIVATION: Record<TraitId, string> = {
  perfectionniste: "Un endroit où l'on prend le temps de bien faire les choses.",
  rapide: "Du rythme ! J'aime quand ça avance vite.",
  autodidacte: "Apprendre. Je me forme beaucoup de mon côté.",
  mentor: "Une équipe à qui transmettre ce que je sais.",
  bouteEnTrain: "Une bonne ambiance ! J'adore les repas d'équipe.",
  rabatJoie: "Bof… surtout pas un open space bruyant comme le dernier.",
  fidele: "Un studio où m'installer pour longtemps.",
  mercenaire: "Franchement ? Le meilleur poste du moment.",
};

const SALARY: Record<string, string> = {
  loyal: "Je suis assez souple, on trouvera un terrain d'entente.",
  ambitieux: "Je sais ce que je vaux, et je ne descendrai pas beaucoup.",
  cameleon: "Ça dépend… voyons d'abord ce que vous proposez.",
};

// Variantes des questions du fondateur, choisies par l'id du candidat : stables
// d'un rendu à l'autre, différentes d'un entretien à l'autre.
const pick = (options: string[], seed: number): string =>
  options[Math.abs(seed) % options.length];

/** Le dialogue complet d'un entretien, dans l'ordre d'apparition. */
export const interviewDialogue = (p: Person): DialogueLine[] => {
  const trait = p.traits?.[0];
  return [
    {
      speaker: "founder",
      text: pick(
        [
          `Bonjour ${p.firstName}, bienvenue au studio ! Présentez-vous en quelques mots ?`,
          `Bonjour ${p.firstName}, merci d'être là. Parlez-moi un peu de vous ?`,
        ],
        p.id,
      ),
      at: 0,
    },
    { speaker: "candidate", text: introOf(p), at: 0.1 },
    {
      speaker: "founder",
      text: pick(
        [
          "Montrez-moi ce que vous savez faire.",
          "On passe à un petit exercice pratique ?",
        ],
        p.id + 1,
      ),
      at: 0.25,
    },
    { speaker: "candidate", text: skillsOf(p), at: 0.35 },
    {
      speaker: "founder",
      text: "Qu'est-ce que vous recherchez chez nous ?",
      at: 0.5,
    },
    {
      speaker: "candidate",
      text: trait ? MOTIVATION[trait] : "Un projet qui me motive.",
      at: 0.6,
    },
    {
      speaker: "founder",
      text: "Parlons salaire : quelles sont vos attentes ?",
      at: 0.72,
    },
    {
      speaker: "candidate",
      text: SALARY[p.temperament ?? "loyal"] ?? SALARY.loyal,
      at: 0.82,
    },
    {
      speaker: "founder",
      text: "Merci, j'ai tout ce qu'il me faut.",
      at: 0.94,
    },
  ];
};
