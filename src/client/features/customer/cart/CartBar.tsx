import { formatINR } from '@shared/money.js';
import { Link } from 'react-router';
import { Icon } from '../../../components/Icon';
import { copy } from '../../../copy';

interface CartBarProps {
  count: number;
  subtotal: number;
  paused: boolean;
}

const c = copy.customer.cart;
const INNER = 'mx-auto flex h-14 max-w-120 items-center justify-between px-4 font-semibold';

/** Sticky bottom bar. While orders are paused it stays visible but is not a link. */
export function CartBar({ count, subtotal, paused }: CartBarProps) {
  if (count === 0) return null;
  const items = c.itemCount(count);
  const total = formatINR(subtotal);
  const summary = (
    <span className="tabular-nums">
      {items} · {total}
    </span>
  );
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-10 pb-[env(safe-area-inset-bottom)] shadow-bar ${
        paused ? 'bg-ink text-cream' : 'bg-brand text-on-brand'
      }`}
    >
      {paused ? (
        <div className={INNER}>
          {summary}
          <span>{c.paused}</span>
        </div>
      ) : (
        <Link to="/checkout" aria-label={c.checkoutLabel(items, total)} className={INNER}>
          {summary}
          <span className="inline-flex items-center gap-1">
            {c.checkout}
            <Icon name="chevron-right" />
          </span>
        </Link>
      )}
    </div>
  );
}
