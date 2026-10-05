import type { PublicMenuItem } from '@shared/api-types.js';
import { MAX_QTY_PER_ITEM } from '@shared/limits.js';
import { formatINR } from '@shared/money.js';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/Button';
import { Icon } from '../../../components/Icon';
import { QtyStepper } from '../../../components/QtyStepper';
import { copy } from '../../../copy';

interface ItemCardProps {
  item: PublicMenuItem;
  /** How many are in the cart. */
  quantity?: number;
  onAdd?: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
}

const m = copy.customer.menu;

export function ItemCard({ item, quantity = 0, onAdd, onIncrement, onDecrement }: ItemCardProps) {
  // Remember which URL failed, not just that one did, so a fixed `imageUrl` shows again.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const canIncrement = quantity < item.maxQty;
  const hintId = `max-hint-${item.id}`;
  const showHint = !item.soldOut && quantity > 0 && !canIncrement;
  // Sold-out text is muted with a colour token, not opacity, so it keeps ≥ 4.5:1 contrast (§4.4).
  const muted = item.soldOut ? 'text-ink-muted' : '';

  // Add and the stepper swap places, which unmounts the focused button. Only a tap on this card
  // sets `pendingFocus`, so a reconcile or another tab's cart never moves focus.
  const pendingFocus = useRef<'add' | 'increment' | null>(null);
  const prevQuantity = useRef(quantity);
  const addRef = useRef<HTMLButtonElement>(null);
  const incrementRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const target = pendingFocus.current;
    pendingFocus.current = null;
    const prev = prevQuantity.current;
    prevQuantity.current = quantity;
    if (target === 'increment' && prev === 0 && quantity > 0) incrementRef.current?.focus();
    else if (target === 'add' && prev > 0 && quantity === 0) addRef.current?.focus();
  });

  return (
    <article className="rounded-card bg-surface p-3 shadow-card">
      <div className="flex gap-3">
        {item.imageUrl && !item.soldOut && item.imageUrl !== failedSrc ? (
          <img
            src={item.imageUrl}
            alt=""
            width={72}
            height={72}
            loading="lazy"
            decoding="async"
            onError={() => {
              setFailedSrc(item.imageUrl);
            }}
            className="size-18 shrink-0 rounded-control object-cover"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className={`min-w-0 text-base font-semibold wrap-break-word ${muted}`}>
              {item.name}
            </h3>
            <span className={`price shrink-0 ${muted}`}>{formatINR(item.price)}</span>
          </div>
          {item.description ? (
            <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{item.description}</p>
          ) : null}
        </div>
      </div>

      {item.soldOut ? (
        <div className="mt-2">
          <span className="inline-flex items-center rounded-control bg-line px-2 py-1 text-sm font-medium text-ink">
            {m.soldOutChip}
          </span>
        </div>
      ) : (
        <div className="mt-2 flex min-h-12 items-center justify-between gap-3">
          {item.onlyLeft !== null ? (
            <span className="inline-flex items-center gap-1 rounded-control bg-warning-soft px-2 py-1 text-sm font-medium text-warning">
              <Icon name="alert" size={16} />
              {m.onlyLeft(item.onlyLeft)}
            </span>
          ) : (
            <span />
          )}
          {quantity === 0 ? (
            <Button
              ref={addRef}
              variant="outline"
              aria-label={m.addLabel(item.name)}
              onClick={() => {
                pendingFocus.current = 'increment';
                onAdd?.();
              }}
            >
              {m.add}
            </Button>
          ) : (
            <QtyStepper
              value={quantity}
              canIncrement={canIncrement}
              onIncrement={() => {
                onIncrement?.();
              }}
              onDecrement={() => {
                if (quantity <= 1) pendingFocus.current = 'add';
                onDecrement?.();
              }}
              incrementRef={incrementRef}
              incrementLabel={m.incrementLabel(item.name)}
              decrementLabel={m.decrementLabel(item.name)}
              hintId={showHint ? hintId : undefined}
            />
          )}
        </div>
      )}

      {showHint ? (
        <p id={hintId} className="mt-1 text-right text-sm text-ink-muted">
          {item.maxQty < MAX_QTY_PER_ITEM
            ? m.onlyLeft(item.maxQty)
            : m.maxPerOrder(MAX_QTY_PER_ITEM)}
        </p>
      ) : null}
    </article>
  );
}
