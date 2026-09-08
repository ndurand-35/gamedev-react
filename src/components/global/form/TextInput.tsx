interface TextInputProps {
  field: any;
  label: string;
  placeholder?: string;
}

export const TextInput: React.FC<TextInputProps> = ({
  field,
  label,
  placeholder,
}) => {
  const errors: string[] = field.state.meta.errors ?? [];
  const showError = field.state.meta.isTouched && errors.length > 0;

  return (
    <>
      <div className="label">
        <span className="label-text">{label}</span>
      </div>
      <input
        className={
          "input input-bordered w-full text-black" +
          (showError ? " input-error" : "")
        }
        placeholder={placeholder}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
      />
      {showError && (
        <p className="text-error text-xs mt-1">{errors.join(", ")}</p>
      )}
    </>
  );
};
