"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
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



  useEffect(() => {
    try {
      const storedBase = localStorage.getItem("baseCurrency") as Currency;
      const storedRates = localStorage.getItem("rates");
      if (storedBase) setBase(storedBase);
      if (storedRates) setRates(JSON.parse(storedRates));
    } catch (e) {}
  }, []);

  const setBaseCurrency = useCallback((c: Currency) => {
    setBase(c);
    const newRates = DEFAULT_RATES[c];
    setRates(newRates);
    try {
      localStorage.setItem("baseCurrency", c);
      localStorage.setItem("rates", JSON.stringify(newRates));
    } catch (e) {}
  }, []);

  const setRate = useCallback((currency: Currency, value: number) => {
    setRates((prev) => {
      const newRates = { ...prev, [currency]: value };
      try {
        localStorage.setItem("rates", JSON.stringify(newRates));
      } catch (e) {}
      return newRates;
    });
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
