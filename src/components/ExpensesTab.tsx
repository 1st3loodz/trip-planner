"use client";

import { useState, useMemo } from "react";
import {
  Expense, Participant, ExpenseCategory, Currency,
  EXPENSE_CATEGORY_META, CURRENCY_META,
} from "@/types/trip";
import { formatCurrency } from "@/lib/utils";
import { convertToBase, formatBase } from "@/lib/currency";
import { useCurrency } from "@/contexts/CurrencyContext";
import { computeSettlementsInBase } from "@/lib/settlement";
import ExpenseCard          from "@/components/ExpenseCard";
import SettlementCalculator from "@/components/SettlementCalculator";
import AddExpenseModal       from "@/components/AddExpenseModal";
import IndividualSummary     from "@/components/IndividualSummary";
import CurrencySettings      from "@/components/CurrencySettings";

interface ExpensesTabProps {
  expenses: Expense[];
  participants: Participant[];
  onAddExpense?: (e: Expense) => void;
  onEditExpense: (e: Expense) => void;
  onEditExpenses?: (e: Expense[]) => void;
  onDeleteExpense?: (id: string) => void;
  customCategories: { id: string; label: string; emoji: string }[];
  onAddCustomCategory: (cat: { id: string; label: string; emoji: string }) => void;
  isGroupTrip: boolean;
}

type SortKey   = "date-asc" | "date-desc" | "amount-high" | "amount-low";
type FilterCat = ExpenseCategory | "all";
type FilterCur = Currency | "all";
type Section   = "ledger" | "individual" | "settlement";
type ModalState = null | { mode: "add" } | { mode: "edit"; expense: Expense };

export default function ExpensesTab({
  expenses, participants, onAddExpense,  onEditExpense,
  onEditExpenses,
  onDeleteExpense,
  customCategories, onAddCustomCategory, isGroupTrip
}: ExpensesTabProps) {
  const { baseCurrency, rates } = useCurrency();

  const [modalState,    setModalState]    = useState<ModalState>(null);
  const [sortKey,       setSortKey]       = useState<SortKey>("date-asc");
  const [filterCat,     setFilterCat]     = useState<FilterCat>("all");
  const [filterCur,     setFilterCur]     = useState<FilterCur>("all");
  const [activeSection, setActiveSection] = useState<Section>("ledger");
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);

  const toggleDate = (date: string) => {
    setExpandedDates(prev => ({ ...prev, [date]: !prev[date] }));
  };

  // Fallback if settlement tab vanishes while active
  if (activeSection === "settlement" && !isGroupTrip) {
    setActiveSection("ledger");
  }

  // Settlements computed in base currency
  const settlements = useMemo(
    () => computeSettlementsInBase(expenses, rates, baseCurrency),
    [expenses, rates, baseCurrency]
  );

  // Per-currency raw totals and their frozen base equivalents
  const rawTotals = expenses.reduce<Record<string, { total: number; baseTotal: number }>>((acc, e) => {
    if (!e.isExcluded) {
      if (!acc[e.currency]) acc[e.currency] = { total: 0, baseTotal: 0 };
      acc[e.currency].total += e.amount;
      acc[e.currency].baseTotal += (e.historicalBaseAmount ?? convertToBase(e.amount, e.currency, rates));
    }
    return acc;
  }, {});

  // Grand total in base currency
  const grandTotalBase = useMemo(
    () => expenses.reduce((sum, e) => sum + (e.isExcluded ? 0 : (e.historicalBaseAmount ?? convertToBase(e.amount, e.currency, rates))), 0),
    [expenses, rates]
  );

  const filtered = expenses
    .filter((e) => filterCat === "all" || e.category === filterCat)
    .filter((e) => filterCur === "all" || e.currency === filterCur)
    .sort((a, b) => {
      switch (sortKey) {
        case "date-asc":    return a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);
        case "date-desc":   return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
        case "amount-high": return b.amount - a.amount;
        case "amount-low":  return a.amount - b.amount;
        default:            return 0;
      }
    });

  const groupedExpenses = useMemo(() => {
    const groups: Record<string, Expense[]> = {};
    filtered.forEach(exp => {
      const d = exp.date;
      if (!groups[d]) groups[d] = [];
      groups[d].push(exp);
    });
    const sortedDates = Object.keys(groups).sort((a, b) => {
      if (sortKey === "date-desc") return b.localeCompare(a);
      return a.localeCompare(b);
    });
    return sortedDates.map(date => ({
      date,
      expenses: groups[date]
    }));
  }, [filtered, sortKey]);

  function handleSave(expense: Expense) {
    if (modalState?.mode === "edit") onEditExpense(expense);
    else if (onAddExpense) onAddExpense(expense);
  }

  const categories = Object.keys(EXPENSE_CATEGORY_META) as ExpenseCategory[];
  const currencies  = Object.keys(CURRENCY_META) as Currency[];
  const baseMeta    = CURRENCY_META[baseCurrency];

  const sections: { key: Section; label: string }[] = [
    { key: "ledger",     label: "📋 Ledger"    },
    { key: "individual", label: "👤 Individual" },
  ];
  if (isGroupTrip) {
    sections.push({ key: "settlement", label: "🧮 Settlement" });
  }

  return (
    <div>
      {/* ── Currency Settings (collapsible) ────────────────────────────────── */}
      <CurrencySettings />

      {/* ── Grand total in base currency ───────────────────────────────────── */}
      <div className="mb-4 flex items-center justify-between border-2 border-stone-800 bg-[#f5eed7] px-5 py-3 dark:border-[#54463d] dark:bg-[#362d28] shadow-[4px_4px_0_#292524] dark:shadow-[4px_4px_0_#1e1815]">
        <div className="flex items-center gap-2">
          <span className="text-base">{baseMeta.flag}</span>
          <span className="font-pixel text-[8px] uppercase tracking-wider text-stone-700 dark:text-[#f5ebd5]">
            Total trip cost in {baseCurrency}
          </span>
        </div>
        <span className="font-mono text-lg font-black tabular-nums text-stone-800 dark:text-[#fdfbf7]">
          {formatBase(grandTotalBase, baseCurrency)}
        </span>
      </div>

      {/* ── Per-currency raw summary strip ─────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Object.entries(rawTotals).map(([cur, { total, baseTotal }]) => {
          const m        = CURRENCY_META[cur as Currency];
          return (
            <div key={cur} className="border-2 border-stone-400 bg-[#fdfbf7] p-4 dark:border-stone-600 dark:bg-[#28211d]">
              <div className="mb-1 text-lg">{m.flag}</div>
              <div className="font-mono text-base font-black tabular-nums text-stone-800 dark:text-[#fdfbf7]">
                {formatCurrency(total, cur)}
              </div>
              <div className="font-pixel text-[8px] uppercase tracking-wider text-stone-500 dark:text-stone-400 mt-1">{cur} original</div>
              <div className="mt-0.5 font-mono text-[10px] font-semibold text-stone-600 dark:text-stone-400 tabular-nums">
                ≈ {formatBase(baseTotal, baseCurrency)}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Section switcher ───────────────────────────────────────────────── */}
      <div className="mb-5 flex flex-wrap gap-2">
        {sections.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveSection(key)}
            className={`font-pixel text-[9px] uppercase tracking-wider px-4 py-2 border-2 transition-colors ${
              activeSection === key
                ? "bg-stone-800 text-[#fdfbf7] border-stone-800 shadow-[2px_2px_0_#292524] dark:bg-[#1e1815] dark:border-[#54463d] dark:shadow-[2px_2px_0_#54463d]"
                : "bg-[#f5eed7] text-stone-800 border-stone-400 dark:bg-[#28211d] dark:text-[#f5ebd5] dark:border-[#54463d]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── LEDGER ─────────────────────────────────────────────────────────── */}
      {activeSection === "ledger" && (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setModalState({ mode: "add" })}
              className="game-btn flex items-center gap-1.5 px-4 py-2 font-pixel text-[8px] uppercase tracking-wider bg-[#4a7c59] text-[#fdfbf7] dark:bg-[#2d5a3d]"
            >
              <span className="text-base leading-none">+</span> Add Expense
            </button>
            <div className="ml-auto flex flex-wrap gap-2">
              <select value={filterCat} onChange={(e) => setFilterCat(e.target.value as FilterCat)}
                className="font-mono text-xs border-2 border-stone-400 bg-[#fdfbf7] px-3 py-1.5 text-stone-800 outline-none dark:border-stone-600 dark:bg-[#28211d] dark:text-[#fdfbf7]">
                <option value="all">All Categories</option>
                {categories.map((c) => { const m = EXPENSE_CATEGORY_META[c]; return <option key={c} value={c}>{m.emoji} {m.label}</option>; })}
                {customCategories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
              </select>
              <select value={filterCur} onChange={(e) => setFilterCur(e.target.value as FilterCur)}
                className="font-mono text-xs border-2 border-stone-400 bg-[#fdfbf7] px-3 py-1.5 text-stone-800 outline-none dark:border-stone-600 dark:bg-[#28211d] dark:text-[#fdfbf7]">
                <option value="all">All Currencies</option>
                {currencies.map((c) => { const m = CURRENCY_META[c]; return <option key={c} value={c}>{m.flag} {c}</option>; })}
              </select>
              <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="font-mono text-xs border-2 border-stone-400 bg-[#fdfbf7] px-3 py-1.5 text-stone-800 outline-none dark:border-stone-600 dark:bg-[#28211d] dark:text-[#fdfbf7]">
                <option value="date-asc">Date ↑ (oldest)</option>
                <option value="date-desc">Date ↓ (newest)</option>
                <option value="amount-high">Amount ↓ (highest)</option>
                <option value="amount-low">Amount ↑ (lowest)</option>
              </select>
            </div>
          </div>

          <div className="mb-3 font-mono text-[10px] text-stone-500 dark:text-stone-400">
            {filtered.length} expense{filtered.length !== 1 ? "s" : ""} shown
          </div>

          {groupedExpenses.length > 0 ? (
            <div className="space-y-4">
              {groupedExpenses.map((group) => {
                const dayTotal = group.expenses.reduce((sum, e) => sum + (e.isExcluded ? 0 : (e.historicalBaseAmount ?? convertToBase(e.amount, e.currency, rates))), 0);
                const isExpanded = expandedDates[group.date] ?? true;

                return (
                  <div key={group.date} className="border-4 border-stone-800 bg-[#fdfbf7] dark:border-[#54463d] dark:bg-[#28211d] shadow-[4px_4px_0_#292524] dark:shadow-[4px_4px_0_#1e1815] transition-all">
                    <button 
                      onClick={() => toggleDate(group.date)}
                      className={`w-full flex items-center justify-between bg-[#e8dcc4] dark:bg-[#362d28] px-4 py-3 hover:bg-[#d8ccb4] dark:hover:bg-[#463d38] transition-colors ${isExpanded ? "border-b-4 border-stone-800 dark:border-[#54463d]" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-pixel text-xs uppercase tracking-wider text-stone-800 dark:text-[#fdfbf7]">
                          {new Date(group.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        </span>
                        <span className="font-mono text-[10px] text-stone-500 dark:text-stone-400">
                          ({group.expenses.length} item{group.expenses.length !== 1 ? 's' : ''})
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-black tabular-nums text-stone-800 dark:text-[#fdfbf7]">
                          {formatBase(dayTotal, baseCurrency)}
                        </span>
                        <span className="font-mono text-xs text-stone-500 dark:text-stone-400 transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                      </div>
                    </button>
                    
                    {isExpanded && (
                      <div className="p-3 space-y-3 bg-[#fdfbf7] dark:bg-[#28211d]">
                        {group.expenses.map((exp) => (
                          <ExpenseCard key={exp.id} expense={exp} participants={participants} customCategories={customCategories}
                            onEdit={(e) => setModalState({ mode: "edit", expense: e })}
                            onDelete={(id) => setExpenseToDelete(id)} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-16 text-center border-2 border-dashed border-stone-400 bg-stone-200/50 dark:border-stone-600 dark:bg-stone-800/30">
              <div className="mb-2 text-4xl">💸</div>
              <p className="font-mono text-xs text-stone-600 dark:text-[#f5ebd5]">No expenses yet.</p>
              <button onClick={() => setModalState({ mode: "add" })}
                className="mt-3 font-mono text-[10px] uppercase underline text-stone-800 dark:text-stone-300">
                + Add your first expense
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── INDIVIDUAL SUMMARY ─────────────────────────────────────────────── */}
      {activeSection === "individual" && (
        <div>
          <div className="mb-4">
            <h3 className="font-pixel text-[10px] uppercase text-stone-800 dark:text-[#fdfbf7]">Individual Ledger</h3>
            <p className="font-mono text-xs text-stone-600 dark:text-stone-400 mt-1">
              Per-member ledger grouped by date. Amounts shown in original currency + converted to {baseMeta.flag} {baseCurrency}.
            </p>
          </div>
          <IndividualSummary expenses={expenses} participants={participants} customCategories={customCategories} />
        </div>
      )}

      {/* ── SETTLEMENT ─────────────────────────────────────────────────────── */}
      {activeSection === "settlement" && (
        <div>
          <h3 className="mb-1 font-pixel text-[10px] uppercase text-stone-800 dark:text-[#fdfbf7]">Who Owes Whom</h3>
          <p className="mb-1 font-mono text-xs text-stone-600 dark:text-stone-400">
            All debts simplified and expressed in {baseMeta.flag} {baseCurrency}. Updates instantly on every change.
          </p>
          <p className="mb-4 font-mono text-[9px] text-stone-500 dark:text-stone-400">
            Using your exchange rates: 1 CNY = {rates.CNY} {baseCurrency} · 1 JPY = {rates.JPY} {baseCurrency} · 1 USD = {rates.USD} {baseCurrency}
          </p>
          <SettlementCalculator
            settlements={settlements}
            participants={participants}
            onEditExpense={onEditExpense}
            onEditExpenses={onEditExpenses}
          />
        </div>
      )}

      {/* Modal */}
      {modalState !== null && (
        <AddExpenseModal
          participants={participants}
          initialExpense={modalState.mode === "edit" ? modalState.expense : undefined}
          onSave={handleSave}
          onClose={() => setModalState(null)}
          customCategories={customCategories}
          onAddCustomCategory={onAddCustomCategory}
        />
      )}

      {/* Delete Confirmation Modal */}
      {expenseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm dark:bg-black/70" onClick={() => setExpenseToDelete(null)} />
          <div className="relative w-full max-w-sm border-4 border-stone-800 bg-[#f4ecd8] p-6 text-center shadow-[8px_8px_0_#292524] dark:border-[#54463d] dark:bg-[#28211d] dark:shadow-[8px_8px_0_#1e1815]">
            <h3 className="mb-2 font-pixel text-lg text-stone-900 dark:text-[#fdfbf7]">Delete Expense?</h3>
            <p className="mb-6 font-mono text-sm text-stone-600 dark:text-stone-400">
              This will permanently remove this record from the ledger. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setExpenseToDelete(null)} 
                className="game-btn flex-1 border-2 border-stone-800 bg-[#fdfbf7] py-2.5 font-pixel text-[10px] uppercase tracking-wider text-stone-800 dark:border-[#54463d] dark:bg-[#28211d] dark:text-[#fdfbf7]"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  onDeleteExpense(expenseToDelete);
                  setExpenseToDelete(null);
                }} 
                className="game-btn flex-1 bg-[#4a7c59] py-2.5 font-pixel text-[10px] uppercase tracking-wider text-[#fdfbf7] dark:bg-[#2d5a3d]"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
