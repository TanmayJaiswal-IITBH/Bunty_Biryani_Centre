# BUNTY BIRYANI CENTER
# PHASE 1 — REAL DEPLOYED ORDERING MVP
## Product & Development Specification

Version: 1.2 (supersedes 1.1)
Changes from 1.1: single-service deployment; phone-verified order lookup; CANCELLED status; address detail field; order abuse limits; soft-delete menu; recurring daily slots; express ETA stored as minutes; item breakdown on dashboard; idempotent order creation; Batch 1 marked complete.

---

# 1. PRODUCT UNDERSTANDING

Bunty Biryani Center does NOT need a traditional restaurant website.

It needs a lightweight, mobile-first ordering system that behaves like a small self-owned food-ordering platform.

Every customer order is an INDIVIDUAL order. The only difference between orders is the delivery mode:

## BATCH DELIVERY
- Vendor offers fixed delivery slots per location (e.g. MSH → 8:00 PM, Kanhar → 8:45 PM).
- Customers order throughout the day and pick a slot.
- Individual orders for the same date + slot are grouped on the vendor dashboard.
- Vendor makes one trip per batch and distributes the individual orders.

## EXPRESS DELIVERY
- Customer orders any time instead of waiting for a batch.
- Vendor's delivery person delivers approximately 30–40 minutes later.
- Extra ₹30 delivery charge (configurable).
- NOT added to any batch. NOT a bulk/catering order.

This distinction is fundamental to the architecture.

---

# 2. PHASE 1 GOAL

Build and deploy a genuinely usable product.

**Customer can:**
1. Open the site on mobile.
2. See today's menu.
3. Add items to cart.
4. Choose delivery mode: Batch or Express.
5. Batch: choose an available location + slot.
6. Express: choose delivery location; ₹30 fee added automatically; "approx. 30–40 minutes" shown.
7. Enter name, phone, and (optionally) room/address detail.
8. Place the order (COD).
9. Receive an order ID and order summary.
10. Look up an order later using order ID + phone number.

**Vendor can:**
1. Log into a simple private dashboard.
2. See incoming orders with customer name/phone, items, quantities, total, COD, delivery mode, location, time.
3. See batch groups: date + location + slot, with order count, item count, COD total and per-item breakdown.
4. See express orders separately, with order time and approximate delivery window.
5. Mark an order COMPLETED, mark COD COLLECTED, or CANCEL an order (restores stock).
6. Manage menu and stock, delivery slots, express on/off, pause all orders.

The vendor is one person. The dashboard MUST stay extremely simple. Do NOT build a restaurant POS.

---

# 3. PAYMENT MODEL

Phase 1 is COD only. No online payment.

- Customer sees: `Payment: CASH ON DELIVERY`
- Admin sees: `Payment: COD` with status `PENDING` or `COLLECTED`
- Never show an order as "PAID" before cash is collected.
- After delivery the vendor may optionally mark `COD COLLECTED`. No further payment management.

---

# 4. DELIVERY METHOD (CHECKOUT UI)

```
DELIVERY METHOD

○ Batch Delivery
  Regular delivery
  Choose location and fixed delivery slot

○ Express Delivery
  Delivered in approximately 30–40 minutes
  +₹30 delivery charge
```

If express is off, show: "Express delivery is currently unavailable." Batch remains usable.

---

# 5. BATCH DELIVERY

Slots are configured in the database, never hardcoded in the frontend.

**Slots are recurring daily.** A slot is a (location, delivery time, cutoff time, active) rule. Each order stores the concrete `deliveryDate`. The vendor can toggle a slot off for the day without recreating it.

Initial data:

| Location | Delivery | Cutoff | Active |
|---|---|---|---|
| MSH | 8:00 PM | 7:30 PM | Yes |
| Kanhar | 8:45 PM | 8:15 PM | Yes |

Rules:
- Cutoff must be earlier than delivery time (validated on save).
- All times are `HH:mm`, interpreted in `Asia/Kolkata`.
- Vendor can edit locations, times, cutoffs and active state without code changes.

---

# 6. BATCH ORDER FLOW

Three customers order for MSH 8:00 PM at 2:00, 5:00 and 6:30 PM. These remain THREE separate orders. The dashboard shows:

```
MSH — 8:00 PM
3 orders · 6 items · COD total
Chicken Biryani ×5, Paneer Biryani ×1
```

Never merge orders into one customer order.

---

# 7. EXPRESS DELIVERY

Customer orders at 7:10 PM → system shows EXPRESS, approx. 30–40 minutes, fee ₹30.

Food ₹300 + Delivery ₹30 = Total ₹330.

The order has `deliveryMode = EXPRESS`, no `slotId`, and is never attached to a batch. Dashboard shows the order time and computed window (e.g. ordered 7:10 PM → approx. 7:40–7:50 PM).

Do not claim an exact ETA.

---

# 8. DELIVERY FEES

Backend calculates all fees. Never trust a frontend fee, price, stock or total.

| Mode | Fee | Source |
|---|---|---|
| Batch | ₹0 | `DeliverySettings.batchFee` |
| Express | ₹30 | `DeliverySettings.expressFee` |

All money is stored as integer rupees. No floats.

---

# 9. EXPRESS AVAILABILITY

Vendor control: `EXPRESS DELIVERY [ON/OFF]`.

If OFF, customers see "Express delivery is currently unavailable." Batch continues.

---

# 10. BATCH CUTOFF

Server decides whether a slot is open, using server time in `Asia/Kolkata`. The browser clock is never trusted.

After cutoff, customers see "Orders for this delivery slot are closed." If express is available, also show "Batch orders for MSH are closed. Express delivery is available." with a Try Express Delivery action.

---

# 11. VENDOR EMERGENCY CONTROLS

- `PAUSE EXPRESS DELIVERY` (the express ON/OFF switch).
- `PAUSE ALL ORDERS`: customers see "Orders are temporarily paused. Please check again shortly."

---

# 12. CUSTOMER FLOW

```
OPEN → TODAY'S MENU → CART → DELIVERY METHOD
  ├─ BATCH → LOCATION + SLOT
  └─ EXPRESS → LOCATION (+₹30)
→ NAME + PHONE (+ optional ROOM/ADDRESS)
→ ORDER SUMMARY (COD) → PLACE ORDER → CONFIRMED + ORDER ID
```

Keep it short. Express location selection is required because Bunty must know where to go.

---

# 13. CUSTOMER MENU

Each item: name, optional description, price, optional image, availability, quantity control, add-to-cart. Sold-out items are visible but not orderable.

---

# 14. INVENTORY

- `dailyStock` = what the vendor set today. `stockRemaining` = decremented per order. Sold = difference.
- At 0 the item shows SOLD OUT and cannot be ordered.
- Backend validates stock. Deduction uses an atomic conditional update (`stockRemaining >= qty`) inside the order transaction so simultaneous orders cannot oversell.
- Database `CHECK (stockRemaining >= 0)` as a last line of defence.
- Cancelling an order restores stock in a transaction.
- Vendor sets stock manually each day. No automatic daily reset in Phase 1.

---

# 15. ORDER DATA

Each order stores: order number (`BB` + sequence from 1001), customer name, phone, optional address detail, delivery mode, delivery date, location (+ name snapshot), slot (+ time snapshot, null for express), item rows with name and unit-price snapshots, food subtotal, delivery fee, total, payment method, payment status, order status, timestamps, and a client-generated `clientRequestId`.

Historical orders must never change when menu prices, locations or slots change.

---

# 16. ORDER STATUS

Keep it simple:

- `ORDER_RECEIVED` (default)
- `COMPLETED` (vendor marks after delivery)
- `CANCELLED` (vendor cancels; restores stock)

Payment status: `PENDING` → `COLLECTED` (optional).

No NEW → CONFIRMED → PREPARING → READY → OUT FOR DELIVERY → DELIVERED workflow.

Cancelled orders are excluded from dashboard counts and totals.

---

# 17. VENDOR DASHBOARD

```
BUNTY BIRYANI — TODAY
NEW ORDERS: 7

BATCH DELIVERY
MSH — 8:00 PM      4 orders · 9 items · ₹1,340 COD
  Chicken Biryani ×8, Paneer Biryani ×1
Kanhar — 8:45 PM   3 orders · 6 items · ₹900 COD

EXPRESS
2 active orders
```

Batch view lists each order (number, name, items, total, COD) plus batch totals. Express view lists each order with location, total, order time and approximate delivery window.

---

# 18. ADMIN MENU MANAGEMENT

Add, edit, change price, change stock, enable/disable items. "Delete" is a soft delete (`isActive = false`) so history is preserved. No coding needed to update today's menu.

---

# 19. DELIVERY CONFIGURATION

Vendor can configure locations, slot times, cutoffs, active state, express on/off, express fee, express ETA (min/max minutes; display text is generated, e.g. "30–40 minutes"), batch fee, and pause-all.

---

# 20. DATABASE

PostgreSQL via Prisma. Entities: `Admin`, `MenuItem`, `DeliveryLocation`, `DeliverySlot`, `DeliverySettings` (single row), `Order`, `OrderItem`.

Full schema: `prisma/schema.prisma` (Batch 1 deliverable).

Required migration extras:
- `CHECK ("stockRemaining" >= 0)`
- Order sequence starts at 1001
- Insert the single `DeliverySettings` row

---

# 21. API

**Public**
- `GET /api/menu`
- `GET /api/delivery-options` (server-computed slot open/closed, express availability, paused flag)
- `POST /api/orders`
- `GET /api/orders/:orderNumber?phone=...` (phone required; 404 on mismatch, never 403)

**Admin** (all protected except login)
- `POST /api/admin/login`, `POST /api/admin/logout`
- `GET /api/admin/dashboard`
- `GET /api/admin/orders`, `GET /api/admin/orders/:id`
- `PATCH /api/admin/orders/:id/status` (`COMPLETED` / `CANCELLED` / `paymentStatus: COLLECTED`)
- `GET/POST /api/admin/menu`, `PATCH /api/admin/menu/:id`, `DELETE /api/admin/menu/:id` (soft)
- `GET/POST /api/admin/delivery-slots`, `PATCH /api/admin/delivery-slots/:id`
- `GET/PATCH /api/admin/settings`

Request/response shapes: see `ARCHITECTURE.md`.

---

# 22. AUTHENTICATION

One admin account. Password hashed with argon2 (or bcrypt). JWT in an `httpOnly`, `Secure`, `SameSite=Lax` cookie. Login rate-limited. All admin routes and APIs protected. No customer accounts.

---

# 23. TECHNOLOGY AND DEPLOYMENT

- Frontend: React + Vite + Tailwind CSS
- Backend: Node.js + Express
- Database: PostgreSQL, ORM: Prisma
- Validation: zod

**Deployment: single service.** Express serves the built React app and `/api/*` from one origin. One Render or Railway service plus managed PostgreSQL. No Vercel split, no CORS, no cross-site cookies. Domain can be attached later. Secrets via environment variables.

---

# 24. MOBILE-FIRST DESIGN

Priorities: fast loading, large touch targets, clear menu, clear delivery choice, clear price, minimal checkout, clear confirmation.

Avoid heavy animations, 3D, particle effects, landing-page complexity, slow images. It should feel like a lightweight food-ordering app, not a portfolio site.

---

# 25. ORDER CREATION (SERVER)

Inside one database transaction:

1. If `ordersPaused` → reject.
2. If `clientRequestId` already exists → return the existing order (idempotent; protects against double-tap and flaky mobile networks).
3. Validate payload: name, Indian mobile format, quantities 1–10 per item, cap on lines per order, duplicate items merged.
4. BATCH: slot active, location active, server time before cutoff, location matches slot. EXPRESS: express enabled, location active, no slotId.
5. Load item prices from DB, compute subtotal.
6. For each item (sorted by id to avoid deadlocks): conditional atomic stock decrement; if it fails, roll back everything.
7. Fee from settings; total = subtotal + fee.
8. Create order and order items with snapshots.
9. Return confirmation.

Do not trust frontend price, stock, fee or total. Any critical failure leaves no partial order.

---

# 26. ABUSE PROTECTION

COD with no accounts invites prank orders. Phase 1 mitigations:

- Rate limit `POST /api/orders` per IP and per phone number.
- Per-item quantity cap and per-order line cap.
- Phone format validation.
- Vendor can cancel any order.

No OTP or WhatsApp verification in Phase 1.

---

# 27. BULK / CATERING

"Bulk" in earlier discussions means BATCH DELIVERY of individual orders. No catering workflow, no quotation system.

---

# 28. PHASE 1 EXCLUSIONS

Online payments, Razorpay, customer accounts, OTP, WhatsApp API, native apps, loyalty, coupons, analytics, catering quotations, multi-vendor, delivery tracking, driver app, detailed kitchen workflow.

---

# 29. TESTING CHECKLIST

**Customer:** menu loads · add to cart · quantity changes · checkout · batch selection · express selection · ₹30 fee correct · COD shown · order created · order ID generated · confirmation shown · order lookup works only with correct phone · double-tap does not create two orders.

**Batch:** MSH 8:00 PM and Kanhar 8:45 PM appear · cutoff works (server time) · multiple orders group correctly · vendor sees order/item counts, totals and item breakdown.

**Express:** on/off works · ₹30 added · does not join batch · shown separately · 30–40 min expectation shown · delivery window shown to vendor.

**Inventory:** stock decreases · cannot oversell (including two simultaneous orders for the last item) · sold-out items blocked · cancel restores stock.

**Admin:** login · protected routes return 401 without cookie · see new orders · see COD · customer info · delivery mode · location/time · edit menu and stock · configure slots · pause express · pause all · mark completed / COD collected / cancel.

**Mobile:** Android Chrome · responsive · no horizontal scroll · fast on a normal connection.

---

# 30. DEFINITION OF DONE

Phase 1 is complete only when Bunty can actually use it.

Customer: open → select food → choose batch or express → enter details → place COD order → get order ID.

Bunty: open admin → see new orders → see COD, items, location, batch/express → prepare and deliver.

For batch he must instantly see "How many orders (and how many of each item) for MSH at 8 PM?" For express he must instantly see "Which orders need to go out separately right now?"

---

# 31. DEVELOPMENT PROCESS

Build in batches. After each: explain what was built, list files changed, give commands, give exact tests, fix failures before moving on.

| Batch | Scope | Status |
|---|---|---|
| 1 | Architecture + database schema + API design | **Done** |
| 2 | Project setup, database, migrations + seed, admin authentication | Next |
| 3 | Customer menu + cart | |
| 4 | Checkout + batch/express delivery selection | |
| 5 | Order creation + inventory | |
| 6 | Vendor dashboard + batch grouping | |
| 7 | Testing + mobile polish | |
| 8 | Deployment + production verification | |

---

# 32. ENGINEERING PRINCIPLE

Act as a senior full-stack engineer. Challenge requirements that are insecure, unnecessarily complex, hard to maintain, or likely to fail in production.

Prefer correctness over features, simplicity over complexity, mobile UX over flashy design, operational usefulness over portfolio aesthetics.

This is a real pilot for a real food vendor. Build the smallest system that genuinely solves his ordering and delivery workflow.
