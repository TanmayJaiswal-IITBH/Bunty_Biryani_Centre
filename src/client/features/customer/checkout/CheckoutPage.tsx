import type { DeliverySlotOption, PublicMenu } from '@shared/api-types.js';
import type { DeliveryMode } from '@shared/enums.js';
import { formatINR } from '@shared/money.js';
import { computeTotals } from '@shared/pricing.js';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router';
import { Banner } from '../../../components/Banner';
import { ErrorState } from '../../../components/ErrorState';
import { Icon } from '../../../components/Icon';
import { Skeleton } from '../../../components/Skeleton';
import { copy } from '../../../copy';
import { readStorage, removeStorage, writeStorage } from '../../../lib/storage';
import { useElapsedMinutes } from '../../../lib/use-elapsed-minutes';
import { useInView } from '../../../lib/use-in-view';
import { CART_EMPTY_STATE } from '../cart/cart-empty';
import { cartView } from '../cart/cart-reducer';
import { useCart } from '../cart/CartProvider';
import { useMenu } from '../menu/use-menu';
import {
  FIELD_ORDER,
  buildOrderRequest,
  type DetailsForm,
  type FieldErrors,
  type OrderField,
} from './build-order-request';
import {
  CHECKOUT_DRAFT_KEY,
  REMEMBERED_CUSTOMER_KEY,
  parseDraft,
  parseRemembered,
  serializeDraft,
} from './checkout-storage';
import {
  DetailsSection,
  EMPTY_DETAILS,
  detailError,
  rememberedDetails,
  tidyDetail,
  type DetailField,
} from './DetailsSection';
import { MethodSection } from './MethodSection';
import { OrderSection } from './OrderSection';
import { PlaceOrderBar, isTextEntry } from './PlaceOrderBar';
import {
  NO_SELECTION,
  chooseMethod,
  defaultSelection,
  isBatchOpen,
  isExpressOpen,
  resolveSelection,
  type Selection,
} from './selection';
import { SummarySection } from './SummarySection';
import { useDeliveryOptions, type LoadedDeliveryOptions } from './use-delivery-options';
import { WhereWhenSection } from './WhereWhenSection';

const c = copy.customer.checkout;
const m = copy.customer.menu;

// Batch 4 stub (Decision 9): a valid v4-shaped id. Batch 5 replaces it with a real id that is
// generated once and reused on retry.
const PLACEHOLDER_REQUEST_ID = '00000000-0000-4000-8000-000000000000';

const DRAFT_DEBOUNCE_MS = 300;
const DELIVERY_FIELDS: readonly OrderField[] = ['deliveryMode', 'slotId', 'locationId'];
const DETAIL_FIELDS: readonly OrderField[] = ['customerName', 'customerPhone', 'addressDetail'];
/** The radio group (input `name`) that shows each choice field's error. */
const RADIO_GROUPS: Partial<Record<OrderField, string>> = {
  deliveryMode: 'deliveryMode',
  slotId: 'slotId',
  locationId: 'expressLocationId',
};

type PendingFocus = { field: OrderField } | { expressLocationId: number } | { orderHeading: true };

function withoutErrors(errors: FieldErrors, fields: readonly OrderField[]): FieldErrors {
  const next = { ...errors };
  for (const field of fields) delete next[field];
  return next;
}

function withError(errors: FieldErrors, field: OrderField, message: string | undefined) {
  return message ? { ...errors, [field]: message } : withoutErrors(errors, [field]);
}

/** A field's text input, or the first radio in its group that can be chosen (else the first). */
function focusTarget(form: HTMLFormElement, field: OrderField): HTMLElement | null {
  const group = RADIO_GROUPS[field];
  if (group) {
    return (
      form.querySelector<HTMLElement>(`input[name="${group}"]:not([aria-disabled="true"])`) ??
      form.querySelector<HTMLElement>(`input[name="${group}"]`)
    );
  }
  // Items: the first control in Your order, the form's first section.
  if (field === 'items') return form.querySelector<HTMLElement>('button');
  return form.querySelector<HTMLElement>(`input[name="${field}"]`);
}

function readStored() {
  return {
    draft: parseDraft(readStorage(CHECKOUT_DRAFT_KEY, 'session')),
    remembered: parseRemembered(readStorage(REMEMBERED_CUSTOMER_KEY)),
  };
}

interface CheckoutFormProps {
  menu: PublicMenu;
  /** Undefined until the first successful fetch. */
  options: LoadedDeliveryOptions | undefined;
  optionsFailed: boolean;
  optionsRetrying: boolean;
  onRetryOptions: () => void;
}

function CheckoutForm({
  menu,
  options,
  optionsFailed,
  optionsRetrying,
  onRetryOptions,
}: CheckoutFormProps) {
  const { cart, notices, increment, decrement, dismissNotices } = useCart();
  const [stored] = useState(readStored);
  const [remembered, setRemembered] = useState(stored.remembered);
  // A customer can't choose "no method", so a draft without one only saved a default: restore its
  // details (below) but not its selection, so today's default applies again.
  const [selection, setSelection] = useState<Selection | null>(
    stored.draft?.selection.deliveryMode ? stored.draft.selection : null,
  );
  const [details, setDetails] = useState<DetailsForm>(
    () => stored.draft?.details ?? rememberedDetails(stored.remembered),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [dirty, setDirty] = useState<ReadonlySet<DetailField>>(() => new Set());
  const [typing, setTyping] = useState(false);
  const [notSent, setNotSent] = useState(false);
  // The in-form Place order button. While it is fully on screen the sticky bar steps aside, so
  // the end of the page shows one button, not two.
  const [inFormSubmit, setInFormSubmit] = useState<HTMLButtonElement | null>(null);
  const inFormSubmitVisible = useInView(inFormSubmit);
  // Set only by a tap (submit with errors, Try Express); the effect below consumes it.
  const pendingFocus = useRef<PendingFocus | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const whereWhenRef = useRef<HTMLFieldSetElement>(null);
  const orderHeadingRef = useRef<HTMLHeadingElement>(null);

  // Decision 5: the initial choice (draft, else the default) is set once, during render, when the
  // options first arrive. Whether it is still valid is derived below, never cleared in an effect.
  if (selection === null && options) setSelection(defaultSelection(remembered, options));

  const view = cartView(menu, cart);
  const resolved = options && selection ? resolveSelection(selection, options) : null;
  const fee =
    options && resolved?.mode
      ? resolved.mode === 'BATCH'
        ? options.batch.fee
        : options.express.fee
      : 0;
  const totals = computeTotals(
    view.lines.map((line) => ({ unitPrice: line.price, quantity: line.quantity })),
    fee,
  );
  const elapsed = useElapsedMinutes(options?.receivedAt ?? 0);
  const nothingOpen = options ? !isBatchOpen(options) && !isExpressOpen(options) : false;
  const disabled = !options || options.ordersPaused || nothingOpen;
  const label = options?.ordersPaused ? c.pausedButton : c.placeOrder(formatINR(totals.total));
  // While options load, a restored method shows its list as skeletons; once they arrive, only a
  // method that is still valid shows one.
  const whereWhenMode: DeliveryMode | null = options
    ? (resolved?.mode ?? null)
    : optionsFailed
      ? null
      : (selection?.deliveryMode ?? null);

  useEffect(() => {
    if (selection === null) return;
    const timer = setTimeout(() => {
      writeStorage(CHECKOUT_DRAFT_KEY, serializeDraft({ selection, details }), 'session');
    }, DRAFT_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [selection, details]);

  useEffect(() => {
    const target = pendingFocus.current;
    pendingFocus.current = null;
    const form = formRef.current;
    if (!target || !form) return;
    if ('orderHeading' in target) {
      orderHeadingRef.current?.focus();
    } else if ('field' in target) {
      const el = focusTarget(form, target.field);
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: 'center' });
    } else {
      const radio =
        form.querySelector<HTMLElement>(
          `input[name="expressLocationId"][value="${target.expressLocationId}"]`,
        ) ?? focusTarget(form, 'locationId');
      radio?.focus({ preventScroll: true });
      whereWhenRef.current?.scrollIntoView({ block: 'center' });
    }
  });

  function clearErrors(fields: readonly OrderField[]) {
    setErrors((prev) => withoutErrors(prev, fields));
  }

  function onChooseMethod(mode: DeliveryMode) {
    setSelection((prev) => chooseMethod(prev ?? NO_SELECTION, mode));
    clearErrors(DELIVERY_FIELDS);
  }

  function onChooseSlot(slot: DeliverySlotOption) {
    setSelection({ deliveryMode: 'BATCH', slotId: slot.id, locationId: slot.locationId });
    clearErrors(['slotId']);
  }

  function onChooseExpressLocation(locationId: number) {
    setSelection({ deliveryMode: 'EXPRESS', slotId: null, locationId });
    clearErrors(['locationId']);
  }

  function onTryExpress(slot: DeliverySlotOption) {
    setSelection({ deliveryMode: 'EXPRESS', slotId: null, locationId: slot.locationId });
    clearErrors(DELIVERY_FIELDS);
    pendingFocus.current = { expressLocationId: slot.locationId };
  }

  function onDetailChange(field: DetailField, value: string) {
    setDetails((prev) => ({ ...prev, [field]: value }));
    setDirty((prev) => (prev.has(field) ? prev : new Set(prev).add(field)));
    if (errors[field]) setErrors((prev) => withError(prev, field, detailError(field, value)));
  }

  function onDetailBlur(field: DetailField) {
    const value = tidyDetail(field, details[field]);
    if (value !== details[field]) setDetails((prev) => ({ ...prev, [field]: value }));
    if (dirty.has(field)) setErrors((prev) => withError(prev, field, detailError(field, value)));
  }

  function onDecrement(menuItemId: number) {
    // Removing a line removes the focused button; with other lines left, focus moves to the
    // heading (an emptied cart redirects away instead).
    const line = view.lines.find((l) => l.menuItemId === menuItemId);
    if (line?.quantity === 1 && view.lines.length > 1)
      pendingFocus.current = { orderHeading: true };
    decrement(menuItemId);
  }

  function onForget() {
    removeStorage(REMEMBERED_CUSTOMER_KEY);
    setRemembered(null);
    setDetails(EMPTY_DETAILS);
    setDirty(new Set());
    clearErrors(DETAIL_FIELDS);
    // "Not you? Clear details" removes itself.
    pendingFocus.current = { field: 'customerName' };
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (disabled || !selection) return;
    const result = buildOrderRequest({
      cartView: view,
      selection,
      details,
      options,
      clientRequestId: PLACEHOLDER_REQUEST_ID,
    });
    if (!result.ok) {
      setErrors(result.errors);
      setNotSent(false);
      const first = FIELD_ORDER.find((field) => result.errors[field]);
      if (first) pendingFocus.current = { field: first };
      return;
    }
    // Batch 5 replaces this branch: send `result.request`.
    setErrors({});
    setNotSent(true);
  }

  return (
    <>
      {options?.ordersPaused ? (
        <Banner tone="warning" role="alert" className="mb-4">
          {c.paused}
        </Banner>
      ) : nothingOpen ? (
        <Banner tone="info" className="mb-4">
          {c.nothingOpen}
        </Banner>
      ) : null}
      <form
        id="checkout-form"
        ref={formRef}
        noValidate
        onSubmit={onSubmit}
        onFocus={(e) => {
          if (isTextEntry(e.target)) setTyping(true);
        }}
        onBlur={(e) => {
          if (!isTextEntry(e.relatedTarget)) setTyping(false);
        }}
        className="flex flex-col gap-8"
      >
        <OrderSection
          view={view}
          items={menu.items}
          notices={notices}
          error={errors.items}
          onIncrement={increment}
          onDecrement={onDecrement}
          headingRef={orderHeadingRef}
          onDismissNotices={dismissNotices}
        />
        <MethodSection
          options={options}
          loadFailed={optionsFailed}
          retrying={optionsRetrying}
          onRetry={onRetryOptions}
          mode={resolved?.mode ?? null}
          expressUnavailableNotice={
            resolved?.notices.some((n) => n.kind === 'expressUnavailable') ?? false
          }
          error={errors.deliveryMode}
          onChoose={onChooseMethod}
        />
        {whereWhenMode ? (
          <WhereWhenSection
            ref={whereWhenRef}
            mode={whereWhenMode}
            options={options}
            resolved={resolved}
            elapsedMinutes={elapsed}
            error={whereWhenMode === 'BATCH' ? errors.slotId : errors.locationId}
            onChooseSlot={onChooseSlot}
            onChooseExpressLocation={onChooseExpressLocation}
            onTryExpress={onTryExpress}
          />
        ) : null}
        <DetailsSection
          details={details}
          errors={errors}
          mode={resolved?.mode ?? null}
          canForget={remembered !== null}
          onChange={onDetailChange}
          onBlur={onDetailBlur}
          onForget={onForget}
        />
        <SummarySection
          totals={totals}
          resolved={resolved}
          expressEta={options?.express.etaText ?? ''}
          notSent={notSent}
          submitDisabled={disabled}
          submitLabel={label}
          submitRef={setInFormSubmit}
        />
      </form>
      <PlaceOrderBar hidden={typing || inFormSubmitVisible} disabled={disabled} label={label} />
    </>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {/* The skeleton blocks are aria-hidden; screen readers hear this instead. */}
      <p role="status" className="sr-only">
        {copy.common.loading}
      </p>
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

/** `/checkout` (Batch 4 §5): one page from the cart to Place order. */
export function CheckoutPage() {
  const { cart } = useCart();
  // Reconciles the cart on every successful fetch (see useMenu).
  const {
    data: menu,
    error: menuError,
    isValidating: menuValidating,
    mutate: refreshMenu,
  } = useMenu();
  const {
    data: options,
    error: optionsError,
    isValidating: optionsValidating,
    mutate: refreshOptions,
  } = useDeliveryOptions(30_000);

  // Arriving empty, removing the last line, reconcile emptying it, another tab emptying it (§5.2).
  if (cart.lines.length === 0) return <Navigate to="/" replace state={CART_EMPTY_STATE} />;

  return (
    <>
      <header className="bg-sun">
        <div className="mx-auto flex max-w-120 items-center justify-between gap-3 px-2">
          <Link to="/" className="inline-flex min-h-12 items-center gap-1 px-2 font-semibold">
            <Icon name="chevron-left" />
            {c.back}
          </Link>
          <h1 className="display px-2 text-lg">{c.title}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-120 px-4 pt-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        {menu ? (
          <CheckoutForm
            menu={menu}
            options={options}
            optionsFailed={!options && Boolean(optionsError)}
            optionsRetrying={optionsValidating}
            onRetryOptions={() => void refreshOptions()}
          />
        ) : menuError ? (
          <ErrorState
            title={m.loadErrorTitle}
            message={m.loadErrorMessage}
            onRetry={() => void refreshMenu()}
            retrying={menuValidating}
          />
        ) : (
          <CheckoutSkeleton />
        )}
      </main>
    </>
  );
}
