import { useId, type ComponentProps, type ReactNode } from 'react';
import { Icon } from './Icon';

interface TextFieldProps extends Omit<ComponentProps<'input'>, 'id'> {
  label: string;
  hint?: string;
  error?: string | undefined;
  /** Element shown inside the field's right edge, e.g. a show/hide button. */
  adornment?: ReactNode;
}

/** Visible label, optional hint, and an error with an icon (never colour alone). */
export function TextField({
  label,
  hint,
  error,
  adornment,
  className = '',
  ...rest
}: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

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
      {hint && !error && (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm font-medium text-danger">
          <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
