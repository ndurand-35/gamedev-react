import { MAX_STAT_POSSIBLE } from "@/data/utils";

interface RangeInputProps {
  label: string;
  field: any;
  min?: number;
  max?: number;
  /** Désactive le curseur (budget de points épuisé côté appelant, par ex.). */
  disabled?: boolean;
}

export const RangeInput: React.FC<RangeInputProps> = ({
  label,
  field,
  min = 0,
  max = MAX_STAT_POSSIBLE,
  disabled = false,
}) => {
  return (
    <div>
      <div className="flex flex-row justify-between">
        <span className="label-text">{label}</span>
        <span className="font-mono text-sm">
          {field.state.value} / {max}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={field.state.value}
        disabled={disabled}
        // Le champ alimente des calculs numériques (getRelevantStat, coût des
        // points) : on convertit ici, sinon la stat part en string dans Redux.
        onChange={(e) => field.handleChange(Number(e.target.value))}
        className="range range-sm range-primary"
      />
    </div>
  );
};
