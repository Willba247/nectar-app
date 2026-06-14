/**
 * Compute a new queue skip price based on demand signals.
 *
 * D is a relative demand score — it measures change from the previous
 * submission, not absolute demand against a fixed neutral. D=1 when current
 * conditions equal the previous submission (price unchanged). D>1 when demand
 * rose; D<1 when demand fell.
 *
 * On the first submission of the night (no previous signal), prevWaitTimeMinutes
 * and prevSalesLast15Min default to W_N=10 and S_N=2 (neutral conditions), so
 * the first call behaves identically to the original absolute formula.
 *
 * Hard clamps ($0.50 / $299.99) are applied by the caller (submitDemandSignal
 * mutation) AFTER this function returns — never inside this function.
 *
 * @param currentPrice         The current venues.price at time of submission
 * @param waitTimeMinutes      Manager-submitted estimated queue wait in minutes
 * @param salesLast15Min       Count of paid transactions in the last 15 minutes
 * @param prevWaitTimeMinutes  Wait time from the previous signal (defaults to W_N=10)
 * @param prevSalesLast15Min   Sales from the previous signal (defaults to S_N=2)
 * @returns New price as a string with exactly 2 decimal places
 */
export function computeDynamicPrice(
  currentPrice: number,
  waitTimeMinutes: number,
  salesLast15Min: number,
  prevWaitTimeMinutes = 10,
  prevSalesLast15Min  = 2,
): string {
  const FLOOR = 5.0;
  const W_N   = 10;   // neutral fallback when no previous signal exists
  const S_N   = 2;    // neutral fallback when no previous signal exists
  const alpha = 0.70;
  const k     = 0.75;

  // Guard against div-by-zero: if prev value is 0, fall back to neutral constant
  const waitDenom  = prevWaitTimeMinutes > 0 ? prevWaitTimeMinutes : W_N;
  const salesDenom = prevSalesLast15Min  > 0 ? prevSalesLast15Min  : S_N;

  const D          = alpha * (waitTimeMinutes / waitDenom) + (1 - alpha) * (salesLast15Min / salesDenom);
  const multiplier = Math.pow(D, k);
  const newPrice   = Math.max(FLOOR, currentPrice * multiplier);

  return newPrice.toFixed(2);
}
