import { MAX_STAT_POSSIBLE } from "@/data/utils";

interface RangeInputProps {
  label: string;
  field: any;
}

export const RangeInput: React.FC<RangeInputProps> = ({ label, field }) => {
  return (
    <div>
      <div className="flex flex-row justify-between">
        <span className="label-text">{label}</span>
        <span>Niveau : {field.state.value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={MAX_STAT_POSSIBLE}
        value={field.state.value}
        onChange={(e) => field.handleChange(e.target.value)}
        className="range range-sm"
      />
      <div className="flex w-full justify-between text-sm px-2">
        {Array.from({ length: MAX_STAT_POSSIBLE + 1 }, (_, index) => index).map(
          (i: number) => (
            <span
              key={i}
              className={
                " " + (i % 5 == 0 ? "font-bold text-black" : "text-gray-300")
              }
            >
              |
            </span>
          ),
        )}
      </div>
    </div>
  );
};
