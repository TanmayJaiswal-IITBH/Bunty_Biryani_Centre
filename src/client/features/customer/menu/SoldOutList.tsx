import type { PublicMenuItem } from '@shared/api-types.js';
import { copy } from '../../../copy';
import { ItemCard } from './ItemCard';

export function SoldOutList({ items }: { items: PublicMenuItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="display mb-3 text-sm text-ink-muted">{copy.customer.menu.soldOutHeading}</h2>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.id}>
            <ItemCard item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}
