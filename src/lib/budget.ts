import { ActivityItem, Currency, DayPlan } from "@/types/trip";
import { Rates } from "@/lib/currency";

/**
 * Estimated-budget helpers (itinerary planning only).
 * These are read-only calculations over itinerary activities and are fully
 * independent from the expenses table / settlement logic.
 */

/**
 * Convert an amount into THB.
 * `rates[C]` = base-currency units per 1 C, so THB = amount * rates[C] / rates[THB].
 */
export function toTHB(amount: number, currency: Currency | undefined, rates: Rates): number {
  const value = Number(amount);
  if (!isFinite(value) || value <= 0) return 0;
  const cur: Currency = currency ?? "THB";
  if (cur === "THB") return value;
  const curRate = Number(rates?.[cur]);
  const thbRate = Number(rates?.THB);
  if (!(curRate > 0) || !(thbRate > 0)) return value; // no usable rate: fall back to raw amount
  return (value * curRate) / thbRate;
}

export function activityBudgetTHB(act: ActivityItem | undefined | null, rates: Rates): number {
  if (!act) return 0;
  return toTHB(act.estimatedCost ?? 0, act.estimatedCurrency, rates);
}

export function dayBudgetTHB(day: DayPlan | undefined | null, rates: Rates): number {
  const acts = Array.isArray(day?.activities) ? day!.activities : [];
  return acts.reduce((sum, a) => sum + activityBudgetTHB(a, rates), 0);
}

export function formatTHB(amount: number): string {
  return `฿${Math.round(amount).toLocaleString()}`;
}
