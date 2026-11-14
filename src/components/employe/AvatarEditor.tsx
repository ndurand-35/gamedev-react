import { FC, ReactNode } from "react";
import { DiceFive } from "iconoir-react";

import { AvatarConfig, PersonType } from "@/data/interface";
import {
  AVATAR_EYES,
  AVATAR_FACES,
  AVATAR_HAIR_COLORS,
  AVATAR_HAIRS,
  AVATAR_MOUTHS,
  AVATAR_SKINS,
  AvatarOption,
  randomAvatar,
} from "@/data/utils/avatar";
import { EmployeAvatar } from "@/components/employe/EmployeAvatar";

interface AvatarEditorProps {
  value: AvatarConfig;
  onChange: (next: AvatarConfig) => void;
  /** Rôle de la personne : la couleur de fond des aperçus. */
  personType?: PersonType;
}

/** Aperçu d'une variante : l'avatar avec cette seule partie changée. */
const PREVIEW_SIZE = 50;

const Group: FC<{ title: string; children: ReactNode }> = ({
  title,
  children,
}) => (
  <fieldset role="radiogroup" className="min-w-0">
    <legend className="mb-2 font-display text-base font-semibold">
      {title}
    </legend>
    {children}
  </fieldset>
);

/**
 * Composer un avatar partie par partie. Chaque variante se montre appliquée à
 * l'avatar en cours ; peau et cheveux se choisissent en pastilles de couleur.
 */
export const AvatarEditor: FC<AvatarEditorProps> = ({
  value,
  onChange,
  personType = PersonType.PROD,
}) => {
  const variants = <K extends "face" | "eyes" | "mouth" | "hair">(
    key: K,
    options: AvatarOption<AvatarConfig[K]>[],
  ) => (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const checked = value[key] === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange({ ...value, [key]: o.id })}
            className={
              "flex w-[4.5rem] flex-col items-center gap-1 rounded-[0.9rem] border-ink px-1 pt-1.5 pb-1 transition-[translate,box-shadow] " +
              (checked
                ? "translate-y-0.5 border-[3px] bg-sun shadow-[0_1px_0_var(--color-ink)]"
                : "border-2 bg-white shadow-toy-sm hover:bg-base-100")
            }
          >
            <EmployeAvatar
              employe={{
                firstName: "",
                lastName: "",
                personType,
                avatar: { ...value, [key]: o.id },
              }}
              size={PREVIEW_SIZE}
            />
            <span className="text-xs font-extrabold">{o.label}</span>
          </button>
        );
      })}
    </div>
  );

  const swatches = (
    key: "skin" | "hairColor",
    options: AvatarOption<string>[],
  ) => (
    <div className="flex flex-wrap gap-2.5">
      {options.map((o) => {
        const checked = value[key] === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={o.label}
            title={o.label}
            onClick={() => onChange({ ...value, [key]: o.id })}
            className={
              "size-9 rounded-full border-[3px] border-ink transition-shadow " +
              (checked
                ? "shadow-[0_0_0_3px_var(--color-base-100),0_0_0_6px_var(--color-ink)]"
                : "shadow-toy-sm")
            }
            style={{ backgroundColor: o.id }}
          />
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => onChange(randomAvatar())}
        className="btn btn-primary btn-sm w-fit gap-1.5"
      >
        <DiceFive width={16} height={16} strokeWidth={2.2} />
        Au hasard
      </button>
      <Group title="Coupe de cheveux">{variants("hair", AVATAR_HAIRS)}</Group>
      <Group title="Yeux">{variants("eyes", AVATAR_EYES)}</Group>
      <Group title="Bouche">{variants("mouth", AVATAR_MOUTHS)}</Group>
      <Group title="Forme du visage">{variants("face", AVATAR_FACES)}</Group>
      <div className="flex flex-wrap gap-x-10 gap-y-4">
        <Group title="Peau">{swatches("skin", AVATAR_SKINS)}</Group>
        <Group title="Couleur des cheveux">
          {swatches("hairColor", AVATAR_HAIR_COLORS)}
        </Group>
      </div>
    </div>
  );
};
