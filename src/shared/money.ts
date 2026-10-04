// Money is integer rupees everywhere (Batch 1 M1). Format only for display.

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function formatINR(rupees: number): string {
  return inr.format(rupees);
}
