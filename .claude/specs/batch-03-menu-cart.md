# Batch 3 — Customer menu + cart

| | |
|---|---|
| Status | Built 2026-10-04: lint, typecheck and all 148 tests pass (§12 has the measured numbers). One check is left for the owner: the manual phone checks in §11.3. Deviations found while building are marked **(as built)**. |
| Depends on | Batch 2 (skeleton, tokens, components) |
| Brief sections | §2 customer 1–3, §11 pause banner, §12 first steps, §13 Customer menu, §14 sold-out display, §24 |
| Endpoints | `GET /api/menu` |
| Rules used | Batch 1 MN1–MN4, S2, P1, §6.11, §8.4, §10.2 |

## 1. Goal

A customer opens the site on a phone and within a couple of seconds sees today's menu with prices. They add items with a quantity control, see a running count and subtotal in a sticky cart bar, and tap through to checkout. Sold-out items are visible but cannot be added. If orders are paused they are told so before they build a cart.

## 2. Scope

**In:** `menu.service.getPublicMenu`, the `GET /api/menu` route, shared menu types, the menu screen, item card, quantity stepper, cart state (reducer, persistence, reconciliation, multi-tab sync), cart bar, loading / empty / error / paused / all-sold-out states, copy.

**Out:** delivery options and the checkout page (Batch 4). The cart bar links to `/checkout`; until Batch 4 that route renders a one-line placeholder. The "Track an order" link arrives with `/track` in Batch 5.

## 3. API: `GET /api/menu`

Contract: Batch 1 §8.4.

`menu.service.getPublicMenu(prisma, today)`:

1. Read settings (`ordersPaused`) and `menuItem.findMany({ where: { isActive: true, isAvailable: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }] })` **(as built: the `id` tiebreaker keeps the order stable when two items share a sort order and name)** in parallel.
2. Map each item:
   - `soldOut = item.stockDate !== today.date || item.stockRemaining <= 0`;
   - `maxQty = soldOut ? 0 : Math.min(item.stockRemaining, MAX_QTY_PER_ITEM)`;
   - `onlyLeft = !soldOut && item.stockRemaining <= LOW_STOCK_THRESHOLD ? item.stockRemaining : null` **(as built: `LOW_STOCK_THRESHOLD = 5` in `src/shared/limits.ts`, Batch 1 §6.11)**.
3. Stable-partition: orderable items first, then sold out, each keeping the database order.
4. Return `{ businessDate: today.date, ordersPaused, items }`. Never include `dailyStock`, `stockRemaining` or `stockDate`.

The route is a single line calling the service with `nowIST(clock)`. The response type `PublicMenu` lives in `src/shared/api-types.ts`.

## 4. Menu screen (`/`)

### 4.1 Layout at 360 px

```
┌──────────────────────────────────────┐
│ [logo] BUNTY BIRYANI CENTRE           │  sun-yellow header band
│        Today's menu · Sun, 4 Oct      │
├──────────────────────────────────────┤
│ ⚠ Orders are temporarily paused.      │  only when paused
│   Please check again shortly.         │
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │ [72×72]  Chicken Biryani    ₹150 │ │
│ │          Full plate with raita…  │ │
│ │          ⚠ Only 3 left   [ ADD ] │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ Paneer Biryani              ₹130 │ │
│ │                      [ − 2 + ]   │ │
│ └──────────────────────────────────┘ │
│                                      │
│ SOLD OUT                             │
│ ┌──────────────────────────────────┐ │
│ │ Egg Biryani        ₹120 Sold out │ │
│ └──────────────────────────────────┘ │
│                                      │
├──────────────────────────────────────┤
│ 3 items · ₹410           Checkout ›  │  sticky cart bar, brand red
└──────────────────────────────────────┘
```

### 4.2 Header

- `AppHeader` from Batch 2: logo (48 px CSS), "BUNTY BIRYANI CENTRE" in Archivo. **(as built)** It now renders the page `<h1>` and takes the subline as a prop; every customer page uses it through `CustomerPage` (Batch 2 §10).
- Subline "Today's menu · Sun, 4 Oct" from the **server's** `businessDate` via `formatBusinessDate`, never the phone's date.
- Not sticky: screen space at 360 px goes to food. The cart bar is the only sticky element.

### 4.3 Item card

- `<article>` on `bg-surface`, `rounded-card`, `shadow-card`, 12 px padding, 12 px gap between cards.
- **Image** (only if `imageUrl`): 72×72, `object-cover`, rounded, `loading="lazy"`, `decoding="async"`, explicit `width`/`height`. If it fails to load, it is hidden (`onError`) and the card falls back to the text layout. No placeholder image: text-only cards look intentional and load faster.
- **Name:** Inter 600, 16 px, wraps (≤ 60 characters by schema).
- **Price:** Inter 600, tabular numbers, top-right, `formatINR`.
- **Description:** 14 px `text-ink-muted`, clamped to 2 lines.
- **Low stock:** a warning chip "Only 3 left" (warning colours + icon) when `onlyLeft` is set.
- **Action** (bottom-right, 48 px tall):
  - not in cart: `Button` "Add" (brand-red outline, so a full page of solid red buttons doesn't compete with the cart bar). **(as built)** This is a new `outline` variant: 1px `border-brand`, `bg-surface text-brand`, hover `bg-gold-soft` (the same hover as `secondary`);
  - in cart: `QtyStepper` `[−] n [+]`. `+` is disabled at `maxQty` with a hint under the card: "Only 3 left" or "Max 10 per order". `−` at 1 removes the line and brings back "Add". **(as built)** The hint element and the `+` button's `aria-describedby` render only while `+` is at its limit.
- Only the buttons are tappable, not the whole card, so scrolling doesn't add food by accident.

### 4.4 Sold-out items

- Listed under an `h2` "SOLD OUT" (Archivo, small, `text-ink-muted`) after the orderable items.
- Same card, no image, no action; a neutral chip "Sold out" with text, not colour alone.
- Text uses `text-ink-muted` (not opacity), so it keeps ≥ 4.5:1 contrast.

### 4.5 Cart bar

- Shown when the cart has at least one line. Fixed to the bottom, full width, `bg-brand text-on-brand`, 56 px plus `env(safe-area-inset-bottom)`, `shadow-bar`.
- Left: "3 items · ₹410" (the count is the sum of quantities). Right: "Checkout ›".
- It is a link to `/checkout` with accessible name "Checkout, 3 items, ₹410".
- When `ordersPaused`: the bar stays visible so the customer can see their cart, but it is non-interactive, `bg-ink text-cream`, with the text "Orders are paused".
- The page always reserves bottom padding so the bar never covers the last card and the layout doesn't jump when the bar appears. **(as built)** `CustomerPage reserveCartBar` pads `calc(5.5rem + env(safe-area-inset-bottom))`. The bar's background sits on the full-width fixed wrapper, so the safe-area padding is filled with the bar colour.

## 5. Cart

### 5.1 Model (`features/customer/cart/cart-reducer.ts`, pure)

```ts
type CartLine = { menuItemId: number; quantity: number; name: string }; // name is for notices only, never a price
type CartState = { businessDate: string | null; lines: CartLine[] };

type CartAction =
  | { type: 'add'; item: { id: number; name: string; maxQty: number }; businessDate: string }
  | { type: 'increment'; menuItemId: number; maxQty: number }
  | { type: 'decrement'; menuItemId: number }
  | { type: 'remove'; menuItemId: number }
  | { type: 'clear' }
  | { type: 'reconcile'; menu: PublicMenu } // returns notices alongside state
  | { type: 'dismissNotices' } // (as built)
  | { type: 'replace'; cart: CartState }; // (as built) multi-tab sync
```

**(as built)** The stored line carries `name` (Batch 1 §10.2 is updated to match) so a notice can name an item that has left the menu; `cartView` and the cards always show the live menu name. The reducer state is `{ cart, notices }` (`CartModel`), so notices come out of the same reducer. Prices are **never** stored. `cartView(menu, state)` derives `{ lines: [{ menuItemId, name, price, quantity, lineTotal }], count, subtotal }` from the latest menu with `computeTotals` from `src/shared/pricing.ts`. Lines whose item isn't in the menu are excluded from the view (reconciliation removes them).

### 5.2 Rules

| Action | Rule |
|---|---|
| add | Ignored if the item is sold out. **(as built)** On a line that already exists it behaves like `increment`. A successful add, or any removal, drops the line-cap notice. If the cart already has `MAX_LINES_PER_ORDER` lines: no change, notice "You can order up to 10 different items at once." Stamps `businessDate` on the first add. |
| increment | Up to `min(maxQty, MAX_QTY_PER_ITEM)`. |
| decrement | At 1, removes the line. |
| clear | After a successful order (Batch 5) or a business-date change. |
| dismissNotices | **(as built)** Empties the notice list (the banner's dismiss button). |
| replace | **(as built)** Swaps the cart for the one another tab wrote (§5.3); notices are kept. |

### 5.3 Persistence

- `localStorage['bbc.cart.v1']`, written on every change, read once on start through a zod schema. Corrupt or wrong-shape data is discarded. **(as built)** The schema (`cart-storage.ts`) is strict: unknown keys, duplicate item ids, more than `MAX_LINES_PER_ORDER` lines, a quantity outside 1 to `MAX_QTY_PER_ITEM`, or lines without a `businessDate` all count as junk. Raw `localStorage` access lives in `src/client/lib/storage.ts` (`readStorage` / `writeStorage`, which never throw).
- All storage access is wrapped in try/catch. If storage is unavailable (private mode, quota), the cart works in memory for the session.
- **Multi-tab:** a `storage` event listener replaces state when another tab changes the cart.

### 5.4 Reconciliation

Runs whenever a fresh menu arrives (first load, window focus, every 60 s):

| Situation | Effect | Notice |
|---|---|---|
| Menu `businessDate` ≠ cart `businessDate` | clear cart | "Your cart from yesterday was cleared." |
| Item no longer in the menu (disabled or deleted) | remove line | "Raita is no longer available and was removed from your cart." |
| Item sold out | remove line | "Egg Biryani just sold out and was removed from your cart." |
| `quantity > maxQty` | cap at `maxQty` | "Only 2 Chicken Biryani left. We've updated your cart." |

Notices from one reconciliation are shown together in one warning `Banner` at the top of the list (`role="status"`), dismissible, and cleared by the next reconciliation that changes nothing. **(as built)** `CartNotices.tsx` renders them. A line whose `maxQty <= 0` is treated as sold out even if `soldOut` is false.

## 6. Data fetching

`useMenu()` = SWR on `/api/menu` with `refreshInterval: 60_000`, `revalidateOnFocus: true`, `dedupingInterval: 5_000`, `keepPreviousData: true`.

- If a refresh fails while data is on screen, keep showing the data and let the next interval retry; show the error state only when there is no data at all.
- A successful refresh triggers reconciliation (§5.4). **(as built)** The trigger is the SWR `onSuccess` of the single `useMenu(onFresh)` call in `MenuPage`, not a `useEffect` on `data`: SWR keeps the same `data` reference when a refresh returns identical JSON, so an effect would not re-run. `onSuccess` only fires for the hook instance that started the request, so there must be exactly one `useMenu` per page; children get the data as props. `menuSwrOptions(onFresh?)` (exported from `use-menu.ts`) leaves `onSuccess` out when there is no callback, because SWR merges configs by object spread and an `onSuccess: undefined` key would override its default no-op.

## 7. States and copy

All strings go in `src/client/copy.ts`.

| State | When | UI | Copy |
|---|---|---|---|
| Loading | first load, no data | header + 4 skeleton cards of real card height | — |
| Error | request failed, no data | `ErrorState` | "Couldn't load today's menu." / "Check your connection and try again." / button "Try again" |
| Empty | `items` is empty | `EmptyState` | "Today's menu isn't up yet." / "Please check back soon." |
| All sold out | every item `soldOut` | info `Banner` above the list | "Everything's sold out for today. See you tomorrow!" |
| Paused | `ordersPaused` | warning `Banner` under the header; cart bar disabled | "Orders are temporarily paused. Please check again shortly." |
| Cart notices | §5.4 | warning `Banner` | as in §5.4 |
| Line cap | §5.2 | info `Banner` | "You can order up to 10 different items at once." |

## 8. Accessibility

- Headings: `h1` brand name (in the header), `h2` "Today's menu" (visually hidden if the subline already says it), `h2` "Sold out".
- `Add` button: `aria-label="Add Chicken Biryani"`. Stepper: "Remove one Chicken Biryani", "Add one more Chicken Biryani"; quantity in `<output aria-live="polite">`.
- Disabled `+` uses `aria-disabled` plus visible hint text, so screen-reader users hear why.
- The cart bar's accessible name includes count and total (§4.5).
- Every interactive element is at least 48×48 px with 8 px between adjacent targets.

## 9. Performance

- The menu JSON is a few KB. One request on first load (plus fonts and the logo).
- Images are 72 px, lazy, never above-the-fold hero images.
- Skeletons have the same height as real cards, and the cart bar space is always reserved, so cumulative layout shift stays near zero.
- No admin code in the customer bundle (lint rule from Batch 2 §3.3). Batch 7 measures the 130 KB budget.

## 10. Edge cases

| Case | Handling |
|---|---|
| Midnight passes with the page open | Next menu fetch returns the new business date; the cart clears with a notice; items show sold out until the vendor sets today's stock (Batch 1 S2). |
| Price changes while items are in the cart | The cart shows the new price (prices aren't stored). A race at submit time is caught by `PRICE_CHANGED` (Batch 5). |
| Vendor disables an item while it's in a cart | Removed on the next refresh with a notice. |
| Stock drops below the cart quantity | Capped on the next refresh with a notice; the server re-checks at order time anyway. |
| Broken image URL | Image hidden; text card. |
| `localStorage` throws or holds junk | In-memory cart; junk discarded. |
| Two tabs open | `storage` event keeps them in sync. |
| 10 lines in the cart | "Add" on other items shows the line-cap notice instead of adding. |
| Customer's phone clock is wrong | Irrelevant: the date shown and every availability decision come from the server. |

## 11. Tests

### 11.1 Integration (`tests/integration/menu.test.ts`)

Test clock at `2026-10-04T13:00:00Z` (18:30 IST) unless stated.

1. Only active + available items are returned; a disabled item and a deleted item are absent.
2. Stock today 8 → `soldOut: false`, `maxQty: 8`, `onlyLeft: null`. Stock today 3 → `maxQty: 3`, `onlyLeft: 3`. Stock today 20 → `maxQty: 10`.
3. `stockDate` yesterday → `soldOut: true`, `maxQty: 0`. `stockDate` null → `soldOut: true`.
4. `stockRemaining: 0` today → `soldOut: true`.
5. Ordering: orderable items by `sortOrder`, then name; then sold-out items in the same order.
6. `ordersPaused: true` in settings → `ordersPaused: true` in the response.
7. Clock `2026-10-04T18:45:00Z` (00:15 IST on the 5th) → `businessDate: "2026-10-05"`; items stocked for the 4th are sold out.
8. No item object has `dailyStock`, `stockRemaining` or `stockDate` keys.
9. `Cache-Control: no-store`.

### 11.2 Unit (`tests/unit/cart.test.ts`)

1. `add` → quantity 1 with `businessDate` stamped; `increment` stops at `maxQty`; `decrement` from 1 removes the line.
2. `add` on a sold-out item does nothing.
3. Eleventh distinct item → unchanged state and the line-cap notice.
4. `reconcile`: removes a missing item, removes a sold-out item, caps an over-quantity line, and returns one notice for each.
5. `reconcile` with a different `businessDate` → empty cart and the "from yesterday" notice.
6. `cartView`: 2 × ₹150 + 1 × ₹130 → `count: 3`, `subtotal: 430`; a line for an unknown id is excluded.
7. Storage loader: invalid JSON → empty cart; valid JSON with the wrong shape → empty cart; valid data round-trips.

### 11.3 Manual (Chrome device mode 360×740, then a real Android phone)

1. Menu loads with skeletons first, then cards; no horizontal scroll at 320, 360 and 412 px.
2. Add, increment to the limit (hint visible), decrement to remove.
3. Sold-out items cannot be added.
4. Refresh the page: cart persists. Second tab: changes sync.
5. `UPDATE delivery_settings SET orders_paused = true;` → within 60 s (or on refocus) the banner appears and the cart bar is disabled.
6. Disable an item in the cart via SQL → removed with a notice on the next refresh.
7. The cart bar never hides the last card; TalkBack reads the stepper and cart bar sensibly.

## 12. Definition of done

- [x] `GET /api/menu` matches Batch 1 §8.4 and the tests in §11.1 pass.
- [x] Menu screen, cart and every state in §7 implemented with copy in `copy.ts`.
- [x] Cart is id + quantity only (plus `name` for notices, §5.1); prices always come from the menu.
- [x] Unit and integration tests pass.
- [ ] Manual checks in §11.3 done on a real phone (owner).
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test` pass. **(as built)** `pnpm test`: 13 files, 148 tests. `pnpm build`: the `/` entry chunk is 118.97 KB gzipped JS plus 4.63 KB gzipped CSS, inside the 130 KB budget (Batch 1 §10.5).
- [x] `CLAUDE.md` batch table updated.

## 13. Files

- Server: `src/server/services/menu.service.ts`, `src/server/routes/menu.ts`.
- Shared: `src/shared/schemas/menu.ts`, `src/shared/pricing.ts`, additions to `src/shared/api-types.ts`.
- Client: `src/client/features/customer/menu/{MenuPage,ItemCard,SoldOutList,use-menu}.tsx`, `src/client/features/customer/cart/{cart-reducer,cart-storage,CartProvider,CartBar}.ts(x)`, `src/client/components/QtyStepper.tsx`, additions to `src/client/copy.ts`, `/checkout` placeholder route.
- Tests: `tests/integration/menu.test.ts`, `tests/unit/cart.test.ts`.
- **(as built) Also created:** `src/client/features/customer/cart/CartNotices.tsx`, `src/client/lib/storage.ts`, `src/client/components/CustomerPage.tsx`, `tests/unit/use-menu.test.ts`, `tests/unit/pricing.test.ts`, `tests/unit/menu-schema.test.ts`. `use-menu.ts` also exports `menuSwrOptions`, and the Batch 2 `Button` gained `outline`.
- **(as built) Convention:** callback props use property syntax (`onX: () => void`, not method syntax) because of the `@typescript-eslint/unbound-method` lint rule.

## 14. Commands

```bash
pnpm db:seed              # today's stock for the sample menu
pnpm dev                  # http://localhost:5173
pnpm test
pnpm lint && pnpm typecheck
```

## 15. Known gaps / deferred polish

Found in review and left on purpose; none blocks Phase 1. Revisit in Batch 7 polish unless noted.

- The empty-menu branch of `MenuPage` doesn't render `CartNotices`, so a cart emptied by reconciliation when every item is disabled is cleared silently.
- `ItemCard`'s broken-image flag doesn't reset if the vendor later fixes `imageUrl`, until the card remounts.
- Sold-out cards keep `text-ink` for name and price; §4.4 asks for `text-ink-muted`.
- An empty `<ul>` renders when everything is sold out.
- `MenuSkeleton` puts an `aria-label` on a generic `div`.
- The "Try again" button gives no visible feedback while it revalidates.
- The `/checkout` placeholder's back link is under 48 px; Batch 4 replaces the page.
