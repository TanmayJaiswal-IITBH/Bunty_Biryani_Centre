import { useId, type ReactNode, type Ref } from 'react';

interface RadioCardProps {
  name: string;
  value: string;
  checked: boolean;
  onChoose: () => void;
  title: string;
  lines?: readonly string[];
  /** Right-aligned and never wrapped, e.g. a delivery charge. */
  aside?: ReactNode;
  /** Unavailable: stays focusable (`aria-disabled`, never `disabled`) and explains itself via `reason`. */
  disabled?: boolean;
  reason?: string;
  /** Id of a group-level error element to announce with this option. */
  errorId?: string;
  inputRef?: Ref<HTMLInputElement>;
}

/** A tappable option card around a real radio input. */
export function RadioCard({
  name,
  value,
  checked,
  onChoose,
  title,
  lines = [],
  aside,
  disabled = false,
  reason,
  errorId,
  inputRef,
}: RadioCardProps) {
  const reasonId = useId();
  const showReason = disabled && reason;
  const describedBy = [showReason ? reasonId : null, errorId].filter(Boolean).join(' ');

  return (
    <div
      className={`rounded-card border border-line bg-surface has-checked:border-brand ${
        disabled ? 'cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      <label className="flex min-h-12 items-start gap-3 p-3">
        <input
          type="radio"
          ref={inputRef}
          name={name}
          value={value}
          checked={checked}
          // A disabled option can't be chosen, but stays in the tab order so its reason is reachable.
          onChange={() => {
            if (!disabled) onChoose();
          }}
          aria-disabled={disabled || undefined}
          aria-describedby={describedBy || undefined}
          className="mt-0.5 size-5 shrink-0 accent-brand"
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={`text-base font-semibold ${disabled ? 'text-ink-muted' : 'text-ink'}`}>
            {title}
          </span>
          {lines.map((line) => (
            <span key={line} className="text-sm text-ink-muted">
              {line}
            </span>
          ))}
        </span>
        {aside != null && (
          <span className="shrink-0 text-right text-base font-semibold text-ink">{aside}</span>
        )}
      </label>
      {/* Outside the label: it is the input's description, so it must not also be its name. Its
          left padding lines it up with the title (card padding + radio + gap). */}
      {showReason && (
        <p id={reasonId} className="pr-3 pb-3 pl-11 text-sm font-medium text-ink-muted">
          {reason}
        </p>
      )}
    </div>
  );
}
