/**
 * Money helpers. Amounts are rupees with two decimals; arithmetic is done in integer paise
 * to avoid floating-point drift (mirrors BigDecimal HALF_UP on the backend).
 */
const toPaise = (amount: number) => Math.round(amount * 100)

export function roundMoney(amount: number): number {
  return toPaise(amount) / 100
}

export function sumMoney(amounts: readonly number[]): number {
  return amounts.reduce((total, a) => total + toPaise(a), 0) / 100
}

/** `percent`% of `amount`, rounded half-up to two decimals. */
export function percentOf(amount: number, percent: number): number {
  return Math.round((toPaise(amount) * percent) / 100) / 100
}
