import { Icon } from './Icon';

interface QtyStepperProps {
  value: number;
  canIncrement: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
  incrementLabel: string;
  decrementLabel: string;
  /** Id of the element that explains why "+" is disabled (e.g. "Only 2 left"). */
  hintId?: string;
}

const STEP_BUTTON =
  'inline-flex size-12 items-center justify-center rounded-control border border-brand bg-surface text-brand transition-colors duration-150 hover:bg-gold-soft active:bg-gold-soft';

/**
 * [−] n [+] control. "+" uses aria-disabled rather than the disabled attribute so it stays
 * focusable and screen readers can read the reason (hintId) when the limit is reached.
 */
export function QtyStepper({
  value,
  canIncrement,
  onIncrement,
  onDecrement,
  incrementLabel,
  decrementLabel,
  hintId,
}: QtyStepperProps) {
  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        aria-label={decrementLabel}
        onClick={onDecrement}
        className={STEP_BUTTON}
      >
        <Icon name="minus" />
      </button>
      <output
        aria-live="polite"
        className="min-w-8 text-center text-base font-semibold tabular-nums"
      >
        {value}
      </output>
      <button
        type="button"
        aria-label={incrementLabel}
        aria-disabled={!canIncrement}
        aria-describedby={hintId}
        onClick={() => {
          if (canIncrement) onIncrement();
        }}
        className={`${STEP_BUTTON} aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-surface`}
      >
        <Icon name="plus" />
      </button>
    </div>
  );
}
