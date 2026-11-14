import { FC } from "react";
import { MusicDoubleNote, SoundHigh } from "iconoir-react";

import { setAudioSettings } from "@/audio/engine";
import { useAudioSettings } from "@/audio/useAudioDirector";

const Slider: FC<{
  label: string;
  icon: JSX.Element;
  value: number;
  onChange: (v: number) => void;
}> = ({ label, icon, value, onChange }) => (
  <label className="toy-tile flex items-center gap-3 px-4 py-3 text-sm font-bold">
    <span className="flex w-24 items-center gap-2">
      {icon}
      {label}
    </span>
    <input
      type="range"
      min={0}
      max={100}
      step={5}
      value={Math.round(value * 100)}
      onChange={(e) => onChange(Number(e.target.value) / 100)}
      className="range range-sm range-primary flex-1"
      aria-label={`Volume ${label.toLowerCase()}`}
    />
    <span className="w-12 text-right font-extrabold text-base-content/70 tabular-nums">
      {Math.round(value * 100)} %
    </span>
  </label>
);

/** Onglet Son : volumes de la musique et des effets. */
export const AudioSettings: FC = () => {
  const { music, sfx } = useAudioSettings();
  return (
    <div className="space-y-2.5">
      <Slider
        label="Musique"
        icon={<MusicDoubleNote width={16} height={16} />}
        value={music}
        onChange={(v) => setAudioSettings({ music: v })}
      />
      <Slider
        label="Effets"
        icon={<SoundHigh width={16} height={16} />}
        value={sfx}
        onChange={(v) => setAudioSettings({ sfx: v })}
      />
    </div>
  );
};
