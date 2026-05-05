interface TextInputProps {
  field: any;
  label: string;
}

export const TextInput: React.FC<TextInputProps> = ({ field, label }) => {
  return (
    <>
      <div className="label">
        <span className="label-text">{label}</span>
      </div>
      <input
        className="input input-bordered w-full text-black"
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
      />
    </>
  );
};
