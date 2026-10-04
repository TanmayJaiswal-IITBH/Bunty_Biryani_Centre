# Batch 4 — Checkout + batch/express delivery selection

| | |
|---|---|
| Status | Not started |
| Depends on | Batch 3 (menu, cart) |
| Brief sections | §4 Delivery method UI, §5 Batch delivery, §7 Express, §8 fees (display), §9 Express availability, §10 Batch cutoff, §11 pause, §12 Customer flow |
| Endpoints | `GET /api/delivery-options` |
| Rules used | Batch 1 §6.2, B1–B4, E1–E3, F2–F5, P1–P2, §6.11, §8.4 |

## 1. Goal

From the cart, the customer reaches a complete, validated order on **one page**: review items, choose **Batch** (a location + slot) or **Express** (a location, +₹30, approx. 30–40 minutes), enter name, phone and optional room/address, and see the exact cash-on-delivery total. Closed slots and unavailable express are explained, with a one-tap switch to Express when batch is closed. Sending the order is Batch 5.

## 2. Scope

**In:** `delivery.service` (availability rules as pure functions + loader), `GET /api/delivery-options`, shared order schemas (`createOrderSchema` is the exact schema Batch 5's server uses), the checkout page with its five sections, `RadioCard`, `buildOrderRequest()`, draft persistence, remembered details, a delivery summary line on the menu page, all states and copy.

**Out:** `POST /api/orders`, confirmation, lookup (Batch 5). In this batch the Place order button validates and builds the request but sends nothing.

## 3. Availability rules — one implementation

`src/server/services/delivery.service.ts` exports **pure** functions that both `GET /api/delivery-options` (this batch) and `createOrder` (Batch 5) call, so what customers see and what the server enforces can't drift:

```ts
slotStatus(slot, location, today): { isOpen: boolean; closedReason: 'CUTOFF_PASSED' | 'CLOSED_TODAY' | 'INACTIVE' | null }
expressStatus(settings, today): { available: boolean; unavailableReason: 'DISABLED' | 'OUTSIDE_HOURS' | null }
computeDeliveryOptions({ settings, slots, locations, today }): DeliveryOptions
```

- `slotStatus` implements B3 without the pause flag: inactive slot or location → `INACTIVE`; `closedOn = today` → `CLOSED_TODAY`; `today.time >= cutoffTime` → `CUTOFF_PASSED`.
- `expressStatus` implements E1 without the pause flag: not enabled → `DISABLED`; `time < opensAt` or `time >= closesAt` → `OUTSIDE_HOURS`.
- `ordersPaused` is reported separately at the top level and checked first by `createOrder`.
- `getDeliveryOptions(prisma, today)` loads settings, active locations and active slots (with location) in parallel and calls `computeDeliveryOptions`. Slots with `INACTIVE` status are omitted from the response; slots are sorted by `deliveryTime`, then location `sortOrder`.

Contract: Batch 1 §8.4.

## 4. Shared order schemas (`src/shared/schemas/order.ts`)

Messages are customer-facing copy.

```ts
const id = z.number().int().positive();

export const customerNameSchema = z
  .string()
  .transform((s) => s.trim().replace(/\s+/g, ' '))
  .pipe(z.string().min(NAME_MIN, 'Enter your name').max(NAME_MAX, 'Name is too long'));

export const customerPhoneSchema = z.string().transform((s, ctx) => {
  const n = normalizeIndianMobile(s);
  if (!n) {
    ctx.addIssue({ code: 'custom', message: 'Enter a 10-digit mobile number' });
    return z.NEVER;
  }
  return n;
});

export const addressDetailSchema = z
  .string()
  .nullish()
  .transform((s) => (s ?? '').trim() || null)
  .pipe(z.string().max(ADDRESS_MAX, 'Keep it under 120 characters').nullable());

export const orderLineSchema = z.object({
  menuItemId: id,
  quantity: z.number().int().min(1).max(MAX_QTY_PER_ITEM),
});

const base = {
  clientRequestId: z.uuid(),
  customerName: customerNameSchema,
  customerPhone: customerPhoneSchema,
  addressDetail: addressDetailSchema,
  items: z.array(orderLineSchema).min(1).max(MAX_LINES_PER_ORDER),
  expectedTotal: z.number().int().nonnegative(),
};

export const createOrderSchema = z.discriminatedUnion('deliveryMode', [
  z.strictObject({ ...base, deliveryMode: z.literal('BATCH'), locationId: id, slotId: id }),
  z.strictObject({ ...base, deliveryMode: z.literal('EXPRESS'), locationId: id }),
]);

export const customerDetailsSchema = z.object({
  customerName: customerNameSchema,
  customerPhone: customerPhoneSchema,
  addressDetail: addressDetailSchema,
});
```

Form state uses `z.input<…>`; the parsed output (`z.output<…>`) is what gets sent and what the server works with.

## 5. Checkout page (`/checkout`)

### 5.1 Layout at 360 px

```
‹ Menu                     CHECKOUT

YOUR ORDER
  Chicken Biryani      [− 2 +]   ₹300
  Raita                [− 1 +]    ₹20
                         Food    ₹320

DELIVERY METHOD
  ◯ Batch Delivery
    Regular delivery
    Choose location and fixed delivery slot
  ◯ Express Delivery
    Delivered in approximately 30–40 minutes
    +₹30 delivery charge

WHERE & WHEN                 (after a method is chosen)
  Batch:   ◯ MSH — 8:00 PM        Order by 7:30 PM
           ◯ Kanhar — 8:45 PM     Order by 8:15 PM
  Express: ◯ MSH   ◯ Kanhar

YOUR DETAILS
  Name                 [                    ]
  Mobile number        [                    ]
  Room / address (optional)
                       [                    ]
  Hostel block, room number or a landmark

SUMMARY
  Food                               ₹320
  Delivery · Express                  ₹30
  Total                              ₹350
  Express to Kanhar · approx. 30–40 minutes
  Payment: CASH ON DELIVERY
  Pay ₹350 in cash when your food arrives.

┌──────────────────────────────────────┐
│        Place order · ₹350            │  sticky, brand red
└──────────────────────────────────────┘
```

Section headings are Archivo uppercase `h2`s. The page has a back link to the menu, not a full header, to save vertical space.

### 5.2 Your order

- Same `QtyStepper` and limits as the menu (Batch 3). Line totals, then "Food ₹320".
- Arriving with an empty cart, or removing the last item → redirect to `/` with the notice "Your cart is empty."
- Cart reconciliation (Batch 3 §5.4) runs here too; its notices appear at the top of this section.

### 5.3 Delivery method

Two `RadioCard`s in a `fieldset` (legend "Delivery method"), with the brief §4 copy verbatim:

| Card | Title | Lines |
|---|---|---|
| Batch | Batch Delivery | "Regular delivery" / "Choose location and fixed delivery slot" |
| Express | Express Delivery | "Delivered in approximately {etaText}" / "+{formatINR(fee)} delivery charge" |

- **Preselection:** none, unless only one method is possible right now, or the customer's remembered mode (§7) is available.
- **Express unavailable:** card disabled with the reason underneath: `DISABLED` → "Express delivery is currently unavailable."; `OUTSIDE_HOURS` → "Express delivery runs 11:00 AM–11:00 PM." (from `opensAt`/`closesAt`).
- **No open batch slot:** Batch card disabled with "No batch deliveries are open right now."
- **Nothing available:** both disabled, banner "No deliveries are open right now. Please check again later.", Place order disabled.

### 5.4 Where & when — Batch

- One `RadioCard` per listed slot: title "MSH — 8:00 PM", right-aligned hint "Order by 7:30 PM". Selecting a slot also sets `locationId = slot.locationId`.
- When 30 minutes or less remain before cutoff: hint becomes "Order in the next 12 min" (warning colour). Minutes left are computed from the server's `serverTime` at fetch plus time elapsed since the fetch (`performance.now()`), never the phone's clock.
- **Closed slots** stay listed, disabled, with the reason:
  - `CUTOFF_PASSED` → "Orders for this delivery slot are closed."
  - `CLOSED_TODAY` → "No delivery on this slot today."
- **Closed slot + express available** (brief §10): under the closed slot, "Batch orders for MSH are closed. Express delivery is available." with a secondary button **Try Express Delivery**. It switches the method to Express, preselects that slot's location, and scrolls the Where & when section into view.
- Remembered location (§7): preselect the earliest open slot at that location.

### 5.5 Where & when — Express

- `RadioCard` per express location (name only). Required: "Bunty must know where to go" (brief §12).
- Info line above the list: "Delivered in approximately 30–40 minutes · +₹30 delivery charge". Never an exact time.
- The address hint changes to "Room number or a landmark helps us find you quickly." It stays optional.

### 5.6 Your details

| Field | Attributes | Behaviour |
|---|---|---|
| Name | `autocomplete="name"`, `autocapitalize="words"`, `enterkeyhint="next"` | trimmed and space-collapsed on blur |
| Mobile number | `type="tel"`, `inputmode="numeric"`, `autocomplete="tel-national"`, placeholder "10-digit mobile number" | accepts `+91`, spaces and dashes; on blur shows `98765 43210` |
| Room / address (optional) | `autocomplete="off"`, `maxlength=120`, `enterkeyhint="done"` | character counter appears after 100 characters |

- Prefilled from remembered details (§7) with a "Not you? Clear details" link.
- Validation with `customerDetailsSchema`: on blur after the field was touched, and for all fields on submit.
- Errors: below the field, `text-danger` + icon, `aria-invalid`, `aria-describedby`.

### 5.7 Summary

- Food (subtotal), Delivery ("Free" when the fee is 0, else `formatINR(fee)`, labelled "· Batch" or "· Express"), Total (Inter 700).
- Delivery line: Batch "MSH · Today, 8:00 PM"; Express "Express to Kanhar · approx. 30–40 minutes".
- **"Payment: CASH ON DELIVERY"** and "Pay ₹350 in cash when your food arrives." Never "paid" (Batch 1 C4).
- All amounts come from `computeTotals(menu prices, fee from delivery-options)`. They are display only; the server recomputes (F4–F5).

### 5.8 Place order button

- Sticky at the bottom, full width, brand red, 56 px + safe area: "Place order · ₹350".
- **Disabled** only when: orders are paused ("Orders are paused"), delivery options haven't loaded, or nothing is available. Validation problems do **not** disable it: tapping shows every error, focuses the first invalid field and scrolls it to the centre.
- **Keyboard:** while a text input has focus, the sticky button is hidden (focusin/focusout on the form), because on Android Chrome a fixed bottom bar otherwise sits over the field being typed in. The summary and a non-sticky copy of the button stay at the end of the form.
- This batch: a valid tap calls `buildOrderRequest()` and stops. Batch 5 sends it.

## 6. Data and refresh

- `useDeliveryOptions()` = SWR on `/api/delivery-options`, `refreshInterval: 30_000` on `/checkout`, `revalidateOnFocus: true`. The menu page prefetches it (§8), so checkout opens with data.
- `useMenu()` keeps running for prices and stock.
- After each refresh:
  - selected slot no longer open → clear the selection; warning banner in Where & when: "Orders for MSH — 8:00 PM just closed." plus **Try Express Delivery** if express is available;
  - Express selected but no longer available → clear the method; banner "Express delivery is currently unavailable.";
  - selected location gone → clear it;
  - `ordersPaused` → top warning banner "Orders are temporarily paused. Please check again shortly."; button disabled.
- Fee or price changes simply update the summary. The server-side `PRICE_CHANGED` check covers a change that lands between the last refresh and the tap.

## 7. Client storage

| Key | Storage | Content | Written |
|---|---|---|---|
| `bbc.checkout.v1` | `sessionStorage` | `{ deliveryMode, slotId, locationId, customerName, customerPhone, addressDetail }` | on change (debounced 300 ms); cleared after a successful order |
| `bbc.customer.v1` | `localStorage` | `{ customerName, customerPhone, addressDetail, deliveryMode, locationId }` | only after a successful order (Batch 5), so half-typed input is never remembered |

Both are read through zod with try/catch; anything invalid is ignored. The draft wins over remembered details when both exist.

## 8. Menu page addition

Under the menu header, one muted line from the prefetched delivery options:

"Batch: MSH 8:00 PM · Kanhar 8:45 PM — Express approx. 30–40 min (+₹30)"

- Only open slots are listed. If none are open: "Batch: closed for today".
- The Express part is omitted when express is unavailable.
- Hidden while loading or on error; the menu never waits for it.

## 9. `buildOrderRequest()`

Pure function in `features/customer/checkout/build-order-request.ts`:

```ts
buildOrderRequest({ cartView, selection, details, options, clientRequestId })
  → { ok: true; request: CreateOrderInput } | { ok: false; errors: Partial<Record<Field, string>> }
```

1. No method → `deliveryMode: 'Choose a delivery method'`.
2. Batch without slot → `slotId: 'Choose a delivery slot'`; selected slot not open → `slotId: 'Orders for this delivery slot are closed.'`.
3. Express without location → `locationId: 'Choose where to deliver'`; express unavailable → `deliveryMode: 'Express delivery is currently unavailable.'`.
4. `expectedTotal = computeTotals(lines, fee).total`, where `fee` is `options.batch.fee` or `options.express.fee`.
5. Assemble and run `createOrderSchema.safeParse`; map issues to field errors.

`clientRequestId` handling (generate, keep, reuse on retry) is Batch 5.

## 10. States and copy

| State | UI | Copy |
|---|---|---|
| Options loading | skeleton radio cards in Delivery method and Where & when | — |
| Options error, no data | inline `ErrorState`; button disabled | "Couldn't load delivery options." / "Try again" |
| Paused | top warning banner; button disabled | "Orders are temporarily paused. Please check again shortly." |
| Express off | Express card disabled | "Express delivery is currently unavailable." |
| Express outside hours | Express card disabled | "Express delivery runs 11:00 AM–11:00 PM." |
| Slot past cutoff | slot disabled | "Orders for this delivery slot are closed." |
| Slot closed today | slot disabled | "No delivery on this slot today." |
| Batch closed, express available | under the closed slot + button | "Batch orders for MSH are closed. Express delivery is available." / "Try Express Delivery" |
| No batch slot open | Batch card disabled | "No batch deliveries are open right now." |
| Nothing open | banner; button disabled | "No deliveries are open right now. Please check again later." |
| Slot closed while on page | warning banner | "Orders for MSH — 8:00 PM just closed." |
| Field errors | under fields | "Enter your name" · "Name is too long" · "Enter a 10-digit mobile number" · "Keep it under 120 characters" · "Choose a delivery method" · "Choose a delivery slot" · "Choose where to deliver" |
| Payment | summary | "Payment: CASH ON DELIVERY" / "Pay ₹350 in cash when your food arrives." |

## 11. Accessibility

- Each choice group is a `fieldset` with a `legend`; `RadioCard` wraps a real `<input type="radio">` (visually restyled), so arrow keys and screen readers work natively.
- Disabled cards are `aria-disabled` and stay focusable, with the reason linked by `aria-describedby`.
- Submitting with errors: focus moves to the first invalid control; each error is linked to its field.
- Banners that appear after a refresh use `role="status"`; the paused banner uses `role="alert"`.
- Minimum 48 px targets; 16 px inputs.

## 12. Edge cases

| Case | Handling |
|---|---|
| Cutoff passes while the customer is on the page | 30 s refresh + refocus clears the selection with a message; the server rejects anyway (Batch 5). |
| Customer leaves the app for 20 minutes and returns | `revalidateOnFocus` refreshes options, menu and cart. |
| Vendor turns express off mid-checkout | Selection cleared, message shown. |
| Vendor deactivates a location | Its slots and express option disappear; the selection is cleared. |
| Express fee changes mid-checkout | Summary updates on refresh; `PRICE_CHANGED` covers the race. |
| Batch fee is 0 | "Free". |
| Only express is possible | Batch disabled with its reason; Express preselected. |
| Cart emptied in another tab | `storage` event → redirect to menu. |
| Refresh or back navigation | Draft restored from `sessionStorage`. |
| Phone typed as `+91 98765-43210` | Normalised; shown as `98765 43210`. |
| 320 px screen | Radio card text wraps; the price column has a minimum width so amounts never wrap. |
| Slots crossing midnight | Not supported (Batch 1 T4); admin validation prevents them. |

## 13. Tests

### 13.1 Unit — availability (`tests/unit/delivery-rules.test.ts`)

Fixtures: MSH 20:00 / cutoff 19:30; Kanhar 20:45 / 20:15; express 11:00–23:00, fee 30, ETA 30–40.

1. 19:29 → MSH open; 19:30 → `CUTOFF_PASSED` (cutoff is exclusive); 19:31 → `CUTOFF_PASSED`.
2. `closedOn` today → `CLOSED_TODAY`; `closedOn` yesterday → open.
3. Inactive slot → `INACTIVE` and omitted by `computeDeliveryOptions`; active slot at an inactive location → omitted; inactive location absent from `express.locations`.
4. Express: 10:59 → `OUTSIDE_HOURS`; 11:00 → available; 22:59 → available; 23:00 → `OUTSIDE_HOURS`; disabled at 15:00 → `DISABLED`.
5. `ordersPaused: true` → top-level flag true; slot and express statuses unchanged.
6. `etaText` is `30–40 minutes` (en dash); fees come from settings.
7. Slots sorted by `deliveryTime`, then location `sortOrder`.

### 13.2 Unit — schemas (`tests/unit/order-schema.test.ts`)

1. Valid batch and valid express payloads parse.
2. Express with `slotId` → rejected; batch without `slotId` → rejected; unknown key → rejected.
3. 0 items, 11 lines, quantity 0, quantity 11, non-integer quantity → rejected.
4. Name `"  Rahul   Verma "` → `"Rahul Verma"`; `"A"` → "Enter your name"; 61 characters → "Name is too long".
5. Address `""` → `null`; `"   "` → `null`; 121 characters → rejected.
6. Phone `+91 98765-43210` → `9876543210`; `12345` → "Enter a 10-digit mobile number".
7. `clientRequestId` `"abc"` → rejected; `expectedTotal: -1` → rejected.

### 13.3 Unit — `buildOrderRequest`

1. Batch, 2 × ₹150, batch fee 0 → request with `expectedTotal: 300`, `slotId`, `locationId` from the slot.
2. Express, same cart, fee 30 → `expectedTotal: 330`, no `slotId` key.
3. No method / no slot / no location → the matching field error.
4. Selected slot not open → slot error; express selected while unavailable → method error.

### 13.4 Integration — `GET /api/delivery-options`

Seeded with `seed-initial` defaults.

1. 19:10 IST → both slots open, `batch.fee: 0`, `express.available: true`, `fee: 30`, `etaText: "30–40 minutes"`, `serverTime: "19:10"`.
2. 19:30 IST → MSH `CUTOFF_PASSED`, Kanhar open.
3. 20:15 IST → both `CUTOFF_PASSED`.
4. MSH `closed_on` = today → `CLOSED_TODAY`.
5. `express_enabled = false` → `available: false`, `unavailableReason: "DISABLED"`.
6. 09:00 IST → `OUTSIDE_HOURS`.
7. `orders_paused = true` → `ordersPaused: true`.
8. `contactPhone` is `null` by default.
9. `Cache-Control: no-store`.

### 13.5 Manual (360 px, then a real Android phone)

1. Batch: pick MSH 8:00 PM, fill details, summary shows Food, Delivery Free, Total and "Payment: CASH ON DELIVERY".
2. Express: pick Kanhar; summary adds ₹30 and shows "approx. 30–40 minutes".
3. Set MSH cutoff a minute ahead via SQL, wait → "just closed" message → Try Express Delivery selects Express + MSH.
4. Turn express off via SQL → card disabled with the brief's copy.
5. Keyboard open on the phone: the field being typed in is never covered.
6. Refresh mid-checkout: everything typed is still there.
7. Empty the cart: redirect to the menu.

## 14. Definition of done

- [ ] Availability is implemented once in `delivery.service.ts` and exported for Batch 5.
- [ ] `GET /api/delivery-options` matches Batch 1 §8.4.
- [ ] Checkout page implements §5–§10 with copy in `copy.ts`; brief §4 copy is verbatim.
- [ ] `createOrderSchema` is final and shared.
- [ ] Unit, integration and manual checks in §13 pass.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` pass; `CLAUDE.md` batch table updated.

## 15. Files

- Server: `src/server/services/delivery.service.ts`, `src/server/routes/delivery.ts`.
- Shared: `src/shared/schemas/order.ts`, `src/shared/schemas/delivery.ts`, additions to `api-types.ts`.
- Client: `src/client/features/customer/checkout/{CheckoutPage,OrderSection,MethodSection,WhereWhenSection,DetailsSection,SummarySection,PlaceOrderBar,build-order-request,checkout-storage,use-delivery-options}.ts(x)`, `src/client/components/RadioCard.tsx`, menu delivery summary line, `copy.ts` additions.
- Tests: `tests/unit/{delivery-rules,order-schema,build-order-request}.test.ts`, `tests/integration/delivery-options.test.ts`.

## 16. Commands

```bash
pnpm dev
pnpm test
pnpm lint && pnpm typecheck
# Try cutoffs without waiting:
#   UPDATE delivery_slots SET cutoff_time = to_char(now() AT TIME ZONE 'Asia/Kolkata' + interval '2 min', 'HH24:MI') WHERE id = 1;
```
