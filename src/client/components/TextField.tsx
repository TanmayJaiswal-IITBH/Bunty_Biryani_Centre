import { useId, type ComponentProps, type ReactNode } from 'react';
import { Icon } from './Icon';

interface TextFieldProps extends Omit<ComponentProps<'input'>, 'id'> {
  label: string;
  hint?: string;
  /** Muted, right-aligned under the field, e.g. "101/120". */
  counter?: string;
  error?: string | undefined;
  /** Element shown inside the field's right edge, e.g. a show/hide button. */
  adornment?: ReactNode;
}

/** An error line: danger colour plus an icon, never colour alone. Also used under radio groups. */
export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-1.5 text-sm font-medium text-danger">
      <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** Visible label, optional hint, and an error with an icon (never colour alone). */
export function TextField({
  label,
  hint,
  counter,
  error,
  adornment,
  className = '',
  ...rest
}: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const counterId = `${id}-counter`;
  // The hint is hidden while an error shows, so only point at it when it renders.
  const showHint = hint && !error;
  const describedBy = [showHint ? hintId : null, error ? errorId : null, counter ? counterId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={[
            'block min-h-12 w-full rounded-control border bg-surface px-3 text-base text-ink placeholder:text-ink-muted',
            error ? 'border-danger' : 'border-line',
            adornment ? 'pr-12' : '',
            className,
          ].join(' ')}
          {...rest}
        />
        {adornment && (
          <div className="absolute inset-y-0 right-0 flex items-center">{adornment}</div>
        )}
      </div>
      {showHint && (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      )}
      {error && <FieldError id={errorId}>{error}</FieldError>}
      {counter && (
        <p id={counterId} className="text-right text-sm text-ink-muted">
          {counter}
        </p>
      )}
    </div>
  );
}
