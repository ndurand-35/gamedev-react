interface SelectInputProps {
  label: string;
  field: any;
  children: React.ReactNode;
}

export const SelectInput: React.FC<SelectInputProps> = ({
  label,
  field,
  children,
}) => {
  return (
    <label className="form-control w-full">
      <div className="label">
        <span className="label-text">{label}</span>
      </div>
      <select
        className="select select-bordered"
        value={field.state.value}
        onChange={(e) => field.handleChange(e.target.value)}
      >
        {children}
      </select>
    </label>
  );
};
