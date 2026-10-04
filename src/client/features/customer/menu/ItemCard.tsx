import type { PublicMenuItem } from '@shared/api-types.js';
import { MAX_QTY_PER_ITEM } from '@shared/limits.js';
import { formatINR } from '@shared/money.js';
import { useState } from 'react';
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
  const [imageFailed, setImageFailed] = useState(false);
  const canIncrement = quantity < item.maxQty;
  const hintId = `max-hint-${item.id}`;
  const showHint = !item.soldOut && quantity > 0 && !canIncrement;

  return (
    <article className="rounded-card bg-surface p-3 shadow-card">
      <div className="flex gap-3">
        {item.imageUrl && !item.soldOut && !imageFailed ? (
          <img
            src={item.imageUrl}
            alt=""
            width={72}
            height={72}
            loading="lazy"
            decoding="async"
            onError={() => {
              setImageFailed(true);
            }}
            className="size-18 shrink-0 rounded-control object-cover"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 text-base font-semibold wrap-break-word">{item.name}</h3>
            <span className="price shrink-0">{formatINR(item.price)}</span>
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
            <Button variant="outline" aria-label={m.addLabel(item.name)} onClick={onAdd}>
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
                onDecrement?.();
              }}
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
