import { FC } from "react";

import { AvatarConfig } from "@/data/interface";
import {
  CHEEKS,
  EYE_PARTS,
  FACE_PARTS,
  HAIR_PARTS,
  MOUTH_PARTS,
  NECK,
  SHOULDERS,
  strokeFor,
} from "@/components/employe/avatarParts";

interface AvatarArtProps {
  avatar: AvatarConfig;
  /** Taille de rendu (px) : règle l'épaisseur du contour. */
  size: number;
}

/**
 * Le buste dessiné : cou, épaules, cheveux de derrière, oreilles, visage,
 * joues, yeux, bouche, cheveux de devant. Remplit son conteneur (carré).
 */
export const AvatarArt: FC<AvatarArtProps> = ({ avatar, size }) => {
  const face = FACE_PARTS[avatar.face] ?? FACE_PARTS.rond;
  const eyes = EYE_PARTS[avatar.eyes] ?? EYE_PARTS.points;
  const mouth = MOUTH_PARTS[avatar.mouth] ?? MOUTH_PARTS.sourire;
  const hair = HAIR_PARTS[avatar.hair] ?? HAIR_PARTS.court;
  return (
    <svg
      viewBox="0 0 100 100"
      width="100%"
      height="100%"
      aria-hidden="true"
      className="block"
    >
      <g
        stroke="var(--color-ink)"
        strokeWidth={strokeFor(size)}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path d={NECK} fill={avatar.skin} />
        <path d={SHOULDERS} fill="#fff" />
        {hair.back && <path d={hair.back} fill={avatar.hairColor} />}
        <path d={face.ears} fill={avatar.skin} />
        <path d={face.d} fill={avatar.skin} />
        <path d={CHEEKS} fill="#F08C8C" fillOpacity={0.45} stroke="none" />
        {eyes.white && <path d={eyes.white} fill="#fff" />}
        {eyes.fill && (
          <path d={eyes.fill} fill="var(--color-ink)" stroke="none" />
        )}
        {eyes.line && <path d={eyes.line} fill="none" />}
        {mouth.fill && <path d={mouth.fill} fill="var(--color-ink)" />}
        {mouth.line && <path d={mouth.line} fill="none" />}
        {hair.front && <path d={hair.front} fill={avatar.hairColor} />}
      </g>
    </svg>
  );
};
