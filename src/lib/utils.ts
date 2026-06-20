import { ActivityCategory } from "@/types/trip";

export const ACTIVITY_CATEGORY_META: Record<
  ActivityCategory,
  { label: string; emoji: string; color: string }
> = {
  flight:      { label: "Flight",      emoji: "✈️",  color: "bg-blue-500/20 text-blue-300 border-blue-500/30"        },
  hotel:       { label: "Hotel",       emoji: "🏨",  color: "bg-amber-500/20 text-amber-300 border-amber-500/30"     },
  food:        { label: "Food",        emoji: "🍜",  color: "bg-orange-500/20 text-orange-300 border-orange-500/30"  },
  sightseeing: { label: "Sightseeing", emoji: "🏯",  color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  transport:   { label: "Transport",   emoji: "🚌",  color: "bg-purple-500/20 text-purple-300 border-purple-500/30"  },
  free:        { label: "Free Time",   emoji: "☀️",  color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
  shopping:    { label: "Shopping",    emoji: "🛍️", color: "bg-pink-500/20 text-pink-300 border-pink-500/30"        },
};

export function formatCurrency(amount: number, currency: string): string {
  const localeMap: Record<string, string> = {
    THB: "th-TH", JPY: "ja-JP", CNY: "zh-CN", USD: "en-US",
  };
  return new Intl.NumberFormat(localeMap[currency] ?? "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(isoDate: string): string {
  if (!isoDate) return "—";
  // Use en-GB locale to enforce DD/MM/YY formatting order
  return new Date(isoDate).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}
