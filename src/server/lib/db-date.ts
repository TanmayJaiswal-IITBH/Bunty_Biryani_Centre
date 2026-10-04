// Business dates are 'YYYY-MM-DD' strings in code. They become a JS Date (UTC midnight) only at
// the Prisma boundary for @db.Date columns (Batch 1 T5).

export function toDbDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function fromDbDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
