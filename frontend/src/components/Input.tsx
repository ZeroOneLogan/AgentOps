type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export default function Input({ label, error, id, ...props }: Props) {
  const inputId = id || `${label.replace(/\s+/g, "-").toLowerCase()}-input`;
  return (
    <label className="field" htmlFor={inputId}>
      <span className="field__label">{label}</span>
      <input id={inputId} className="field__input" {...props} />
      {error ? <span className="field__error">{error}</span> : null}
    </label>
  );
}
