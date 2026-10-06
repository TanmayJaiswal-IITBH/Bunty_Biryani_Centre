import type { PublicMenuItem } from '@shared/api-types.js';
import { formatINR } from '@shared/money.js';
import { useId, type Ref } from 'react';
import { QtyStepper } from '../../../components/QtyStepper';
import { FieldError } from '../../../components/TextField';
import { copy } from '../../../copy';
import type { CartNotice, CartView } from '../cart/cart-reducer';
import { CartNotices } from '../cart/CartNotices';

const c = copy.customer.checkout;
const m = copy.customer.menu;

interface OrderSectionProps {
  /** Focus target when a removed line leaves the focused button nowhere to be. */
  headingRef?: Ref<HTMLHeadingElement>;
  view: CartView;
  /** Today's menu items, for each line's stock limit. */
  items: readonly PublicMenuItem[];
  notices: CartNotice[];
  error: string | undefined;
  onIncrement: (item: PublicMenuItem) => void;
  onDecrement: (menuItemId: number) => void;
  onDismissNotices: () => void;
}

/** Your order (§5.2): reconcile notices, the lines with the menu's steppers, then Food. */
export function OrderSection({
  headingRef,
  view,
  items,
  notices,
  error,
  onIncrement,
  onDecrement,
  onDismissNotices,
}: OrderSectionProps) {
  const errorId = useId();
  const byId = new Map(items.map((item) => [item.id, item]));

  return (
    <section>
      <h2 ref={headingRef} tabIndex={-1} className="display mb-3 text-lg">
        {c.orderHeading}
      </h2>
      <CartNotices notices={notices} onDismiss={onDismissNotices} />
      <ul className="flex flex-col divide-y divide-line">
        {view.lines.map((line) => {
          const item = byId.get(line.menuItemId);
          if (!item) return null;
          return (
            <li key={line.menuItemId} className="flex items-center gap-2 py-2">
              <span className="min-w-0 flex-1 text-base font-semibold wrap-break-word">
                {line.name}
              </span>
              <QtyStepper
                value={line.quantity}
                canIncrement={line.quantity < item.maxQty}
                onIncrement={() => {
                  onIncrement(item);
                }}
                onDecrement={() => {
                  onDecrement(line.menuItemId);
                }}
                incrementLabel={m.incrementLabel(line.name)}
                decrementLabel={m.decrementLabel(line.name)}
              />
              <span className="price min-w-14 shrink-0 text-right whitespace-nowrap">
                {formatINR(line.lineTotal)}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 flex justify-end gap-6 border-t border-line pt-2">
        <span>{c.food}</span>
        <span className="price min-w-14 text-right whitespace-nowrap">
          {formatINR(view.subtotal)}
        </span>
      </p>
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </section>
  );
}
