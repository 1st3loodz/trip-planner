"use client";

import { useState } from "react";
import { Currency, CURRENCY_META } from "@/types/trip";
import { useCurrency } from "@/contexts/CurrencyContext";

const ALL_CURRENCIES = Object.keys(CURRENCY_META) as Currency[];

export default function CurrencySettings() {
  const { baseCurrency, rates, setBaseCurrency, setRate } = useCurrency();
  const [open, setOpen] = useState(false);

  const otherCurrencies = ALL_CURRENCIES.filter((c) => c !== baseCurrency);
  const baseMeta = CURRENCY_META[baseCurrency];

  return (
    <div className="mb-5 border-2 border-stone-400 bg-[#fdfbf7] dark:border-[#54463d] dark:bg-[#28211d]">
      {/* Header toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-stone-100 dark:hover:bg-[#362d28]"
      >
        <span className="flex h-7 w-7 items-center justify-center border-2 border-stone-300 bg-[#f5eed7] font-pixel text-xs dark:border-[#54463d] dark:bg-[#1e1815]">
          💱
        </span>
        <div className="flex-1 min-w-0">
          <span className="font-pixel text-[9px] uppercase tracking-wider text-stone-800 dark:text-[#fdfbf7]">
            Base Currency Converter
          </span>
          <span className="ml-2 font-mono text-[10px] text-stone-500 dark:text-stone-400">
            {baseMeta.flag} {baseCurrency} — {baseMeta.label}
          </span>
        </div>
        <span className={`font-mono text-xs text-stone-500 transition-transform duration-200 dark:text-stone-400 ${open ? "rotate-90" : ""}`}>▶</span>
      </button>

      {open && (
        <div className="border-t-2 border-stone-200 px-4 py-4 dark:border-[#54463d]">
          {/* Base currency selector */}
          <div className="mb-4">
            <label className="mb-1.5 block font-pixel text-[8px] uppercase tracking-widest text-stone-500 dark:text-stone-400">
              Base Currency (all totals shown in this currency)
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_CURRENCIES.map((c) => {
                const m = CURRENCY_META[c];
                const active = c === baseCurrency;
                return (
                  <button
                    key={c}
                    onClick={() => setBaseCurrency(c)}
                    className={`flex items-center gap-1.5 border-2 px-4 py-2 font-mono text-xs font-bold transition-all ${
                      active
                        ? "border-stone-800 bg-[#4a7c59] text-[#fdfbf7] shadow-[2px_2px_0_#292524] dark:border-[#2d5a3d] dark:shadow-[2px_2px_0_#1e1815]"
                        : "border-stone-300 bg-[#fdfbf7] text-stone-600 hover:border-stone-500 dark:border-stone-600 dark:bg-[#1e1815] dark:text-[#fdfbf7] dark:hover:border-stone-400"
                    }`}
                  >
                    <span>{m.flag}</span>
                    <span>{c}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Exchange rate inputs */}
          <div>
            <label className="mb-2 block font-pixel text-[8px] uppercase tracking-widest text-stone-500 dark:text-stone-400">
              Exchange Rates (1 foreign unit → {baseCurrency})
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {otherCurrencies.map((c) => {
                const m = CURRENCY_META[c];
                return (
                  <div
                    key={c}
                    className="flex items-center gap-2 border-2 border-stone-300 bg-[#f5eed7] px-3 py-2 dark:border-stone-600 dark:bg-[#28211d]"
                  >
                    {/* "1 FLAG CUR =" label */}
                    <span className="shrink-0 text-sm">{m.flag}</span>
                    <span className="shrink-0 font-mono text-[10px] font-bold text-stone-600 dark:text-stone-400">1 {c} =</span>

                    {/* Rate input */}
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={rates[c]}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v > 0) setRate(c, v);
                      }}
                      className="w-20 border-2 border-stone-400 bg-[#fdfbf7] px-2 py-1 font-mono text-xs font-bold text-stone-900 outline-none focus:border-stone-800 dark:border-[#54463d] dark:bg-[#1e1815] dark:text-[#fdfbf7] dark:focus:border-stone-400"
                    />

                    {/* Base currency label */}
                    <span className="shrink-0 font-mono text-[10px] text-stone-500 dark:text-stone-400">
                      {baseMeta.flag} {baseCurrency}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Info note */}
          <p className="mt-3 font-mono text-[9px] text-stone-500 dark:text-stone-500">
            ℹ️ Rates auto-reset to market approximates when you change the base currency. Adjust manually for exact values.
          </p>
        </div>
      )}
    </div>
  );
}
