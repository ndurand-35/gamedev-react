import {
  AvatarConfig,
  AvatarEyes,
  AvatarFace,
  AvatarHair,
  AvatarMouth,
} from "@/data/interface/avatar";

// ─────────────────────────────────────────────────────────────────────────────
// Choix proposés pour chaque partie de l'avatar, et tirage au hasard. Les
// recrues reçoivent un avatar tiré à leur génération ; une personne d'une
// sauvegarde plus ancienne en reçoit un dérivé de son nom, stable d'une
// partie à l'autre (et d'un candidat à l'employé qu'il devient).
// ─────────────────────────────────────────────────────────────────────────────

export interface AvatarOption<T extends string> {
  id: T;
  label: string;
}

export const AVATAR_FACES: AvatarOption<AvatarFace>[] = [
  { id: "rond", label: "Rond" },
  { id: "ovale", label: "Ovale" },
  { id: "carre", label: "Carré" },
  { id: "pointu", label: "Fin" },
  { id: "large", label: "Large" },
];

export const AVATAR_EYES: AvatarOption<AvatarEyes>[] = [
  { id: "points", label: "Points" },
  { id: "ronds", label: "Ronds" },
  { id: "joyeux", label: "Rieurs" },
  { id: "endormis", label: "Endormis" },
  { id: "cils", label: "Cils" },
  { id: "lunettes", label: "Lunettes" },
];

export const AVATAR_MOUTHS: AvatarOption<AvatarMouth>[] = [
  { id: "sourire", label: "Sourire" },
  { id: "rire", label: "Rire" },
  { id: "neutre", label: "Neutre" },
  { id: "oh", label: "Surpris" },
  { id: "coin", label: "En coin" },
];

export const AVATAR_HAIRS: AvatarOption<AvatarHair>[] = [
  { id: "chauve", label: "Chauve" },
  { id: "court", label: "Court" },
  { id: "meche", label: "Mèche" },
  { id: "herisse", label: "Hérissé" },
  { id: "bol", label: "Bol" },
  { id: "chignon", label: "Chignon" },
  { id: "long", label: "Long" },
  { id: "afro", label: "Afro" },
];

export const AVATAR_SKINS: AvatarOption<string>[] = [
  { id: "#FFE3C8", label: "Peau très claire" },
  { id: "#F5C9A0", label: "Peau claire" },
  { id: "#E2A877", label: "Peau mate" },
  { id: "#C4824F", label: "Peau hâlée" },
  { id: "#8E5A36", label: "Peau brune" },
  { id: "#5C3A24", label: "Peau foncée" },
];

/** Couleurs naturelles d'abord ; les deux dernières sont fantaisie. */
export const AVATAR_HAIR_COLORS: AvatarOption<string>[] = [
  { id: "#2B2420", label: "Noir" },
  { id: "#6B4226", label: "Brun" },
  { id: "#A8693A", label: "Châtain" },
  { id: "#D2602C", label: "Roux" },
  { id: "#F2C14E", label: "Blond" },
  { id: "#C2BBB1", label: "Gris" },
  { id: "#4F86E8", label: "Bleu" },
  { id: "#E86A9A", label: "Rose" },
];

const NATURAL_HAIR_COLORS = AVATAR_HAIR_COLORS.slice(0, 6);
const FANCY_HAIR_COLORS = AVATAR_HAIR_COLORS.slice(6);
/** Part des recrues aux cheveux fantaisie : une touche, pas la norme. */
const FANCY_HAIR_CHANCE = 0.12;

/** Tirage uniforme dans [0, 1[. */
export type Random = () => number;

const pick = <T extends string>(list: AvatarOption<T>[], random: Random): T =>
  list[Math.floor(random() * list.length)].id;

/** Un avatar complet tiré au hasard. */
export const randomAvatar = (random: Random = Math.random): AvatarConfig => ({
  face: pick(AVATAR_FACES, random),
  skin: pick(AVATAR_SKINS, random),
  eyes: pick(AVATAR_EYES, random),
  mouth: pick(AVATAR_MOUTHS, random),
  hair: pick(AVATAR_HAIRS, random),
  hairColor: pick(
    random() < FANCY_HAIR_CHANCE ? FANCY_HAIR_COLORS : NATURAL_HAIR_COLORS,
    random,
  ),
});

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
const seededRandom = (seed: number): Random => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Empreinte d'un texte (FNV-1a), pour semer le tirage. */
const hashText = (text: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

/** L'avatar d'une personne : le sien, ou celui que son nom désigne. */
export const avatarOf = (person: {
  firstName: string;
  lastName: string;
  avatar?: AvatarConfig;
}): AvatarConfig =>
  person.avatar ??
  randomAvatar(
    seededRandom(hashText(`${person.firstName} ${person.lastName}`)),
  );
