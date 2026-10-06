import type { DeliveryOptions } from '@shared/api-types.js';
import { deliverySummaryText } from './delivery-summary';

export function DeliverySummaryLine({ options }: { options: DeliveryOptions }) {
  return <p className="mb-3 text-sm text-ink-muted">{deliverySummaryText(options)}</p>;
}
