// Static-markup checks for the customer menu (Batch 3 §15 follow-ups). No DOM: components render
// with react-dom/server in the node unit project, and SWR serves its `fallback` without fetching.
import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { SWRConfig } from 'swr';
import { describe, expect, it } from 'vitest';
import type { PublicMenu, PublicMenuItem } from '../../src/shared/api-types';
import { BackToMenuLink } from '../../src/client/components/BackToMenuLink';
import { ErrorState } from '../../src/client/components/ErrorState';
import { copy } from '../../src/client/copy';
import { CartProvider } from '../../src/client/features/customer/cart/CartProvider';
import { ItemCard } from '../../src/client/features/customer/menu/ItemCard';
import { MenuPage } from '../../src/client/features/customer/menu/MenuPage';
import { MENU_KEY } from '../../src/client/features/customer/menu/use-menu';

function item(over: Partial<PublicMenuItem> = {}): PublicMenuItem {
  return {
    id: 1,
    name: 'Chicken Biryani',
    description: null,
    price: 150,
    imageUrl: null,
    soldOut: false,
    maxQty: 10,
    onlyLeft: null,
    ...over,
  };
}

function render(el: ReactElement): string {
  return renderToStaticMarkup(h(MemoryRouter, null, el));
}

function renderMenuPage(menu?: PublicMenu): string {
  const value = { provider: () => new Map(), ...(menu ? { fallback: { [MENU_KEY]: menu } } : {}) };
  return render(h(SWRConfig, { value }, h(CartProvider, null, h(MenuPage))));
}

/** MenuPage with SWR's cache entry for the menu seeded directly (e.g. a failed fetch). */
function renderMenuPageFromCache(state: { error: Error; isValidating: boolean }): string {
  const value = { provider: () => new Map<string, object>([[MENU_KEY, state]]) };
  return render(h(SWRConfig, { value }, h(CartProvider, null, h(MenuPage))));
}

/** React escapes apostrophes in static markup. */
const escaped = (text: string) => text.replace(/'/g, '&#x27;');

/** The class tokens of the first opening tag `openTag` matches (its one capture group). */
function classesOf(html: string, openTag: RegExp): string[] {
  const match = openTag.exec(html);
  if (!match?.[1]) throw new Error(`no tag matching ${String(openTag)}`);
  return match[1].split(' ');
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
