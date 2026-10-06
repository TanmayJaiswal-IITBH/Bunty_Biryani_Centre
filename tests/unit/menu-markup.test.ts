// Static-markup checks for the customer menu (Batch 3 §15 follow-ups); helpers in tests/helpers/markup.
import { createElement as h } from 'react';
import { SWRConfig } from 'swr';
import { describe, expect, it } from 'vitest';
import type { InitialEntry } from 'react-router';
import type { DeliveryOptions, PublicMenu } from '../../src/shared/api-types';
import { BackToMenuLink } from '../../src/client/components/BackToMenuLink';
import { ErrorState } from '../../src/client/components/ErrorState';
import { copy } from '../../src/client/copy';
import { CART_STORAGE_KEY } from '../../src/client/features/customer/cart/cart-storage';
import { CartProvider } from '../../src/client/features/customer/cart/CartProvider';
import { CART_EMPTY_STATE } from '../../src/client/features/customer/cart/cart-empty';
import { DELIVERY_OPTIONS_KEY } from '../../src/client/features/customer/checkout/use-delivery-options';
import { deliverySummaryText } from '../../src/client/features/customer/menu/delivery-summary';
import { ItemCard } from '../../src/client/features/customer/menu/ItemCard';
import { MenuPage } from '../../src/client/features/customer/menu/MenuPage';
import { MENU_KEY } from '../../src/client/features/customer/menu/use-menu';
import { opts } from '../helpers/delivery-fixtures';
import { classesOf, escaped, item, render, withWindowStorage } from '../helpers/markup';

interface MenuPageExtras {
  /** Seeds the delivery-options SWR cache; omitted means the fetch is still pending. */
  delivery?: DeliveryOptions;
  initialEntries?: InitialEntry[];
}

function renderMenuPage(menu?: PublicMenu, extras: MenuPageExtras = {}): string {
  const fallback = {
    ...(menu ? { [MENU_KEY]: menu } : {}),
    ...(extras.delivery ? { [DELIVERY_OPTIONS_KEY]: { ...extras.delivery, receivedAt: 0 } } : {}),
  };
  const value = { provider: () => new Map(), fallback };
  return render(h(SWRConfig, { value }, h(CartProvider, null, h(MenuPage))), extras.initialEntries);
}

/** MenuPage with SWR's cache entry for the menu seeded directly (e.g. a failed fetch). */
function renderMenuPageFromCache(state: { error: Error; isValidating: boolean }): string {
  const value = { provider: () => new Map<string, object>([[MENU_KEY, state]]) };
  return render(h(SWRConfig, { value }, h(CartProvider, null, h(MenuPage))));
}

const H3 = /<h3 class="([^"]*)"/;
const PRICE = /<span class="(price[^"]*)"/;

describe('ItemCard', () => {
  it("mutes a sold-out card's name and price", () => {
    const html = render(
      h(ItemCard, { item: item({ name: 'Egg Biryani', price: 120, soldOut: true, maxQty: 0 }) }),
    );
    expect(classesOf(html, H3)).toEqual(
      expect.arrayContaining(['text-ink-muted', 'wrap-break-word']),
    );
    expect(classesOf(html, PRICE)).toContain('text-ink-muted');
  });

  it('keeps orderable cards in full ink', () => {
    const html = render(h(ItemCard, { item: item() }));
    expect(classesOf(html, H3)).not.toContain('text-ink-muted');
    expect(classesOf(html, PRICE)).not.toContain('text-ink-muted');
  });
});

describe('MenuPage', () => {
  it('renders no empty list when everything is sold out', () => {
    const html = renderMenuPage({
      businessDate: '2026-10-04',
      ordersPaused: true,
      items: [
        item({ id: 1, soldOut: true, maxQty: 0 }),
        item({ id: 2, name: 'Egg Biryani', soldOut: true, maxQty: 0 }),
      ],
    });
    expect(html.match(/<ul\b/g)).toHaveLength(1);
  });

  it('stacks the paused and all-sold-out banners above the sold-out list', () => {
    const html = renderMenuPage({
      businessDate: '2026-10-04',
      ordersPaused: true,
      items: [item({ id: 1, soldOut: true, maxQty: 0 })],
    });
    const paused = html.indexOf(copy.customer.menu.paused);
    const allSoldOut = html.indexOf(escaped(copy.customer.menu.allSoldOut));
    const heading = html.indexOf(`>${copy.customer.menu.soldOutHeading}</h2>`);
    expect(paused).toBeGreaterThan(-1);
    expect(allSoldOut).toBeGreaterThan(paused);
    expect(heading).toBeGreaterThan(allSoldOut);
  });

  it('shows a busy Try again while a retry is in flight', () => {
    const html = renderMenuPageFromCache({ error: new Error('offline'), isValidating: true });
    expect(html).toContain(escaped(copy.customer.menu.loadErrorTitle));
    expect(html).toContain('aria-busy="true"');
    expect(html).toMatch(/<button[^>]*\sdisabled=""/);
  });

  it('shows an enabled Try again between retries', () => {
    const html = renderMenuPageFromCache({ error: new Error('offline'), isValidating: false });
    expect(html).toContain(escaped(copy.customer.menu.loadErrorTitle));
    expect(html).not.toContain('aria-busy');
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""/);
  });

  it('renders the orderable list and the sold-out list', () => {
    const html = renderMenuPage({
      businessDate: '2026-10-04',
      ordersPaused: false,
      items: [item({ id: 1 }), item({ id: 2, name: 'Egg Biryani', soldOut: true, maxQty: 0 })],
    });
    expect(html.match(/<ul\b/g)).toHaveLength(2);
  });

  it('skeleton announces loading through a status element', () => {
    const html = renderMenuPage();
    expect(html).toMatch(/role="status"[^>]*>Loading…</);
    expect(html).not.toContain('aria-label="Loading…"');
    expect(html).not.toContain('aria-busy');
  });
});

describe('MenuPage delivery summary', () => {
  const menu: PublicMenu = {
    businessDate: '2026-10-04',
    ordersPaused: false,
    items: [item()],
  };
  const noItems: PublicMenu = { ...menu, items: [] };

  it('shows the delivery summary once the options are loaded', () => {
    const html = renderMenuPage(menu, { delivery: opts() });
    expect(html).toContain(deliverySummaryText(opts()));
  });

  it('shows the summary on a menu with no items too', () => {
    const html = renderMenuPage(noItems, { delivery: opts() });
    expect(html).toContain(deliverySummaryText(opts()));
  });

  it('hides the summary while the options have not loaded; the menu does not wait', () => {
    const html = renderMenuPage(menu);
    expect(html).not.toContain('Batch:');
    expect(html).toContain('Chicken Biryani');
  });
});

describe('MenuPage empty-cart notice', () => {
  const menu: PublicMenu = {
    businessDate: '2026-10-04',
    ordersPaused: false,
    items: [item()],
  };
  const entries: InitialEntry[] = [{ pathname: '/', state: CART_EMPTY_STATE }];

  it('shows "Your cart is empty." when checkout redirected back with an empty cart', () => {
    const html = renderMenuPage(menu, { initialEntries: entries });
    expect(html).toContain(copy.customer.checkout.cartEmpty);
  });

  it('shows it on a menu with no items too', () => {
    const html = renderMenuPage({ ...menu, items: [] }, { initialEntries: entries });
    expect(html).toContain(copy.customer.checkout.cartEmpty);
  });

  it('does not show it without the redirect state', () => {
    expect(renderMenuPage(menu)).not.toContain(copy.customer.checkout.cartEmpty);
  });

  it('does not show it once the cart has lines', () => {
    const cart = JSON.stringify({
      businessDate: '2026-10-04',
      lines: [{ menuItemId: 1, quantity: 1, name: 'Chicken Biryani' }],
    });
    const html = withWindowStorage({ local: { [CART_STORAGE_KEY]: cart } }, () =>
      renderMenuPage(menu, { initialEntries: entries }),
    );
    expect(html).not.toContain(copy.customer.checkout.cartEmpty);
  });
});

describe('ErrorState', () => {
  it('shows a busy Try again while retrying', () => {
    const html = render(h(ErrorState, { title: 'x', onRetry: () => undefined, retrying: true }));
    expect(html).toContain('aria-busy="true"');
    expect(html).toMatch(/<button[^>]*\sdisabled=""/);
  });

  it('idle Try again is enabled', () => {
    const html = render(h(ErrorState, { title: 'x', onRetry: () => undefined }));
    expect(html).not.toContain('aria-busy');
    // The attribute, not Tailwind's `disabled:` variants in the class list.
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""/);
  });
});

describe('BackToMenuLink', () => {
  it('is a 48 px link to the menu', () => {
    const html = render(h(BackToMenuLink));
    expect(html).toContain('href="/"');
    expect(classesOf(html, /<a [^>]*class="([^"]*)"/)).toEqual(
      expect.arrayContaining(['min-h-12', 'inline-flex']),
    );
    expect(html).toContain('Back to the menu');
  });
});
