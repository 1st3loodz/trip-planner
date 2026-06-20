"use client";

import { useState, useEffect } from "react";
import { Participant, Currency, ExpenseCategory, Expense, CURRENCY_META, EXPENSE_CATEGORY_META } from "@/types/trip";
import { generateId } from "@/lib/utils";
import Avatar from "@/components/Avatar";
import { useCurrency } from "@/contexts/CurrencyContext";

interface AddExpenseModalProps {
  participants: Participant[];
  initialExpense?: Expense;
  onSave: (expense: Expense) => void;
  onClose: () => void;
  customCategories: { id: string; label: string; emoji: string }[];
  onAddCustomCategory: (cat: { id: string; label: string; emoji: string }) => void;
}

const CURRENCIES = Object.keys(CURRENCY_META) as Currency[];
const CATEGORIES = Object.keys(EXPENSE_CATEGORY_META) as ExpenseCategory[];

export default function AddExpenseModal({ participants, initialExpense, onSave, onClose, customCategories, onAddCustomCategory }: AddExpenseModalProps) {
  const isEdit = !!initialExpense;
  const [description, setDescription] = useState(initialExpense?.description ?? "");
  const [amount,      setAmount]      = useState(initialExpense?.amount.toString() ?? "");
  const [currency,    setCurrency]    = useState<Currency>(initialExpense?.currency ?? "CNY");
  const [category,    setCategory]    = useState<ExpenseCategory>(initialExpense?.category ?? "food");
  const [paidById,    setPaidById]    = useState(initialExpense?.paidById ?? participants[0]?.id ?? "");
  const [date,        setDate]        = useState(initialExpense?.date ?? new Date().toISOString().slice(0, 10));
  const [splitIds,    setSplitIds]    = useState<Set<string>>(
    () => new Set(initialExpense ? initialExpense.splits.map((s) => s.participantId) : participants.map((p) => p.id))
  );
  const [isExcluded,  setIsExcluded]  = useState(initialExpense?.isExcluded ?? false);
  const [errors, setErrors] = useState<Record<string,string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { baseCurrency, rates } = useCurrency();

  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCatEmoji, setNewCatEmoji] = useState("✨");
  const [newCatLabel, setNewCatLabel] = useState("");

  function handleSaveCustomCategory() {
    if (!newCatLabel.trim()) return;
    const newCat = {
      id: `cat-${generateId()}`,
      label: newCatLabel.trim(),
      emoji: newCatEmoji.trim() || "✨",
    };
    onAddCustomCategory(newCat);
    setCategory(newCat.id);
    setIsAddingCategory(false);
    setNewCatLabel("");
    setNewCatEmoji("✨");
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  function toggleSplit(id: string) {
    setSplitIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) {
        n.delete(id);
      } else {
        n.add(id);
      }
      return n;
    });
  }

  async function handleSubmit() {
    const errs: Record<string,string> = {};
    if (!description.trim()) errs.description = "Description is required.";
    if (!date) errs.date = "Date is required.";
    const num = parseFloat(amount);
    if (!amount || isNaN(num) || num <= 0) errs.amount = "Enter a valid amount.";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setIsSubmitting(true);
    let hRate = initialExpense?.historicalRate;

    if (!hRate || initialExpense?.currency !== currency) {
      if (currency === baseCurrency) {
        hRate = 1;
      } else {
        try {
          const res = await fetch(`https://open.er-api.com/v6/latest/${currency}`);
          if (res.ok) {
            const data = await res.json();
            if (data?.rates?.[baseCurrency]) {
              hRate = data.rates[baseCurrency];
            }
          }
        } catch (error) {
          console.error("Live FX fetch failed, falling back to context rates:", error);
        }
        if (!hRate) {
          hRate = rates[currency] ?? 1;
        }
      }
    }

    const hBaseAmount = parseFloat((num * (hRate ?? 1)).toFixed(2));
    const splitArray = splitIds.size > 0 ? Array.from(splitIds) : [paidById];
    const perPerson  = num / splitArray.length;

    onSave({
      id: initialExpense?.id ?? `e-${generateId()}`,
      description: description.trim(), amount: num, currency, category, paidById, date, isExcluded,
      splits: splitArray.map((id) => ({ participantId: id, amount: parseFloat(perPerson.toFixed(2)) })),
      createdAt: initialExpense?.createdAt ?? new Date().toISOString(),
      historicalRate: hRate,
      historicalBaseAmount: hBaseAmount,
    });
    
    setIsSubmitting(false);
    onClose();
  }

  const num = parseFloat(amount);
  const perPerson = !isNaN(num) && num > 0 ? (splitIds.size > 0 ? (num / splitIds.size).toFixed(2) : num.toFixed(2)) : null;

  const inputCls = (err?: string) =>
    `w-full border-2 bg-[#fdfbf7] px-3.5 py-2.5 font-mono text-sm text-stone-900 placeholder-stone-400 outline-none focus:border-stone-800 dark:bg-[#1e1815] dark:text-[#fdfbf7] dark:placeholder-stone-500 ${err ? "border-red-400 dark:border-red-500" : "border-stone-400 dark:border-stone-600"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm dark:bg-black/70" />
      <div className="relative w-full max-w-lg overflow-hidden border-4 border-stone-800 bg-[#f4ecd8] shadow-[8px_8px_0_#292524] dark:border-[#54463d] dark:bg-[#28211d] dark:shadow-[8px_8px_0_#1e1815]">

        {/* Header */}
        <div className="flex items-center justify-between border-b-4 border-stone-800 bg-[#e8dcc4] px-6 py-4 dark:border-[#54463d] dark:bg-[#362d28]">
          <div>
            <h2 className="font-pixel text-sm uppercase tracking-wider text-stone-900 dark:text-[#fdfbf7]">{isEdit ? "Edit Expense" : "Add Expense"}</h2>
            <p className="mt-1 font-mono text-[10px] text-stone-600 dark:text-stone-400">{isEdit ? "Update the details of this expense" : "Log a new shared cost for this trip"}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center border-2 border-stone-800 bg-[#fdfbf7] font-pixel text-stone-800 hover:bg-stone-200 dark:border-[#54463d] dark:bg-[#1e1815] dark:text-[#fdfbf7] dark:hover:bg-[#362d28]">✕</button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-6 py-5 space-y-5">
          {/* Description */}
          <div>
            <label className="mb-1.5 block font-pixel text-[8px] uppercase tracking-widest text-stone-600 dark:text-stone-400">Description *</label>
            <input type="text" placeholder="e.g. Dinner at Zhongjie" value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls(errors.description)} />
            {errors.description && <p className="mt-1 font-mono text-[10px] text-red-600 dark:text-red-400">{errors.description}</p>}
          </div>

          {/* Date */}
          <div>
            <label className="mb-1.5 block font-pixel text-[8px] uppercase tracking-widest text-stone-600 dark:text-stone-400">Date *</label>
            <div className="relative">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} onClick={(e) => e.currentTarget.showPicker?.()} className={`${inputCls(errors.date)} [color-scheme:light] dark:[color-scheme:dark] cursor-pointer`} />
            </div>
            {errors.date && <p className="mt-1 font-mono text-[10px] text-red-600 dark:text-red-400">{errors.date}</p>}
          </div>

          {/* Amount + Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block font-pixel text-[8px] uppercase tracking-widest text-stone-600 dark:text-stone-400">Amount *</label>
              <input type="number" min="0" step="any" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls(errors.amount)} />
              {errors.amount && <p className="mt-1 font-mono text-[10px] text-red-600 dark:text-red-400">{errors.amount}</p>}
            </div>
            <div>
              <label className="mb-1.5 block font-pixel text-[8px] uppercase tracking-widest text-stone-600 dark:text-stone-400">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}
                className="w-full border-2 border-stone-400 bg-[#fdfbf7] px-3.5 py-2.5 font-mono text-sm text-stone-900 outline-none focus:border-stone-800 dark:border-stone-600 dark:bg-[#1e1815] dark:text-[#fdfbf7]">
                {CURRENCIES.map((c) => <option key={c} value={c}>{CURRENCY_META[c].flag} {c} — {CURRENCY_META[c].label}</option>)}
              </select>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="mb-1.5 block font-pixel text-[8px] uppercase tracking-widest text-stone-600 dark:text-stone-400">Category</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CATEGORIES.map((cat) => {
                const m = EXPENSE_CATEGORY_META[cat]; const active = category === cat;
                return (
                  <button key={cat} type="button" onClick={() => setCategory(cat)}
                    className={`flex flex-col items-start border-2 px-3 py-2.5 text-left transition-all ${active ? "border-stone-800 bg-[#f5eed7] text-stone-900 shadow-[2px_2px_0_#292524] dark:border-[#54463d] dark:bg-[#362d28] dark:text-[#fdfbf7] dark:shadow-[2px_2px_0_#1e1815]" : "border-stone-400 bg-[#fdfbf7] text-stone-500 hover:border-stone-600 dark:border-stone-600 dark:bg-[#28211d] dark:text-stone-400 dark:hover:border-[#54463d]"}`}>
                    <span className="mb-0.5 text-base">{m.emoji}</span>
                    <span className="font-mono text-xs font-bold leading-tight">{m.label}</span>
                    <span className="font-mono text-[10px] leading-tight text-stone-400 dark:text-stone-500">{m.sublabel}</span>
                  </button>
                );
              })}
              {customCategories.map((cat) => {
                const active = category === cat.id;
                return (
                  <button key={cat.id} type="button" onClick={() => setCategory(cat.id)}
                    className={`flex flex-col items-start border-2 px-3 py-2.5 text-left transition-all ${active ? "border-stone-800 bg-[#f5eed7] text-stone-900 shadow-[2px_2px_0_#292524] dark:border-[#54463d] dark:bg-[#362d28] dark:text-[#fdfbf7] dark:shadow-[2px_2px_0_#1e1815]" : "border-stone-400 bg-[#fdfbf7] text-stone-500 hover:border-stone-600 dark:border-stone-600 dark:bg-[#28211d] dark:text-stone-400 dark:hover:border-[#54463d]"}`}>
                    <span className="mb-0.5 text-base">{cat.emoji}</span>
                    <span className="font-mono text-xs font-bold leading-tight">{cat.label}</span>
                  </button>
                );
              })}
              {isAddingCategory ? (
                <div className="col-span-2 sm:col-span-3 flex items-center gap-2 border-2 border-stone-800 bg-[#e8dcc4] p-2 dark:border-[#54463d] dark:bg-[#362d28] shadow-[2px_2px_0_#292524] dark:shadow-[2px_2px_0_#1e1815]">
                  <input type="text" placeholder="✨" value={newCatEmoji} onChange={(e) => setNewCatEmoji(e.target.value)} title="Pick an emoji"
                    className="w-8 h-8 text-center text-lg bg-[#fdfbf7] dark:bg-[#28211d] border-2 border-stone-400 focus:border-stone-800 dark:border-stone-500 outline-none cursor-pointer hover:bg-[#f5eed7] dark:hover:bg-[#362d28] transition-colors shadow-[1px_1px_0_#a8a29e] dark:shadow-[1px_1px_0_#54463d]" />
                  <input type="text" placeholder="Custom Name" value={newCatLabel} onChange={(e) => setNewCatLabel(e.target.value)} 
                    className="flex-1 h-8 bg-[#fdfbf7] dark:bg-[#1e1815] border-2 border-stone-400 focus:border-stone-800 dark:border-stone-600 px-2 outline-none font-mono text-[10px] text-stone-900 dark:text-[#fdfbf7] placeholder-stone-400" />
                  <button type="button" onClick={handleSaveCustomCategory} disabled={!newCatLabel.trim()} className="h-8 bg-[#4a7c59] text-[#fdfbf7] px-3 font-pixel text-[10px] disabled:opacity-50 border-2 border-stone-800 dark:border-[#2d5a3d]">Save</button>
                  <button type="button" onClick={() => setIsAddingCategory(false)} className="h-8 bg-[#fdfbf7] dark:bg-[#1e1815] text-stone-800 dark:text-[#fdfbf7] px-2 font-pixel text-[10px] border-2 border-stone-800 dark:border-stone-600">✕</button>
                </div>
              ) : (
                <button type="button" onClick={() => setIsAddingCategory(true)}
                  className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-stone-400 bg-[#fdfbf7] px-2 py-2.5 text-center transition-all hover:border-stone-600 dark:border-stone-600 dark:bg-[#28211d] text-stone-500 hover:text-stone-700 dark:hover:text-stone-300">
                  <span className="text-lg">➕</span>
                  <span className="font-mono text-[10px] font-bold leading-tight">Add Custom</span>
                </button>
              )}
            </div>
          </div>

          {/* Paid By */}
          <div>
            <label className="mb-1.5 block font-pixel text-[8px] uppercase tracking-widest text-stone-600 dark:text-stone-400">Paid By</label>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {participants.map((p) => {
                const active = paidById === p.id;
                return (
                  <button key={p.id} type="button" onClick={() => setPaidById(p.id)}
                    className={`flex items-center gap-2 border-2 px-3 py-2 transition-all ${active ? "border-stone-800 bg-[#4a7c59] shadow-[2px_2px_0_#292524] dark:border-[#2d5a3d] dark:bg-[#2d5a3d] dark:shadow-[2px_2px_0_#1e1815]" : "border-stone-400 bg-[#fdfbf7] hover:border-stone-600 dark:border-stone-600 dark:bg-[#28211d] dark:hover:border-[#54463d]"}`}>
                    <Avatar name={p.name} colorClass={p.color} size="xs" tooltip={false} />
                    <span className={`font-mono text-xs font-semibold ${active ? "text-[#fdfbf7]" : "text-stone-600 dark:text-[#fdfbf7]"}`}>{p.name}</span>
                    {active && <span className="ml-auto font-mono text-[10px] text-[#fdfbf7]">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Split Between */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="font-pixel text-[8px] uppercase tracking-widest text-stone-600 dark:text-stone-400">
                Split Between *{" "}{splitIds.size > 0 && <span className="ml-1 text-[#4a7c59] dark:text-[#2d5a3d]">({splitIds.size} selected)</span>}
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setSplitIds(new Set(participants.map((p) => p.id)))} className="font-mono text-[10px] font-semibold text-stone-800 dark:text-[#fdfbf7] hover:underline">All</button>
                <span className="font-mono text-[10px] text-stone-400 dark:text-stone-600">·</span>
                <button type="button" onClick={() => setSplitIds(new Set())} className="font-mono text-[10px] font-semibold text-stone-500 dark:text-stone-500 hover:underline">Clear</button>
              </div>
            </div>
            {errors.split && <p className="mb-2 font-mono text-[10px] text-red-600 dark:text-red-400">{errors.split}</p>}
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {participants.map((p) => {
                const checked = splitIds.has(p.id);
                return (
                  <button key={p.id} type="button" onClick={() => toggleSplit(p.id)}
                    className={`flex items-center gap-2 border-2 px-3 py-2 transition-all ${checked ? "border-stone-800 bg-[#f5eed7] shadow-[2px_2px_0_#292524] dark:border-[#54463d] dark:bg-[#362d28] dark:shadow-[2px_2px_0_#1e1815]" : "border-stone-400 bg-[#fdfbf7] opacity-60 hover:opacity-100 dark:border-stone-600 dark:bg-[#28211d]"}`}>
                    <Avatar name={p.name} colorClass={p.color} size="xs" tooltip={false} />
                    <span className={`font-mono text-xs font-semibold ${checked ? "text-stone-900 dark:text-[#fdfbf7]" : "text-stone-500 dark:text-stone-500"}`}>{p.name}</span>
                    <span className={`ml-auto flex h-4 w-4 items-center justify-center border-2 text-[10px] transition-all ${checked ? "border-stone-800 bg-[#4a7c59] text-[#fdfbf7] dark:border-[#2d5a3d] dark:bg-[#2d5a3d]" : "border-stone-300 text-transparent dark:border-stone-600"}`}>✓</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Exclude Checkbox */}
          <div className="flex items-start gap-3 border-2 border-stone-400 bg-[#fdfbf7] px-4 py-3 dark:border-stone-600 dark:bg-[#1e1815]">
            <input
              type="checkbox"
              id="isExcluded"
              checked={isExcluded}
              onChange={(e) => setIsExcluded(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#4a7c59] dark:accent-[#2d5a3d]"
            />
            <label htmlFor="isExcluded" className="cursor-pointer font-mono text-xs text-stone-700 dark:text-stone-300">
              <strong className="font-semibold text-stone-900 dark:text-[#fdfbf7]">Exclude from Total & Settlement</strong><br/>
              <span className="text-[10px] text-stone-500 dark:text-stone-500">Skip calculation (e.g. paid in advance, personal expense).</span>
            </label>
          </div>

          {/* Per-person preview */}
          {perPerson && (
            <div className="flex items-center justify-between border-2 border-stone-800 bg-[#e8dcc4] px-4 py-3 dark:border-[#54463d] dark:bg-[#362d28]">
              <span className="font-mono text-xs font-semibold text-stone-800 dark:text-[#f5ebd5]">{splitIds.size === 0 ? "100% Personal (Auto-assigned):" : "Each person pays:"}</span>
              <span className="font-mono text-sm font-black tabular-nums text-stone-900 dark:text-[#fdfbf7]">{CURRENCY_META[currency].symbol}{perPerson} {currency}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 pt-2 px-6 pb-6">
          <button type="button" onClick={onClose} disabled={isSubmitting} className="game-btn flex-1 border-2 border-stone-800 bg-[#fdfbf7] py-3.5 font-pixel text-[10px] uppercase tracking-wider text-stone-800 hover:bg-[#e8dcc4] dark:border-[#54463d] dark:bg-[#1e1815] dark:text-[#fdfbf7] dark:hover:bg-[#362d28] disabled:opacity-50">Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={isSubmitting} className="game-btn flex-1 bg-[#4a7c59] py-3.5 font-pixel text-[10px] uppercase tracking-wider text-[#fdfbf7] hover:bg-[#3d6649] disabled:opacity-50 disabled:bg-[#2d5a3d]">
            {isSubmitting ? "Saving..." : "Save Expense"}
          </button>
        </div>
      </div>
    </div>
  );
}
