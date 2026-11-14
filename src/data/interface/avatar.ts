// ─────────────────────────────────────────────────────────────────────────────
// Avatar d'une personne : un buste dessiné maison, composé de parties
// interchangeables. Le dessin vit dans `components/employe/AvatarArt` ; ici,
// seulement le choix de chaque partie.
// ─────────────────────────────────────────────────────────────────────────────

export type AvatarFace = "rond" | "ovale" | "carre" | "pointu" | "large";
export type AvatarEyes =
  | "points"
  | "ronds"
  | "joyeux"
  | "endormis"
  | "cils"
  | "lunettes";
export type AvatarMouth = "sourire" | "rire" | "neutre" | "oh" | "coin";
export type AvatarHair =
  | "chauve"
  | "court"
  | "meche"
  | "herisse"
  | "bol"
  | "chignon"
  | "long"
  | "afro";

export interface AvatarConfig {
  face: AvatarFace;
  /** Teinte de peau (couleur CSS, cf. `AVATAR_SKINS`). */
  skin: string;
  eyes: AvatarEyes;
  mouth: AvatarMouth;
  hair: AvatarHair;
  /** Couleur des cheveux (couleur CSS, cf. `AVATAR_HAIR_COLORS`). */
  hairColor: string;
}
