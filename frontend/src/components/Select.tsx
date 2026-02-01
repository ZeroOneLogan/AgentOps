type Option = { value: string; label: string };

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: Option[];
  error?: string;
};

export default function Select({ label, options, error, id, ...props }: Props) {
  const inputId = id || `${label.replace(/\s+/g, "-").toLowerCase()}-select`;
  return (
    <label className="field" htmlFor={inputId}>
      <span className="field__label">{label}</span>
      <select id={inputId} className="field__input" {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <span className="field__error">{error}</span> : null}
    </label>
  );
}
