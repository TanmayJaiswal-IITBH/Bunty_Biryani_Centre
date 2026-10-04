import { MAX_LINES_PER_ORDER } from '@shared/limits.js';
import { Banner } from '../../../components/Banner';
import { Icon } from '../../../components/Icon';
import { copy } from '../../../copy';
import type { CartNotice } from './cart-reducer';

const c = copy.customer.cart;

function noticeText(notice: CartNotice): string {
  switch (notice.kind) {
    case 'clearedOldDay':
      return c.clearedOldDay;
    case 'removedUnavailable':
      return c.removedUnavailable(notice.name);
    case 'removedSoldOut':
      return c.removedSoldOut(notice.name);
    case 'capped':
      return c.capped(notice.available, notice.name);
    case 'lineCap':
      return c.lineCap(MAX_LINES_PER_ORDER);
  }
}

function DismissButton({ onDismiss }: { onDismiss: () => void }) {
  return (
    <button
      type="button"
      aria-label={c.dismiss}
      onClick={onDismiss}
      className="-my-2 -mr-2 inline-flex size-12 shrink-0 items-center justify-center rounded-control text-ink hover:bg-gold-soft active:bg-gold-soft"
    >
      <Icon name="x" />
    </button>
  );
}

interface CartNoticesProps {
  notices: CartNotice[];
  onDismiss: () => void;
}

/** The line-cap hint is its own info banner; every other notice shares one warning banner. */
export function CartNotices({ notices, onDismiss }: CartNoticesProps) {
  if (notices.length === 0) return null;
  const hasLineCap = notices.some((n) => n.kind === 'lineCap');
  const others = notices.filter((n) => n.kind !== 'lineCap');
  return (
    <>
      {others.length > 0 && (
        <Banner tone="warning" action={<DismissButton onDismiss={onDismiss} />} className="mb-3">
          <ul className="flex flex-col gap-1">
            {others.map((n, i) => (
              <li key={`${n.kind}-${i}`}>{noticeText(n)}</li>
            ))}
          </ul>
        </Banner>
      )}
      {hasLineCap && (
        <Banner tone="info" action={<DismissButton onDismiss={onDismiss} />} className="mb-3">
          {c.lineCap(MAX_LINES_PER_ORDER)}
        </Banner>
      )}
    </>
  );
}
