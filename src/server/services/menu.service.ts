import type { PublicMenu, PublicMenuItem } from '../../shared/api-types.js';
import { LOW_STOCK_THRESHOLD, MAX_QTY_PER_ITEM } from '../../shared/limits.js';
import type { IstNow } from '../../shared/time.js';
import type { PrismaClient } from '../db.js';
import { fromDbDate } from '../lib/db-date.js';

/**
 * What the customer menu shows (Batch 3 §3). Read-only: stock is derived here, never written.
 * Stock counts only when it belongs to today's IST business date (Rule 4). Fields are mapped one
 * by one so `dailyStock`, `stockRemaining` and `stockDate` can never reach the response.
 */
export async function getPublicMenu(prisma: PrismaClient, today: IstNow): Promise<PublicMenu> {
  const [settings, rows] = await Promise.all([
    prisma.deliverySettings.findUniqueOrThrow({
      where: { id: 1 },
      select: { ordersPaused: true },
    }),
    prisma.menuItem.findMany({
      where: { isActive: true, isAvailable: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    }),
  ]);

  const orderable: PublicMenuItem[] = [];
  const soldOutItems: PublicMenuItem[] = [];

  for (const row of rows) {
    const soldOut =
      row.stockDate === null || fromDbDate(row.stockDate) !== today.date || row.stockRemaining <= 0;
    const item: PublicMenuItem = {
      id: row.id,
      name: row.name,
      description: row.description,
      price: row.price,
      imageUrl: row.imageUrl,
      soldOut,
      maxQty: soldOut ? 0 : Math.min(row.stockRemaining, MAX_QTY_PER_ITEM),
      onlyLeft: !soldOut && row.stockRemaining <= LOW_STOCK_THRESHOLD ? row.stockRemaining : null,
    };
    (soldOut ? soldOutItems : orderable).push(item);
  }

  return {
    businessDate: today.date,
    ordersPaused: settings.ordersPaused,
    items: [...orderable, ...soldOutItems],
  };
}
