type Props = {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export default function Modal({ title, isOpen, onClose, children }: Props) {
  if (!isOpen) return null;
  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal__panel">
        <div className="modal__header">
          <h2>{title}</h2>
          <button className="btn btn--ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
