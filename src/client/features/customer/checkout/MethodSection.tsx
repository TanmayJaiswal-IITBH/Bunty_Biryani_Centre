import type { DeliveryOptions, ExpressOptions } from '@shared/api-types.js';
import type { DeliveryMode } from '@shared/enums.js';
import { formatINR } from '@shared/money.js';
import { formatWindow } from '@shared/time.js';
import { useId, type ReactNode } from 'react';
import { Banner } from '../../../components/Banner';
import { ErrorState } from '../../../components/ErrorState';
import { RadioCard } from '../../../components/RadioCard';
import { Skeleton } from '../../../components/Skeleton';
import { FieldError } from '../../../components/TextField';
import { copy } from '../../../copy';
import { isBatchOpen, isExpressOpen } from './selection';

const c = copy.customer.checkout;

function expressReason(express: ExpressOptions): string {
  return express.unavailableReason === 'OUTSIDE_HOURS'
    ? c.expressHours(formatWindow(express.opensAt, express.closesAt))
    : c.expressUnavailable;
}

/** Two placeholder cards while delivery options load (§10). */
export function CardSkeletons() {
  return (
    <>
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </>
  );
}

interface MethodSectionProps {
  /** Undefined until the first successful fetch. */
  options: DeliveryOptions | undefined;
  /** The fetch failed and there is no data to show. */
  loadFailed: boolean;
  retrying: boolean;
  onRetry: () => void;
  /** The method that is still valid, so the checked card. */
  mode: DeliveryMode | null;
  /** The chosen Express stopped being available (§6). */
  expressUnavailableNotice: boolean;
  error: string | undefined;
  onChoose: (mode: DeliveryMode) => void;
}

/** Delivery method (§5.3): Batch or Express, each explaining itself when it can't be chosen. */
export function MethodSection({
  options,
  loadFailed,
  retrying,
  onRetry,
  mode,
  expressUnavailableNotice,
  error,
  onChoose,
}: MethodSectionProps) {
  const errorId = useId();
  const describedError = error ? errorId : undefined;

  let body: ReactNode;
  if (!options) {
    body = loadFailed ? (
      <ErrorState title={c.optionsError} onRetry={onRetry} retrying={retrying} />
    ) : (
      <CardSkeletons />
    );
  } else {
    const { express } = options;
    body = (
      <>
        {expressUnavailableNotice ? <Banner tone="warning">{c.expressUnavailable}</Banner> : null}
        <RadioCard
          name="deliveryMode"
          value="BATCH"
          checked={mode === 'BATCH'}
          onChoose={() => {
            onChoose('BATCH');
          }}
          title={c.batchTitle}
          lines={c.batchLines}
          disabled={!isBatchOpen(options)}
          reason={c.noBatchOpen}
          errorId={describedError}
        />
        <RadioCard
          name="deliveryMode"
          value="EXPRESS"
          checked={mode === 'EXPRESS'}
          onChoose={() => {
            onChoose('EXPRESS');
          }}
          title={c.expressTitle}
          lines={[c.expressEta(express.etaText), c.expressFee(formatINR(express.fee))]}
          disabled={!isExpressOpen(options)}
          reason={expressReason(express)}
          errorId={describedError}
        />
        {error ? <FieldError id={errorId}>{error}</FieldError> : null}
      </>
    );
  }

  return (
    <fieldset>
      <legend>
        <h2 className="display text-lg">{c.methodHeading}</h2>
      </legend>
      <div className="mt-3 flex flex-col gap-3">{body}</div>
    </fieldset>
  );
}
