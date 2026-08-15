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

/** Resolves the exact effective exchange rate for an expense. */
export const getExpenseEffectiveRate = (expense: any): number => {
  // 1. Custom rate entered by user takes highest priority
  const customRate = Number(expense?.custom_exchange_rate) || Number(expense?.customExchangeRate);
  if (customRate > 0) return customRate;

  // 2. Exact exchange rate stored on the expense (e.g. 0.209096 from API/DB)
  const recordedRate = Number(expense?.exchange_rate) || Number(expense?.exchangeRate) || Number(expense?.historicalRate);
  if (recordedRate > 0) return recordedRate;

  // 3. If THB, rate is 1. If foreign currency with missing rate, calculate from amount/foreign_amount if available
  if (expense?.currency === 'THB') return 1;
  if (Number(expense?.amount) > 0 && (Number(expense?.foreign_amount) > 0 || Number(expense?.foreignAmount) > 0)) {
    const foreign = Number(expense?.foreign_amount) || Number(expense?.foreignAmount);
    return Number(expense.amount) / foreign;
  }

  return 1;
};
