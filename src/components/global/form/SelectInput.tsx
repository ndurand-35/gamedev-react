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
    // `form-control` a disparu en daisyUI 5 : sans lui, un <label> reste
    // inline et le libellé se colle à gauche du select. On empile en flex-col
    // comme TextInput pour garder l'alignement des champs du formulaire.
    <div className="w-full flex flex-col">
      <div className="label">
        <span className="label-text">{label}</span>
      </div>
      <select
        className="select select-bordered w-full"
        value={field.state.value}
        onChange={(e) => field.handleChange(e.target.value)}
      >
        {children}
      </select>
    </div>
  );
};
