import { formatBusinessDate } from '@shared/time.js';
import { useMemo } from 'react';
import { Banner } from '../../../components/Banner';
import { CustomerPage } from '../../../components/CustomerPage';
import { EmptyState } from '../../../components/EmptyState';
import { ErrorState } from '../../../components/ErrorState';
import { Skeleton } from '../../../components/Skeleton';
import { copy } from '../../../copy';
import { cartView } from '../cart/cart-reducer';
import { CartBar } from '../cart/CartBar';
import { CartNotices } from '../cart/CartNotices';
import { useCart } from '../cart/CartProvider';
import { ItemCard } from './ItemCard';
import { SoldOutList } from './SoldOutList';
import { useMenu } from './use-menu';

const m = copy.customer.menu;

function MenuSkeleton() {
  return (
    <div aria-busy="true" aria-label={copy.common.loading} className="flex flex-col gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-card bg-surface p-3 shadow-card">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="mt-2 h-4 w-full" />
          <Skeleton className="mt-3 ml-auto h-12 w-24" />
        </div>
      ))}
    </div>
  );
}

export function MenuPage() {
  const { cart, notices, add, increment, decrement, reconcile, dismissNotices } = useCart();
  // The only useMenu call on the page: SWR's onSuccess fires for the instance that fetched.
  const { data, error, mutate } = useMenu(reconcile);

  const quantities = useMemo(
    () => new Map(cart.lines.map((line) => [line.menuItemId, line.quantity])),
    [cart],
  );
  const view = useMemo(() => (data ? cartView(data, cart) : null), [data, cart]);

  if (!data || !view) {
    return (
      <CustomerPage>
        {error ? (
          <ErrorState
            title={m.loadErrorTitle}
            message={m.loadErrorMessage}
            onRetry={() => void mutate()}
          />
        ) : (
          <MenuSkeleton />
        )}
      </CustomerPage>
    );
  }

  const subline = m.subline(formatBusinessDate(data.businessDate));
  const pausedBanner = data.ordersPaused ? (
    <Banner tone="warning" className="mb-3">
      {m.paused}
    </Banner>
  ) : null;

  if (data.items.length === 0) {
    return (
      <CustomerPage subline={subline}>
        {pausedBanner}
        <EmptyState title={m.emptyTitle} message={m.emptyMessage} icon="clock" />
      </CustomerPage>
    );
  }

  const orderable = data.items.filter((item) => !item.soldOut);
  const soldOut = data.items.filter((item) => item.soldOut);

  return (
    <CustomerPage subline={subline} reserveCartBar>
      <h2 className="sr-only">{m.title}</h2>
      {pausedBanner}
      <CartNotices notices={notices} onDismiss={dismissNotices} />
      {orderable.length === 0 ? (
        <Banner tone="info" className="mb-3">
          {m.allSoldOut}
        </Banner>
      ) : null}
      <ul className="flex flex-col gap-3">
        {orderable.map((item) => (
          <li key={item.id}>
            <ItemCard
              item={item}
              quantity={quantities.get(item.id) ?? 0}
              onAdd={() => {
                add(item, data.businessDate);
              }}
              onIncrement={() => {
                increment(item);
              }}
              onDecrement={() => {
                decrement(item.id);
              }}
            />
          </li>
        ))}
      </ul>
      <SoldOutList items={soldOut} />
      <CartBar count={view.count} subtotal={view.subtotal} paused={data.ordersPaused} />
    </CustomerPage>
  );
}
