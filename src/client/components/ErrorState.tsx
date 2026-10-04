import { copy } from '../copy';
import { Button } from './Button';
import { Icon } from './Icon';

interface ErrorStateProps {
  title: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <Icon name="alert" size={24} />
      </span>
      <h2 className="display text-lg">{title}</h2>
      {message && <p className="text-ink-muted">{message}</p>}
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          {copy.common.tryAgain}
        </Button>
      )}
    </div>
  );
}
