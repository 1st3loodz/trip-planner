"use client";

import { Expense, Participant, EXPENSE_CATEGORY_META } from "@/types/trip";
import { formatCurrency } from "@/lib/utils";
import { getConvertedAmountTHB } from "@/lib/currency";
import Avatar from "@/components/Avatar";
import { resolvePayerId, getResolvedSplits } from "@/lib/settlement";
import { X } from "lucide-react";

interface ExpenseDetailModalProps {
  expense: Expense;
  participants: Participant[];
  onClose: () => void;
  customCategories?: { id: string; label: string; emoji: string; color?: string }[];
}

export default function ExpenseDetailModal({ expense, participants, onClose, customCategories = [] }: ExpenseDetailModalProps) {
  const customCat = customCategories.find((c) => c.id === expense.category);
  const cat = EXPENSE_CATEGORY_META[expense.category] || { label: customCat?.label || expense.category, emoji: customCat?.emoji || "✨", color: "bg-stone-500/15 text-stone-600 border-stone-500/30" };
  
  // Safely resolve Payer Name
  const payerId = resolvePayerId(expense, participants);
  const payerName = participants.find((m) => m.id === payerId)?.name || 'Unknown';
  const payerColor = participants.find((m) => m.id === payerId)?.color || 'bg-stone-500 text-white';

  const resolvedSplits = getResolvedSplits(expense, participants);
  
  const actualDate = expense.date || (expense as any).expense_date || expense.createdAt || (expense as any).created_at;
  const parsedDate = actualDate ? new Date(actualDate.includes('T') ? actualDate : actualDate + "T00:00:00") : null;
  const dateLabel = parsedDate ? parsedDate.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }) : "";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="w-full max-w-md overflow-hidden rounded-xl border-2 border-stone-800 bg-[#fdfbf7] dark:border-[#54463d] dark:bg-[#28211d] shadow-[8px_8px_0_#292524] dark:shadow-[8px_8px_0_#1e1815]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b-2 border-stone-400 bg-[#f5eed7] px-4 py-3 dark:border-[#54463d] dark:bg-[#362d28]">
          <h2 className="font-pixel text-[10px] uppercase tracking-widest text-stone-800 dark:text-[#fdfbf7]">Expense Details</h2>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-[#fdfbf7]">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-5 space-y-5">
          {/* Header section */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className={`inline-block border-2 px-2.5 py-0.5 font-pixel text-[8px] uppercase mb-2 ${cat.color} text-stone-800`}>
                {cat.emoji} {cat.label}
              </span>
              <h3 className="font-mono text-xl font-bold text-stone-900 dark:text-[#fdfbf7] leading-tight">
                {expense.description}
              </h3>
              {dateLabel && <p className="font-mono text-xs text-stone-500 dark:text-stone-400 mt-1">{dateLabel}</p>}
            </div>
            <div className="text-right shrink-0">
              <span className="block font-mono text-xl font-black text-[#4a7c59] dark:text-emerald-400">
                {formatCurrency(getConvertedAmountTHB(expense), "THB")}
              </span>
              {(expense.foreignAmount || (!expense.foreignAmount && expense.currency !== "THB")) && (
                <span className="font-mono text-[10px] text-stone-500 dark:text-stone-400">
                  {formatCurrency(expense.foreignAmount || expense.amount, expense.currency)} 
                </span>
              )}
            </div>
          </div>

          <div className="h-px w-full bg-stone-200 dark:bg-stone-700" />

          {/* Payer info */}
          <div className="flex items-center justify-between">
            <span className="font-pixel text-[9px] uppercase tracking-wider text-stone-500 dark:text-stone-400">Paid by</span>
            <div className="flex items-center gap-2">
              <Avatar name={payerName} colorClass={payerColor} size="sm" />
              <span className="font-mono text-sm font-semibold text-stone-800 dark:text-[#fdfbf7]">{payerName}</span>
            </div>
          </div>

          <div className="h-px w-full bg-stone-200 dark:bg-stone-700" />

          {/* Splits breakdown */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="font-pixel text-[9px] uppercase tracking-wider text-stone-500 dark:text-stone-400">Split Between</span>
              {(expense as any).splitType === 'CUSTOM' && (
                <span className="border border-amber-400 bg-amber-50 px-1.5 py-0.5 font-pixel text-[7px] uppercase text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">Custom Split</span>
              )}
            </div>
            
            <div className="space-y-2">
              {resolvedSplits.length > 0 ? resolvedSplits.map((split: any, idx: number) => {
                const memberId = String(split?.participantId || split?.id || split || '').trim();
                const member = participants.find((m) => m.id === memberId);
                const memberName = member ? member.name : (typeof split === 'string' ? split : `Member ${idx + 1}`);
                const splitAmount = typeof split === 'object' && split?.amount !== undefined ? Number(split.amount) : 0;
                
                return (
                  <div key={memberId || idx} className="flex justify-between items-center py-2 border-b border-stone-100 dark:border-stone-800 font-mono text-sm">
                    <div className="flex items-center gap-2">
                      {member && <Avatar name={member.name} colorClass={member.color} size="xs" tooltip={false} />}
                      <span className="font-medium text-stone-700 dark:text-stone-300">{memberName}</span>
                    </div>
                    <span className="font-bold text-stone-800 dark:text-[#fdfbf7]">
                      {formatCurrency(splitAmount, expense.currency)}
                    </span>
                  </div>
                );
              }) : (
                <div className="text-sm font-mono text-stone-500 dark:text-stone-400 italic">No split members recorded.</div>
              )}
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={onClose}
              className="w-full rounded-md border-2 border-stone-800 bg-[#fdfbf7] py-2 font-mono text-xs font-bold uppercase tracking-wider text-stone-800 transition-colors hover:bg-stone-100 dark:border-[#54463d] dark:bg-[#1e1815] dark:text-[#fdfbf7] dark:hover:bg-[#28211d]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
