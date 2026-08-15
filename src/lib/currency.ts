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
export const getExchangeRate = (expense: any): number => {
  const customRate = Number(expense?.custom_exchange_rate) || Number(expense?.customExchangeRate);
  if (customRate > 0) return customRate;

  const recordedRate = Number(expense?.exchange_rate) || Number(expense?.exchangeRate) || Number(expense?.historicalRate);
  if (recordedRate > 0 && recordedRate !== 1) return recordedRate;

  // Fallback defaults if rate was missing or saved as 1 for foreign currency
  if (expense?.currency === 'JPY') return 0.209096;
  if (expense?.currency === 'USD') return 36.0;
  if (expense?.currency === 'EUR') return 39.0;
  if (expense?.currency === 'KRW') return 0.027;
  if (expense?.currency === 'CNY') return 5.0;

  return 1;
};

export const getConvertedAmountTHB = (expense: any): number => {
  if (!expense) return 0;
  const currency = expense.currency || 'THB';
  if (currency === 'THB') return Number(expense.amount) || 0;

  const rate = getExchangeRate(expense);
  // Use foreign_amount if present; if foreign_amount is 0/missing, check amount
  const foreignVal = Number(expense.foreign_amount) > 0 
    ? Number(expense.foreign_amount) 
    : (Number(expense.foreignAmount) > 0 ? Number(expense.foreignAmount) : Number(expense.amount) || 0);

  return foreignVal * rate;
};
