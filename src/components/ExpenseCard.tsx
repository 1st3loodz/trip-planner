"use client";

import { Expense, Participant, EXPENSE_CATEGORY_META, CURRENCY_META } from "@/types/trip";
import { formatCurrency } from "@/lib/utils";
import Avatar from "@/components/Avatar";

interface ExpenseCardProps {
  expense: Expense;
  participants: Participant[];
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
  customCategories?: { id: string; label: string; emoji: string }[];
}

export default function ExpenseCard({ expense, participants, onEdit, onDelete, customCategories = [] }: ExpenseCardProps) {
  const customCat = customCategories.find((c) => c.id === expense.category);
  const cat = EXPENSE_CATEGORY_META[expense.category] || { label: customCat?.label || expense.category, emoji: customCat?.emoji || "✨", color: "bg-stone-500/15 text-stone-600 border-stone-500/30 dark:text-stone-300" };
  const cur = CURRENCY_META[expense.currency];
  const payer = participants.find((p) => p.id === expense.paidById);
  const splitMembers = expense.splits.map((s) => participants.find((p) => p.id === s.participantId)).filter(Boolean) as Participant[];
  const perPerson = expense.splits.length > 0 ? expense.amount / expense.splits.length : 0;
  const dateLabel = expense.date ? new Date(expense.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

  return (
    <div className={`group border-2 border-stone-400 p-4 transition-all duration-200 hover:border-stone-800 hover:shadow-[4px_4px_0_#292524] dark:border-[#54463d] dark:hover:border-stone-600 dark:hover:shadow-[4px_4px_0_#1e1815] ${expense.isExcluded ? 'bg-stone-200 opacity-70 grayscale-[20%] dark:bg-[#1e1815]' : 'bg-[#fdfbf7] dark:bg-[#28211d]'}`}>
      {/* Top row */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className={`shrink-0 border-2 px-2.5 py-0.5 font-pixel text-[8px] uppercase ${cat.color} text-stone-800`}>{cat.emoji} {cat.label}</span>
          <span className="shrink-0 border-2 border-stone-400 bg-[#f5eed7] px-2 py-0.5 font-pixel text-[8px] uppercase text-stone-700 dark:border-stone-600 dark:bg-[#1e1815] dark:text-stone-400">{cur.flag} {expense.currency}</span>
          {dateLabel && <span className="shrink-0 border-2 border-stone-400 bg-[#f5eed7] px-2 py-0.5 font-pixel text-[8px] uppercase text-stone-700 dark:border-stone-600 dark:bg-[#1e1815] dark:text-stone-400">📅 {dateLabel}</span>}
          {expense.isExcluded && <span className="shrink-0 border-2 border-stone-500 bg-stone-300 px-2 py-0.5 font-pixel text-[8px] uppercase text-stone-700 dark:border-stone-500 dark:bg-[#362d28] dark:text-stone-400">🚫 EXCLUDED</span>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`font-mono text-base font-black tabular-nums text-stone-800 dark:text-[#fdfbf7] ${expense.isExcluded ? 'line-through opacity-70' : ''}`}>{formatCurrency(expense.amount, expense.currency)}</span>
          <button onClick={() => onEdit(expense)} title="Edit expense"
            className="flex h-7 w-7 items-center justify-center border-2 border-stone-300 bg-[#fdfbf7] text-stone-500 opacity-0 transition-all group-hover:opacity-100 hover:border-stone-800 hover:bg-[#f5eed7] hover:text-stone-800 dark:border-[#54463d] dark:bg-[#28211d] dark:text-stone-500 dark:hover:border-stone-600 dark:hover:bg-[#362d28] dark:hover:text-[#fdfbf7]">
            <PencilIcon />
          </button>
          <button onClick={() => onDelete(expense.id)} title="Delete expense"
            className="flex h-7 w-7 items-center justify-center border-2 border-red-200 bg-red-50 text-red-500 opacity-0 transition-all group-hover:opacity-100 hover:border-red-400 hover:bg-red-100 hover:text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400 dark:hover:border-red-800 dark:hover:bg-red-900/40 dark:hover:text-red-300">
            <TrashIcon />
          </button>
        </div>
      </div>

      <p className="mb-3 font-mono text-sm font-medium leading-snug text-stone-800 dark:text-[#f5ebd5]">{expense.description}</p>

      <div className="mb-3 flex items-center gap-2">
        <span className="font-pixel text-[8px] uppercase tracking-widest text-stone-500 dark:text-stone-400 shrink-0">Paid by</span>
        {payer && (
          <div className="flex items-center gap-1.5">
            <Avatar name={payer.name} colorClass={payer.color} size="xs" />
            <span className="font-mono text-xs font-semibold text-stone-700 dark:text-[#fdfbf7]">{payer.name}</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-pixel text-[8px] uppercase tracking-widest text-stone-500 dark:text-stone-400 shrink-0">Split</span>
        <div className="flex flex-wrap items-center gap-1">{splitMembers.map((p) => <Avatar key={p.id} name={p.name} colorClass={p.color} size="xs" />)}</div>
        <span className="font-mono text-[10px] text-stone-500 dark:text-stone-400">({splitMembers.length} people · {formatCurrency(perPerson, expense.currency)} each)</span>
      </div>
    </div>
  );
}

function PencilIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
}
function TrashIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>;
}
