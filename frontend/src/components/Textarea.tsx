type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
};

export default function Textarea({ label, error, id, ...props }: Props) {
  const inputId = id || `${label.replace(/\s+/g, "-").toLowerCase()}-textarea`;
  return (
    <label className="field" htmlFor={inputId}>
      <span className="field__label">{label}</span>
      <textarea id={inputId} className="field__input field__input--textarea" {...props} />
      {error ? <span className="field__error">{error}</span> : null}
    </label>
  );
}
