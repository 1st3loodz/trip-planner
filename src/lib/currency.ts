import { Currency, CURRENCY_META } from "@/types/trip";

// ─── Types ─────────────────────────────────────────────────────────────────

/**
 * Rates map: rates[C] = "how many base-currency units does 1 unit of C buy?"
 * e.g. if base=THB, rates[CNY]=5.16 means 1 CNY = 5.16 THB
 */
export type Rates = Record<Currency, number>;

// ─── Default exchange rates (approximate, June 2025) ───────────────────────

export const DEFAULT_RATES: Record<Currency, Rates> = {
  THB: { THB: 1.0,      CNY: 5.16,    JPY: 0.225,  USD: 35.5,   KZT: 0.077  },
  CNY: { THB: 0.1938,   CNY: 1.0,     JPY: 0.0436, USD: 7.25,   KZT: 0.015  },
  JPY: { THB: 4.44,     CNY: 22.95,   JPY: 1.0,    USD: 157.5,  KZT: 0.33   },
  USD: { THB: 0.02817,  CNY: 0.1379,  JPY: 0.00635,USD: 1.0,    KZT: 0.0022 },
  KZT: { THB: 13.0,     CNY: 66.0,    JPY: 3.0,    USD: 450.0,  KZT: 1.0    },
};

// ─── Conversion helpers ─────────────────────────────────────────────────────

/** Convert an amount in `currency` to the base currency using `rates`. */
export function convertToBase(
  amount: number,
  currency: Currency,
  rates: Rates
): number {
  return amount * (rates[currency] ?? 1);
}

/** Format a base-currency amount with its symbol and 0-2 decimal places. */
export function formatBase(amount: number, baseCurrency: Currency): string {
  const { symbol } = CURRENCY_META[baseCurrency];
  const isJPY = baseCurrency === "JPY";
  const rounded = isJPY ? Math.round(amount) : parseFloat(amount.toFixed(2));
  return `${symbol}${rounded.toLocaleString()}`;
}
