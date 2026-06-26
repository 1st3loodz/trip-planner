// ─── Currencies ───────────────────────────────────────────────────────────────

export type Currency = "THB" | "JPY" | "CNY" | "USD" | "KZT";

export const CURRENCY_META: Record<Currency, { symbol: string; label: string; flag: string }> = {
  THB: { symbol: "฿",  label: "Thai Baht (THB)",    flag: "🇹🇭" },
  JPY: { symbol: "¥",  label: "Japanese Yen (JPY)",  flag: "🇯🇵" },
  CNY: { symbol: "¥",  label: "Chinese Yuan (CNY)",  flag: "🇨🇳" },
  USD: { symbol: "$",  label: "US Dollar (USD)",     flag: "🇺🇸" },
  KZT: { symbol: "₸",  label: "Kazakhstani Tenge (KZT)", flag: "🇰🇿" },
};

// ─── Expense Categories (Thai labels) ─────────────────────────────────────────

export type ExpenseCategory =
  | "accommodation"
  | "transportation"
  | "food"
  | "entrance"
  | "shopping"
  | string;

export const EXPENSE_CATEGORY_META: Record<
  ExpenseCategory,
  { label: string; sublabel: string; emoji: string; color: string }
> = {
  accommodation: {
    label: "ที่พัก",
    sublabel: "Accommodation",
    emoji: "🏨",
    color: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  transportation: {
    label: "การเดินทาง",
    sublabel: "Transportation",
    emoji: "🚌",
    color: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  },
  food: {
    label: "ทั่วไป(ของกิน)",
    sublabel: "Food & Drinks",
    emoji: "🍜",
    color: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  },
  entrance: {
    label: "ค่าเข้าต่างๆ",
    sublabel: "Entrance Fees",
    emoji: "🎟️",
    color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
  shopping: {
    label: "Shopping",
    sublabel: "Shopping",
    emoji: "🛍️",
    color: "bg-pink-500/15 text-pink-300 border-pink-500/30",
  },
};

// ─── Participants ─────────────────────────────────────────────────────────────

export interface Participant {
  id: string;
  name: string;
  color: string;
  avatarUrl?: string;
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

export interface ExpenseSplit {
  participantId: string;
  amount: number;
  /** Sub-expense level settlement (e.g. A paid B directly for their share of this specific expense) */
  isSettled?: boolean;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  currency: Currency;
  category: ExpenseCategory;
  paidById: string;
  splits: ExpenseSplit[];
  /** Date of the expense: "YYYY-MM-DD" */
  date: string;
  /** ISO timestamp of when the record was created */
  createdAt: string;
  /** Exclude from total trip cost and settlements */
  isExcluded?: boolean;
  /** Frozen live FX rate at the moment of creation */
  historicalRate?: number;
  /** Frozen base currency amount at the moment of creation */
  historicalBaseAmount?: number;
}

// ─── Itinerary ────────────────────────────────────────────────────────────────

export type ActivityCategory =
  | "flight"
  | "hotel"
  | "food"
  | "sightseeing"
  | "transport"
  | "free"
  | "shopping"
  | string;

export interface ActivityItem {
  id: string;
  time: string;
  title: string;
  description?: string;
  location?: string;
  transportationNote?: string;
  category: ActivityCategory;
}

export interface DayPlan {
  dayNumber: number;
  date: string;
  label?: string;
  activities: ActivityItem[];
}

// ─── Trip ─────────────────────────────────────────────────────────────────────

export type TripStatus = "next" | "past" | "bucket";

export interface CustomCategory {
  id: string;
  label: string;
  emoji: string;
}

export interface Trip {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: TripStatus;
  participants: Participant[];
  days: DayPlan[];
  expenses: Expense[];
  customCategories?: CustomCategory[];
  travelType?: "solo" | "group";
  baseCurrency?: Currency;
  notice?: string;
  /** UUID of the user who created this trip — used for ownership checks */
  createdBy?: string;
}

// ─── Settlement ───────────────────────────────────────────────────────────────

export interface Settlement {
  fromId: string;
  toId: string;
  amount: number;
  historicAmount?: number;
  currency: Currency;
  involvedExpenses?: { expense: Expense; amountOwed: number; isCredit?: boolean }[];
}
