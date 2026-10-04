# Batch 5 — Order creation + inventory

| | |
|---|---|
| Status | Not started |
| Depends on | Batch 4 (checkout, `createOrderSchema`, `delivery.service`) |
| Brief sections | §2 customer 8–10, §3 (customer COD copy), §6 separate orders, §8 server fees, §10 + §11 enforcement, §14 Inventory, §15 Order data, §25 Order creation, §26 Abuse protection |
| Endpoints | `POST /api/orders`, `POST /api/orders/lookup` |
| Rules used | Batch 1 §6.4 (S1–S8), §6.6, §6.7, §6.11, §6.12, §7.5, §8.4 |

## 1. Goal

Placing an order is correct under every condition. The server sets prices, fees and totals. Stock can't be oversold, even when two people order the last item in the same instant. Double taps and flaky mobile networks never create two orders. Any failure leaves no partial order and no stock change. The customer ends on a confirmation with the order ID, where and when the food arrives, and the cash-on-delivery total, and can look the order up later.

This is the batch that protects the vendor's food and the customer's trust. Its concurrency tests must stay green for the rest of the project.

## 2. Scope

**In:**

- `inventory.service.ts` complete: `reserveStock`, `restoreStockForOrder`, `setTodayStock`. Batch 6 calls the last two; they are built and tested here so all stock SQL lands in one reviewed change.
- `order.service.ts`: `createOrder`, `lookupOrder`, `toPublicOrderView`.
- Routes, order and lookup rate limits, the per-phone cap, and a guard test that keeps stock writes inside `inventory.service.ts`.
- `seed-dev` switched to `setTodayStock`.
- Client: submission with an idempotency key, error handling for every code, confirmation page, `/order/:orderNumber`, `/track`, recent orders on this phone.

**Out:** vendor actions (complete, cancel, collect) and stock screens (Batch 6).

## 3. `inventory.service.ts`

The only module that writes `daily_stock`, `stock_remaining` or `stock_date` (Batch 1 S7). Every function takes a `Prisma.TransactionClient`, so it can only be called inside a transaction. SQL is Batch 1 §7.5, through tagged templates only.

```ts
reserveStock(tx, businessDate: string, lines: { menuItemId: number; quantity: number }[])
  : Promise<{ id: number; name: string; price: number }[]>
```

- Sorts lines by `menuItemId` ascending, then runs the conditional decrement per line.
- Zero rows for a line → re-read that item and throw `OUT_OF_STOCK` with `{ menuItemId, name, available }` (available = 0 if the item's stock isn't for today).
- Returns name and price from the **updated rows**, so the prices used are the ones on the locked rows.

```ts
restoreStockForOrder(tx, order: { deliveryDate: string; items: { menuItemId: number; quantity: number }[] })
  : Promise<{ restoredLines: number }>
```

- The caller has already locked the order row (Batch 6 status machine).
- Per item, ascending `menuItemId`: add the quantity back only where `stock_date = order.deliveryDate` (Batch 1 S5). Lines whose item is now stocked for another day are skipped silently.

```ts
setTodayStock(tx, businessDate: string, entries: { menuItemId: number; stock: number }[])
  : Promise<AdminMenuItem[]>
```

- Ascending `menuItemId`; one statement per entry (Batch 1 S3).
- Zero rows → re-read: missing or deleted → collect `NOT_FOUND`; otherwise collect `{ menuItemId, sold }` for `STOCK_BELOW_SOLD`.
- After the loop, if anything was collected, throw (the caller's transaction rolls everything back); `STOCK_BELOW_SOLD` takes precedence and lists every offending item.

**Guard test** (`tests/unit/stock-writes-guard.test.ts`): scan `src/server/**/*.ts` except `inventory.service.ts` and the generated Prisma client (`src/server/generated/**`), and fail on either pattern:

- SQL: `/UPDATE\s+menu_items[\s\S]{0,300}?\b(stock_remaining|daily_stock|stock_date)\b/i`
- Prisma: `/menuItem\.(update|updateMany|upsert|create|createMany)\([\s\S]{0,400}?\b(stockRemaining|dailyStock|stockDate)\b/`

It's a heuristic backed by code review. The admin menu schemas (Batch 6) are strict objects without stock fields, so stock can't leak in through a request body either.

## 4. `createOrder`

Algorithm: Batch 1 §6.12. Implementation notes:

```ts
createOrder(deps: { prisma; clock }, input: CreateOrderOutput, ctx: { requestId: string })
  : Promise<{ order: PublicOrderView; replayed: boolean }>
```

1. **Idempotency fast path** outside the transaction: `findUnique({ where: { clientRequestId } , include: { items: true } })`. If it exists: same phone → `{ replayed: true }`; different phone → `IDEMPOTENCY_CONFLICT`.
2. `prisma.$transaction(fn, { isolationLevel: 'ReadCommitted', maxWait: 5_000, timeout: 10_000 })`.
3. Inside, in order:
   1. settings → `ORDERS_PAUSED`;
   2. merge duplicate lines → re-check `MAX_QTY_PER_ITEM` (`VALIDATION_ERROR` on `items`);
   3. `today = nowIST(clock)` (computed once and used for every check in this order);
   4. delivery rules using `slotStatus` / `expressStatus` from `delivery.service` (Batch 4 §3) on rows loaded in this transaction:
      - BATCH: slot missing → `VALIDATION_ERROR`; `slot.locationId ≠ input.locationId` → `VALIDATION_ERROR` (field `slotId`); location inactive → `LOCATION_UNAVAILABLE`; slot status not open → `SLOT_CLOSED` with `reason` and `expressAvailable`;
      - EXPRESS: express not available → `EXPRESS_UNAVAILABLE` with `reason`; location missing → `VALIDATION_ERROR`; inactive → `LOCATION_UNAVAILABLE`;
   5. per-phone cap: `count({ where: { customerPhone, deliveryDate: today, status: 'ORDER_RECEIVED' } })` ≥ `MAX_OPEN_ORDERS_PER_PHONE` → `TOO_MANY_OPEN_ORDERS`;
   6. item pre-check (one `findMany`) → `ITEM_UNAVAILABLE` (all bad ids) or `OUT_OF_STOCK` (all short items);
   7. `reserveStock` (authoritative; may still throw `OUT_OF_STOCK` if another order won the race);
   8. totals via `computeTotals` using the reserved prices and the fee for the mode;
   9. `total ≠ expectedTotal` → `PRICE_CHANGED` with `{ total }`;
   10. `tx.order.create` with nested items and snapshots:
       `locationName`, `slotDeliveryTime` (BATCH), `expressEtaMinMinutes` / `expressEtaMaxMinutes` (EXPRESS), item `itemName` / `unitPrice` / `lineTotal`, `deliveryDate: toDbDate(today.date)`, `createdAt: today.instant`.
4. **Unique violation** (`P2002` on `client_request_id`) from the insert: a concurrent duplicate won. Load that order and apply step 1's rules.
5. **Rejection re-check** (Batch 1 §6.12 step 14): if the transaction throws an `AppError`, re-run step 1's lookup once. If the order now exists, return it (`replayed: true`, or `IDEMPOTENCY_CONFLICT` for a different phone); otherwise rethrow the original error. This stops an overlapping retry from reporting `OUT_OF_STOCK` or `TOO_MANY_OPEN_ORDERS` for an order that was placed.
6. **Deadlock or serialization failure** (`40P01` / `40001`, Prisma `P2034`): retry the whole transaction once. With the fixed lock order this shouldn't happen; the retry is a safety net and is logged as a warning.
7. Log `order.created` with `orderNumber`, `deliveryMode`, `total`, `requestId`. Never name, phone or address. Rejections log `order.rejected` with the error code.

Route: `POST /api/orders` → `orderRateLimit` → `validate(createOrderSchema)` → `createOrder` → `201` (new) or `200` (replay) with `toPublicOrderView(order, settings.contactPhone)` plus `replayed`.

`toPublicOrderView` builds `expressWindow` from `createdAt` + snapshotted minutes with `addMinutesIST` (`{ from, to, etaText }`), and omits the internal `id`, the phone and the timestamps other than `createdAt`.

## 5. Lookup

- `lookupSchema` (shared): `orderNumber` trimmed and upper-cased; digits only (`1023`) gets the `BB` prefix; must match `^BB\d{4,9}$`. `phone` via `customerPhoneSchema`.
- `lookupOrder(prisma, { orderNumber, phone })`: `findUnique` by `orderNumber`; missing **or** phone different → `ORDER_NOT_FOUND`. One code path, so both cases return the same body.
- Route: `POST /api/orders/lookup` → `lookupRateLimit` (counts failed lookups only) → validate → `200` public order view (without `replayed`).

## 6. Rate limits and abuse

| Limit | Where | Value (Batch 1 §6.11) | Notes |
|---|---|---|---|
| `orderRateLimit` | `POST /api/orders` | 60 / 10 min / IP | counts every attempt; generous because of hostel NAT |
| `lookupRateLimit` | `POST /api/orders/lookup` | 30 failed / 10 min / IP | `skipSuccessfulRequests: true`: stops enumeration of sequential order numbers (guesses fail and count), while the confirmation page's 60 s refresh (§8.1) never uses it up, even for a whole hostel on one Wi-Fi IP |
| per-phone open orders | inside `createOrder` | 3 for today | cancelled and completed orders don't count |

All limits come from `createApp` options so tests can lower them.

## 7. Client: placing the order

### 7.1 `clientRequestId`

- `lib/uuid.ts`: `crypto.randomUUID()` when available; otherwise a v4 UUID built from `crypto.getRandomValues` (needed on `http://<lan-ip>` during phone testing, where `randomUUID` doesn't exist).
- On tap, compute a **fingerprint** of the request without its id (stable JSON of mode, slot, location, details, items, expected total).
- `sessionStorage['bbc.pendingOrder.v1'] = { clientRequestId, fingerprint }`. Same fingerprint as the stored one → reuse the id (retry, double tap). Different → new id (the customer changed something).
- Cleared on success.

This makes "Try again" after a timeout safe: if the first attempt reached the server, the retry returns the same order (`200`, `replayed: true`).

### 7.2 Submitting

- Button shows a spinner and "Placing order…", `aria-busy`; the form's `fieldset` is disabled so nothing changes mid-flight.
- Client timeout 15 s (`AbortController`); treated like a network error.
- **On success** (`201` or `200`):
  1. add `{ orderNumber, phone, deliveryDate }` to recent orders (§10);
  2. save remembered details (`bbc.customer.v1`, Batch 4 §7);
  3. clear the cart, checkout draft and pending order;
  4. `navigate('/order/BB1023', { replace: true, state: { order, phone } })`, so Back goes to the menu, not a stale checkout.

### 7.3 Errors

Every error re-enables the form. Banners appear at the top of the checkout and receive focus.

| Code | Behaviour | Copy |
|---|---|---|
| `VALIDATION_ERROR` | map `fieldErrors` onto fields; focus the first | field messages from the schema |
| `ORDERS_PAUSED` | revalidate options; button disabled | "Orders are temporarily paused. Please check again shortly." |
| `SLOT_CLOSED` | revalidate options; clear slot; offer Try Express if `details.expressAvailable` | "Orders for MSH — 8:00 PM just closed." + "Batch orders for MSH are closed. Express delivery is available." |
| `LOCATION_UNAVAILABLE` | revalidate; clear location | "Delivery to this location isn't available right now. Please choose another." |
| `EXPRESS_UNAVAILABLE` | revalidate; clear method | "Express delivery is currently unavailable." |
| `ITEM_UNAVAILABLE` | revalidate menu (reconciliation removes the items) | "Some items are no longer available and were removed. Please check your order." |
| `OUT_OF_STOCK` | cap each listed line at `available` or remove it at 0; revalidate menu | "Only 2 Chicken Biryani left. We've updated your order. Please check it and place it again." / "Chicken Biryani just sold out and was removed." |
| `PRICE_CHANGED` | revalidate menu and options; the summary shows the new total | "Prices changed since you opened the menu. Please check the new total and place your order again." |
| `TOO_MANY_OPEN_ORDERS` | none | "You already have 3 orders waiting for delivery today. Please wait for them to arrive or contact Bunty Biryani Centre." (+ contact number if set) |
| `IDEMPOTENCY_CONFLICT` | new id | "Something went wrong. Please tap Place order again." |
| `RATE_LIMITED` | none | "Too many attempts. Please wait a minute and try again." |
| network, timeout, `5xx` | keep the pending id; button becomes "Try again" | "We couldn't confirm your order. Check your connection and tap Try again. You won't get a duplicate order." |

## 8. Confirmation and order status (`/order/:orderNumber`)

### 8.1 Data source

1. Router state from the submit (instant, no request).
2. Else the phone saved for this order number in recent orders → `POST /api/orders/lookup`.
3. Else the `/track` form inline, with the order number prefilled.

While the status is `ORDER_RECEIVED`, refresh via lookup on focus and every 60 s.

### 8.2 Layout

```
            ✓
       ORDER PLACED
      Your order ID
         BB1023                [Copy]
  Keep this ID to check your order.

DELIVERY
  Batch · MSH
  Today, 8:00 PM
  Room 214, B block

  (Express:  Express · Kanhar
             Approx. 30–40 minutes (around 7:40–7:50 PM))

YOUR ORDER
  Chicken Biryani × 2              ₹300
  Delivery                         Free
  Total                            ₹300
  Payment: CASH ON DELIVERY
  Pay ₹300 in cash when your food arrives.

  Need help? Call 98765 43210

[ Order more ]          [ Track an order ]
```

- The order ID is Archivo 800, about 40 px, letter-spaced, selectable. **Copy** uses `navigator.clipboard.writeText` (fallback: select the text) and shows "Copied" for 2 s.
- Heading by status:
  - just placed → "ORDER PLACED" (success icon);
  - `ORDER_RECEIVED` on a later visit → "ORDER BB1023" + chip "Order received";
  - `COMPLETED` → chip "Completed";
  - `CANCELLED` → danger banner "This order was cancelled. Contact Bunty Biryani Centre if you have questions." with the contact number if set.
- Payment line: "Payment: CASH ON DELIVERY" while pending; "Cash on delivery · Collected" after the vendor marks it. Never "Paid" (Batch 1 C4).
- Batch time: "Today, 8:00 PM" when `deliveryDate` is today, else "Sun, 4 Oct, 8:00 PM".
- Express: "Approx. 30–40 minutes (around 7:40–7:50 PM)"; never an exact time (brief §7).
- "Need help?" shows only when `contactPhone` is set, as a `tel:` link.

## 9. Track page (`/track`)

- Fields: Order ID (`autocapitalize="characters"`, placeholder "BB1023", accepts digits only) and Mobile number (same as checkout). Button "Find order".
- Success → add to recent orders → `/order/:orderNumber` with state.
- `404` → danger banner "We couldn't find an order with that ID and mobile number." (one message for both causes).
- `429` → "Too many attempts. Please wait a minute and try again."
- **Orders on this phone:** list from recent orders, newest first: "BB1023 · Sun, 4 Oct" → opens the order. Empty → no list.
- Links: "Track an order" in the menu footer and on the confirmation page.

## 10. Recent orders (`localStorage['bbc.orders.v1']`)

Array of `{ orderNumber, phone, deliveryDate }`, newest first, de-duplicated by order number, max 10. zod-validated, try/catch, junk discarded. It stays on the customer's own device and holds nothing they didn't type themselves.

## 11. Edge cases

| Case | Handling |
|---|---|
| Double tap | Button disabled on first tap; any duplicate carries the same id → one order. |
| Network drops after the server committed | "Try again" resends the same id → `200 replayed` → normal confirmation. |
| Retry overlaps the original request, for the last item | The retry waits on the original's stock lock, then sees stock 0; the rejection re-check (§4 step 5) finds the original order → `200 replayed`, not "sold out". |
| App backgrounded mid-submit | On return the form shows the network error with "Try again" (same id). |
| Tab closed before the response arrived | Known limitation: the customer doesn't have the ID. The order is on the vendor's dashboard with their phone; they can contact the vendor. Auto-resubmitting later is deliberately not done (it could create an order the customer gave up on). |
| Two people order the last biryani together | Conditional decrement: exactly one succeeds; the other gets `OUT_OF_STOCK` with `available: 0`. |
| Cart from yesterday reaches the server | Items stocked for yesterday → `OUT_OF_STOCK` (available 0). |
| Request arrives at 19:29:59.9 for a 19:30 cutoff | Server time at transaction start decides; it is 19:29, so accepted. |
| Short stock **and** changed price | `OUT_OF_STOCK` comes first (step 6–7); the price check runs on the next attempt. |
| Vendor pauses orders while the request is in flight | Whichever commits first wins; at most this one order slips through. Acceptable. |
| Order number gaps | Expected (Batch 1 D15). |
| Lookup with `bb1023`, `1023` or ` BB1023 ` | All found. |
| Confirmation refreshed with storage blocked | Inline track form with the order number prefilled. |

## 12. Tests

All integration tests use real Postgres, `seed-initial` data and these items unless stated: **A** Chicken Biryani ₹150 (stock 5 today), **B** Paneer Biryani ₹130 (stock 5 today), **C** Raita ₹20 (stock 1 today). Test clock 19:10 IST unless stated. `assertInventoryInvariant()` (Batch 1 §7.5) runs after every test and must return zero rows.

### 12.1 `tests/integration/orders.create.test.ts`

**Happy paths**

1. Batch MSH, 2 × A → `201`; `orderNumber: "BB1001"`; `status: ORDER_RECEIVED`; `paymentMethod: COD`; `paymentStatus: PENDING`; `deliveryFee: 0`; `total: 300`; `slotDeliveryTime: "20:00"`; `locationName: "MSH"`; A remaining 3; DB row has the snapshots and `created_at` equal to the test clock.
2. Express Kanhar, 2 × A → `deliveryFee: 30`, `total: 330`; `slot_id` null; `expressWindow: { from: "19:40", to: "19:50" }`; ETA minutes snapshotted.
3. A second order gets `BB1002`.
4. Lines `[{A,2},{A,3}]` → one order item with quantity 5.
5. Snapshots: after the order, change A's price, rename MSH and move the slot to 20:15 → lookup still shows ₹150, "MSH" and "20:00".

**Rejections** (each also asserts no order row and unchanged stock)

6. `orders_paused` → `409 ORDERS_PAUSED`.
7. 19:30 IST, batch MSH → `409 SLOT_CLOSED`, `reason: CUTOFF_PASSED`, `expressAvailable: true`.
8. MSH `closed_on` today → `SLOT_CLOSED`, `CLOSED_TODAY`.
9. Inactive slot → `SLOT_CLOSED`, `INACTIVE`. Active slot at an inactive location → `LOCATION_UNAVAILABLE`.
10. Kanhar's slot with `locationId` MSH → `400 VALIDATION_ERROR` on `slotId`.
11. Express with express disabled → `EXPRESS_UNAVAILABLE`, `DISABLED`; at 10:00 IST → `OUTSIDE_HOURS`; inactive location → `LOCATION_UNAVAILABLE`.
12. Express payload containing `slotId` → `400`.
13. Disabled item, deleted item, unknown id 9999 → `ITEM_UNAVAILABLE` listing each id.
14. Quantity 11 → `400`; `[{A,6},{A,5}]` (merged 11) → `400`; 11 lines → `400`.
15. 6 × A and 6 × B → `OUT_OF_STOCK` listing both with `available: 5`.
16. Item stocked yesterday → `OUT_OF_STOCK` with `available: 0`.
17. `expectedTotal: 299` for a ₹300 order → `409 PRICE_CHANGED`, `details.total: 300`, stock unchanged. (This also proves the reservation is rolled back, because it runs after `reserveStock`.)
18. Per-phone cap: three orders succeed, the fourth → `429 TOO_MANY_OPEN_ORDERS`. After one is marked `COMPLETED` (direct DB update), the next succeeds. Cancelled orders don't count.
19. Order rate limit lowered to 2 → third request `429 RATE_LIMITED` with `Retry-After`.

**Idempotency**

20. Same body twice in sequence → `201` then `200` with `replayed: true`, same order number, one row, stock decremented once.
21. Same `clientRequestId`, different phone → `409 IDEMPOTENCY_CONFLICT`.
22. Five identical requests via `Promise.all` → exactly one order row; all five responses carry the same order number; one `201`, four `200`. **Last item:** C has 1 left; two concurrent requests with the same `clientRequestId` for 1 × C → one `201` and one `200 replayed` with the same order number (never `OUT_OF_STOCK`); C remaining 0. **Cap:** a phone with 2 open orders sends its third order twice concurrently with one id → one `201`, one `200` (never `TOO_MANY_OPEN_ORDERS`).

**Concurrency**

23. Last item: C has 1 left; two different customers order 1 × C concurrently → exactly one `201` and one `409 OUT_OF_STOCK` (`available: 0`); C remaining 0.
24. A has 5; ten concurrent orders of 1 × A → exactly five `201`, five `OUT_OF_STOCK`; A remaining 0.
25. Lock order: ten rounds of `[A,B]` and `[B,A]` submitted concurrently → every response is `201` or `OUT_OF_STOCK`; no `500`, no deadlock in the logs.

### 12.2 `tests/integration/orders.lookup.test.ts`

26. Correct phone in another format (`+91 98765-43210`) → `200` public view.
27. Wrong phone → `404 ORDER_NOT_FOUND`; unknown order → `404` with a byte-identical body.
28. `bb1001` and `1001` both find `BB1001`.
29. Lookup rate limit lowered to 2 → two failed lookups, then a third → `429`; on a fresh limiter, ten successful lookups in a row never get `429`.
30. The response contains no internal `id` and no phone number.

### 12.3 `tests/integration/inventory.test.ts`

31. New day: item stocked yesterday (daily 10, remaining 2) → `setTodayStock(20)` → daily 20, remaining 20, `stockDate` today.
32. Same day: daily 10 with 6 sold through real orders (remaining 4) → set 15 → remaining 9; set 6 → remaining 0; set 5 → `STOCK_BELOW_SOLD` with `sold: 6`, nothing changed.
33. Bulk: three entries, one below sold → nothing changes; the error lists only that item. Unknown id → `NOT_FOUND`.
34. `restoreStockForOrder` for today's order → stock returned. For yesterday's order whose item is now stocked today → unchanged.

### 12.4 Unit

35. Stock-writes guard (§3).
36. `uuid` fallback output passes `z.uuid()`; 1,000 generated ids are unique.
37. Fingerprint: identical requests → same; changing any field → different.
38. `toPublicOrderView`: batch shape; express window `19:40`–`19:50` for a 19:10 order with 30–40; window across noon formats correctly; no `id`, no phone.
39. `lookupSchema`: `bb1023`, `1023`, ` BB1023 ` → `BB1023`; `XX1023`, `BB12` → rejected.

### 12.5 Manual (real Android phone)

1. Place a batch order and an express order; check the confirmation for each, then reload it.
2. Look up an order with the wrong phone, then the right one.
3. DevTools → Offline, tap Place order → error; go online, tap Try again → one order in the database (`SELECT count(*) FROM orders`).
4. Two phones, last item: only one gets it; the other sees the sold-out message and an updated cart.

## 13. Definition of done

- [ ] `inventory.service.ts` complete; the guard test passes; `seed-dev` uses it.
- [ ] `createOrder` follows Batch 1 §6.12 step for step; `POST /api/orders` and lookup match Batch 1 §8.4.
- [ ] All tests in §12.1–§12.4 pass, including the concurrency tests, with the invariant checked after each.
- [ ] Every error code in §7.3 has a tested UI path (manual now, e2e in Batch 7).
- [ ] No name, phone or address in logs.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` pass; `CLAUDE.md` batch table updated.

## 14. Files

- Server: `src/server/services/{inventory.service,order.service}.ts`, `src/server/routes/orders.ts`, additions to `middleware/rate-limits.ts`, `prisma/seed-dev.ts` (uses `setTodayStock`).
- Shared: `src/shared/schemas/order.ts` (`lookupSchema`), `api-types.ts` (`PublicOrderView`).
- Client: `src/client/lib/uuid.ts`, `features/customer/checkout/{submit-order,pending-order,error-handling}.ts`, `features/customer/order/{OrderPage,OrderDetails,TrackPage,RecentOrders,recent-orders-storage,use-order-lookup}.ts(x)`, `copy.ts` additions.
- Tests: `tests/integration/{orders.create,orders.lookup,inventory}.test.ts`, `tests/unit/{stock-writes-guard,uuid,order-fingerprint,public-order-view,lookup-schema}.test.ts`, `tests/helpers/invariant.ts`.

## 15. Commands

```bash
pnpm db:seed
pnpm dev
pnpm test                                   # includes the concurrency tests
pnpm vitest run tests/integration/orders    # just the order tests
pnpm lint && pnpm typecheck
```
