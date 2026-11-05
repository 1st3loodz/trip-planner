import { ActivityItem, Currency, DayPlan, EstimatedCostItem } from "@/types/trip";
import { Rates } from "@/lib/currency";

/**
 * Estimated-budget helpers (itinerary planning only).
 * Read-only calculations over itinerary activities — fully independent from
 * the expenses table / settlement logic.
 */

export const BUDGET_CATEGORIES: { id: string; label: string; emoji: string }[] = [
  { id: "food",          label: "Food",          emoji: "🍜" },
  { id: "transport",     label: "Transport",     emoji: "🚌" },
  { id: "accommodation", label: "Accommodation", emoji: "🏨" },
  { id: "activities",    label: "Activities",    emoji: "🎟️" },
  { id: "shopping",      label: "Shopping",      emoji: "🛍️" },
  { id: "other",         label: "Other",         emoji: "✨" },
];

export function budgetCategoryMeta(id: string | undefined) {
  return BUDGET_CATEGORIES.find((c) => c.id === id) ?? BUDGET_CATEGORIES[BUDGET_CATEGORIES.length - 1];
}

/** Map a legacy activity category to a budget category id. */
function legacyToBudgetCategory(cat: string | undefined): string {
  switch (cat) {
    case "food": return "food";
    case "hotel": return "accommodation";
    case "flight":
    case "transport": return "transport";
    case "shopping": return "shopping";
    case "sightseeing":
    case "free": return "activities";
    default: return "other";
  }
}

/**
 * Convert an amount into THB.
 * `rates[C]` = base-currency units per 1 C, so THB = amount * rates[C] / rates[THB].
 */
export function toTHB(amount: number, currency: Currency | string | undefined, rates: Rates): number {
  const value = Number(amount);
  if (!isFinite(value) || value <= 0) return 0;
  const cur = (currency ?? "THB") as Currency;
  if (cur === "THB") return value;
  const curRate = Number(rates?.[cur]);
  const thbRate = Number(rates?.THB);
  if (!(curRate > 0) || !(thbRate > 0)) return value; // no usable rate: fall back to raw amount
  return (value * curRate) / thbRate;
}

/**
 * All estimated cost items of an activity.
 * Backward compatible: a legacy single `estimatedCost` is exposed as one item.
 */
export function activityCostItems(act: ActivityItem | undefined | null): EstimatedCostItem[] {
  if (!act) return [];
  if (Array.isArray(act.estimatedCosts) && act.estimatedCosts.length > 0) {
    return act.estimatedCosts.filter((i) => i && Number(i.amount) > 0);
  }
  if (Number(act.estimatedCost) > 0) {
    return [{
      id: `legacy-${act.id}`,
      title: act.title || "Estimate",
      amount: Number(act.estimatedCost),
      category: legacyToBudgetCategory(act.category),
      currency: act.estimatedCurrency,
    }];
  }
  return [];
}

export function itemBudgetTHB(item: EstimatedCostItem, rates: Rates): number {
  return toTHB(item?.amount ?? 0, item?.currency, rates);
}

export function activityBudgetTHB(act: ActivityItem | undefined | null, rates: Rates): number {
  return activityCostItems(act).reduce((sum, i) => sum + itemBudgetTHB(i, rates), 0);
}

export function dayBudgetTHB(day: DayPlan | undefined | null, rates: Rates): number {
  const acts = Array.isArray(day?.activities) ? day!.activities : [];
  return acts.reduce((sum, a) => sum + activityBudgetTHB(a, rates), 0);
}

export function formatTHB(amount: number): string {
  return `฿${Math.round(amount).toLocaleString()}`;
}
