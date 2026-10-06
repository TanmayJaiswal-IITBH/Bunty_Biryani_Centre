import type { DeliveryOptions } from '@shared/api-types.js';
import { formatINR } from '@shared/money.js';
import { formatTime12h } from '@shared/time.js';
import { copy } from '../../../copy';
import { isExpressOpen } from '../checkout/selection';

const text = copy.deliverySummary;

/** The muted line under the menu header (Batch 4 §8): open slots, then the express offer if any. */
export function deliverySummaryText(options: DeliveryOptions): string {
  const open = options.batch.slots.filter((slot) => slot.isOpen);
  const batch =
    open.length === 0
      ? text.batchClosed
      : text.batch(
          open
            .map((slot) => text.slot(slot.locationName, formatTime12h(slot.deliveryTime)))
            .join(' · '),
        );
  const { express } = options;
  if (!isExpressOpen(options)) return batch;
  return `${batch} — ${text.express(express.etaMinMinutes, express.etaMaxMinutes, formatINR(express.fee))}`;
}
