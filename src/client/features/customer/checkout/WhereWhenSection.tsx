import type { DeliveryOptions, DeliverySlotOption } from '@shared/api-types.js';
import type { DeliveryMode } from '@shared/enums.js';
import { formatINR } from '@shared/money.js';
import { formatTime12h } from '@shared/time.js';
import { useId, type ReactNode, type Ref } from 'react';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { RadioCard } from '../../../components/RadioCard';
import { FieldError } from '../../../components/TextField';
import { copy } from '../../../copy';
import { CardSkeletons } from './MethodSection';
import { cutoffHint, isExpressOpen, type ResolvedSelection } from './selection';

const c = copy.customer.checkout;

const slotLabel = (slot: DeliverySlotOption) =>
  c.slotTitle(slot.locationName, formatTime12h(slot.deliveryTime));

function justClosedSlot(resolved: ResolvedSelection | null): DeliverySlotOption | null {
  for (const notice of resolved?.notices ?? []) {
    if (notice.kind === 'slotJustClosed') return notice.slot;
  }
  return null;
}

/** "Order by 7:30 PM", or the countdown in the warning colour inside the last 30 minutes (§5.4). */
function SlotHint({
  slot,
  serverTime,
  elapsedMinutes,
}: {
  slot: DeliverySlotOption;
  serverTime: string;
  elapsedMinutes: number;
}) {
  const hint = cutoffHint(slot.cutoffTime, serverTime, elapsedMinutes);
  return hint.kind === 'closingSoon' ? (
    <span className="text-sm text-warning">{c.orderWithin(hint.minutes)}</span>
  ) : (
    <span className="text-sm font-normal text-ink-muted">
      {c.orderBy(formatTime12h(hint.cutoffTime))}
    </span>
  );
}

interface WhereWhenSectionProps {
  /** Scroll target for Try Express. */
  ref?: Ref<HTMLFieldSetElement>;
  /** Which list to show. */
  mode: DeliveryMode;
  /** Undefined while the options load. */
  options: DeliveryOptions | undefined;
  resolved: ResolvedSelection | null;
  /** Whole minutes since the options arrived, for the countdown. */
  elapsedMinutes: number;
  /** The slot error (Batch) or the location error (Express). */
  error: string | undefined;
  onChooseSlot: (slot: DeliverySlotOption) => void;
  onChooseExpressLocation: (locationId: number) => void;
  onTryExpress: (slot: DeliverySlotOption) => void;
}

/** Where & when (§5.4–§5.5): the batch slots or the express locations. */
export function WhereWhenSection({
  ref,
  mode,
  options,
  resolved,
  elapsedMinutes,
  error,
  onChooseSlot,
  onChooseExpressLocation,
  onTryExpress,
}: WhereWhenSectionProps) {
  const errorId = useId();
  const describedError = error ? errorId : undefined;

  let body: ReactNode;
  if (!options) {
    body = <CardSkeletons />;
  } else if (mode === 'BATCH') {
    const expressOpen = isExpressOpen(options);
    const closed = justClosedSlot(resolved);
    body = (
      <>
        {closed ? (
          <Banner tone="warning">
            <p>{c.slotJustClosed(slotLabel(closed))}</p>
            {expressOpen ? (
              <Button
                variant="secondary"
                className="mt-2"
                onClick={() => {
                  onTryExpress(closed);
                }}
              >
                {c.tryExpress}
              </Button>
            ) : null}
          </Banner>
        ) : null}
        <ul className="flex flex-col gap-3">
          {options.batch.slots.map((slot) => (
            <li key={slot.id}>
              <RadioCard
                name="slotId"
                value={String(slot.id)}
                checked={resolved?.slot?.id === slot.id}
                onChoose={() => {
                  onChooseSlot(slot);
                }}
                title={slotLabel(slot)}
                aside={
                  slot.isOpen ? (
                    <SlotHint
                      slot={slot}
                      serverTime={options.serverTime}
                      elapsedMinutes={elapsedMinutes}
                    />
                  ) : undefined
                }
                disabled={!slot.isOpen}
                reason={slot.closedReason === 'CLOSED_TODAY' ? c.slotClosedToday : c.slotClosed}
                errorId={describedError}
              />
              {/* Only when the location has no open slot left, else "closed" is misleading. */}
              {!slot.isOpen &&
              expressOpen &&
              !options.batch.slots.some((s) => s.isOpen && s.locationId === slot.locationId) ? (
                <div className="mt-2 flex flex-col items-start gap-2">
                  <p className="text-sm text-ink">{c.batchClosedExpressOpen(slot.locationName)}</p>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      onTryExpress(slot);
                    }}
                  >
                    {c.tryExpress}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        {error ? <FieldError id={errorId}>{error}</FieldError> : null}
      </>
    );
  } else {
    const { express } = options;
    body = (
      <>
        <p className="text-sm text-ink-muted">
          {c.expressInfo(express.etaText, formatINR(express.fee))}
        </p>
        <ul className="flex flex-col gap-3">
          {express.locations.map((location) => (
            <li key={location.id}>
              <RadioCard
                name="expressLocationId"
                value={String(location.id)}
                checked={resolved?.location?.id === location.id}
                onChoose={() => {
                  onChooseExpressLocation(location.id);
                }}
                title={location.name}
                errorId={describedError}
              />
            </li>
          ))}
        </ul>
        {error ? <FieldError id={errorId}>{error}</FieldError> : null}
      </>
    );
  }

  return (
    <fieldset ref={ref}>
      <legend>
        <h2 className="display text-lg">{c.whereWhenHeading}</h2>
      </legend>
      <div className="mt-3 flex flex-col gap-3">{body}</div>
    </fieldset>
  );
}
