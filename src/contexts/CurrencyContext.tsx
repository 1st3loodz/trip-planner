"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { Currency } from "@/types/trip";
import { Rates, DEFAULT_RATES } from "@/lib/currency";

interface CurrencyContextValue {
  baseCurrency: Currency;
  rates: Rates;
  setBaseCurrency: (c: Currency) => void;
  setRate: (currency: Currency, value: number) => void;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  baseCurrency: "THB",
  rates: DEFAULT_RATES["THB"],
  setBaseCurrency: () => {},
  setRate: () => {},
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [baseCurrency, setBase] = useState<Currency>("THB");
  const [rates, setRates]       = useState<Rates>(DEFAULT_RATES["THB"]);

  const setBaseCurrency = useCallback((c: Currency) => {
    setBase(c);
    // Reset to sensible defaults whenever base changes
    setRates(DEFAULT_RATES[c]);
  }, []);

  const setRate = useCallback((currency: Currency, value: number) => {
    setRates((prev) => ({ ...prev, [currency]: value }));
  }, []);

  return (
    <CurrencyContext.Provider value={{ baseCurrency, rates, setBaseCurrency, setRate }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  return useContext(CurrencyContext);
}
