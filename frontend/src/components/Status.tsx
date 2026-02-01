import Button from "./Button";

type StatusProps = {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function LoadingState({ title = "Loading" }: { title?: string }) {
  return (
    <div className="status">
      <div className="spinner" aria-hidden="true" />
      <p>{title}…</p>
    </div>
  );
}

export function EmptyState({ title, message, actionLabel, onAction }: StatusProps) {
  return (
    <div className="status status--empty">
      <p className="status__title">{title}</p>
      {message ? <p className="status__message">{message}</p> : null}
      {actionLabel && onAction ? (
        <Button variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function ErrorState({ title, message, actionLabel, onAction }: StatusProps) {
  return (
    <div className="status status--error">
      <p className="status__title">{title}</p>
      {message ? <p className="status__message">{message}</p> : null}
      {actionLabel && onAction ? (
        <Button variant="secondary" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
