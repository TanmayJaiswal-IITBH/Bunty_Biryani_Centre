// Cart and order totals in integer rupees (Rule 1). The server's totals are authoritative (Rule 3);
// the client uses the same function only to display and to send `expectedTotal`.

export interface PricedLine {
  unitPrice: number;
  quantity: number;
}

export interface Totals {
  foodSubtotal: number;
  deliveryFee: number;
  total: number;
}

function assertWholeNumber(value: number, what: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${what} must be a non-negative integer, got ${value}`);
  }
}

export function computeTotals(lines: readonly PricedLine[], deliveryFee = 0): Totals {
  assertWholeNumber(deliveryFee, 'deliveryFee');
  let foodSubtotal = 0;
  for (const line of lines) {
    assertWholeNumber(line.unitPrice, 'unitPrice');
    assertWholeNumber(line.quantity, 'quantity');
    foodSubtotal += line.unitPrice * line.quantity;
  }
  assertWholeNumber(foodSubtotal, 'foodSubtotal');
  return { foodSubtotal, deliveryFee, total: foodSubtotal + deliveryFee };
}
