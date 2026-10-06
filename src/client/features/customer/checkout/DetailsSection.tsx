import type { DeliveryMode } from '@shared/enums.js';
import { ADDRESS_MAX } from '@shared/limits.js';
import { formatPhone, normalizeIndianMobile } from '@shared/phone.js';
import { customerDetailsSchema } from '@shared/schemas/order.js';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { TextField } from '../../../components/TextField';
import { copy } from '../../../copy';
import type { DetailsForm, FieldErrors } from './build-order-request';
import type { RememberedCustomer } from './checkout-storage';

const c = copy.customer.checkout;

/** The address counter appears once the text is longer than this (§5.6). */
const COUNTER_AFTER = 100;

export type DetailField = keyof DetailsForm;

export const EMPTY_DETAILS: DetailsForm = {
  customerName: '',
  customerPhone: '',
  addressDetail: '',
};

/** The form prefilled from the last order's details (§7), phone shown as `98765 43210`. */
export function rememberedDetails(remembered: RememberedCustomer | null): DetailsForm {
  if (!remembered) return EMPTY_DETAILS;
  return {
    customerName: remembered.customerName,
    customerPhone: formatPhone(remembered.customerPhone),
    addressDetail: remembered.addressDetail ?? '',
  };
}

/** The field's own validation message, or undefined when it is valid. */
export function detailError(field: DetailField, value: string): string | undefined {
  const result = customerDetailsSchema.shape[field].safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
}

/** On blur: the name is trimmed and space-collapsed; a valid phone shows as `98765 43210`. */
export function tidyDetail(field: DetailField, value: string): string {
  if (field === 'customerName') return value.trim().replace(/\s+/g, ' ');
  if (field === 'customerPhone') {
    const tenDigits = normalizeIndianMobile(value);
    return tenDigits ? formatPhone(tenDigits) : value;
  }
  return value;
}

/**
 * Where Enter (desktop) or the keyboard's action key (phone) goes from a details field: the next
 * field, or null after the last, which just closes the keyboard. Enter never submits the form;
 * only a button tap does.
 */
export function enterTarget(field: DetailField): DetailField | null {
  if (field === 'customerName') return 'customerPhone';
  if (field === 'customerPhone') return 'addressDetail';
  return null;
}

function onEnter(name: DetailField, e: KeyboardEvent<HTMLInputElement>) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const next = enterTarget(name);
  if (next === null) {
    e.currentTarget.blur();
    return;
  }
  e.currentTarget.form?.querySelector<HTMLInputElement>(`input[name="${next}"]`)?.focus();
}

interface DetailsSectionProps {
  details: DetailsForm;
  errors: FieldErrors;
  /** The chosen method, for the address hint. */
  mode: DeliveryMode | null;
  /** Remembered details were prefilled, so offer to clear them. */
  canForget: boolean;
  onChange: (field: DetailField, value: string) => void;
  onBlur: (field: DetailField) => void;
  onForget: () => void;
}

/** Your details (§5.6): name, mobile number and an optional room or address. */
export function DetailsSection({
  details,
  errors,
  mode,
  canForget,
  onChange,
  onBlur,
  onForget,
}: DetailsSectionProps) {
  const field = (name: DetailField) => ({
    name,
    value: details[name],
    error: errors[name],
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      onChange(name, e.target.value);
    },
    onBlur: () => {
      onBlur(name);
    },
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
      onEnter(name, e);
    },
  });
  const addressLength = details.addressDetail.length;

  return (
    <section>
      <h2 className="display text-lg">{c.detailsHeading}</h2>
      {canForget ? (
        <button
          type="button"
          onClick={onForget}
          className="inline-flex min-h-12 items-center font-semibold text-brand underline underline-offset-2"
        >
          {c.forget}
        </button>
      ) : null}
      <div className="mt-3 flex flex-col gap-4">
        <TextField
          label={c.name}
          {...field('customerName')}
          autoComplete="name"
          autoCapitalize="words"
          enterKeyHint="next"
        />
        <TextField
          label={c.phone}
          {...field('customerPhone')}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder={c.phonePlaceholder}
        />
        <TextField
          label={c.address}
          {...field('addressDetail')}
          autoComplete="off"
          maxLength={ADDRESS_MAX}
          enterKeyHint="done"
          hint={mode === 'EXPRESS' ? c.addressHintExpress : c.addressHintBatch}
          counter={
            addressLength > COUNTER_AFTER ? c.addressCount(addressLength, ADDRESS_MAX) : undefined
          }
        />
      </div>
    </section>
  );
}
