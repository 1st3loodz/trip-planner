"use client";

import { useState, useMemo } from "react";
import {
  Expense, Participant, ExpenseCategory,
  EXPENSE_CATEGORY_META, CURRENCY_META, Currency,
} from "@/types/trip";
import { useCurrency } from "@/contexts/CurrencyContext";
import { convertToBase, formatBase } from "@/lib/currency";
import { formatCurrency } from "@/lib/utils";
import Avatar from "@/components/Avatar";
import MemberCategoryChart from "@/components/MemberCategoryChart";

interface IndividualSummaryProps {
  expenses: Expense[];
  participants: Participant[];
  customCategories?: { id: string; label: string; emoji: string }[];
}

interface LedgerEntry { expense: Expense; share: number; isPersonal?: boolean; }
interface DayGroup    { date: string; items: LedgerEntry[]; }

const ALL_CATEGORY = "all" as const;
type CatFilter = ExpenseCategory | typeof ALL_CATEGORY;

export default function IndividualSummary({ expenses, participants, customCategories = [] }: IndividualSummaryProps) {
  const { baseCurrency, rates } = useCurrency();

  const [selectedId, setSelectedId] = useState<string>(participants[0]?.id ?? "");
  const [catFilter,  setCatFilter]  = useState<CatFilter>(ALL_CATEGORY);

  const member = participants.find((p) => p.id === selectedId);

  // ── Build raw date-grouped ledger (all categories) for this member ─────────
  const allGroups = useMemo<DayGroup[]>(() => {
    const map = new Map<string, LedgerEntry[]>();
    for (const exp of expenses) {
      if (exp.isExcluded) {
        const split = exp.splits.find((s) => s.participantId === selectedId);
        if (exp.paidById === selectedId || split) {
          const list = map.get(exp.date) ?? [];
          const share = exp.paidById === selectedId ? exp.amount : split!.amount;
          list.push({ expense: exp, share, isPersonal: true });
          map.set(exp.date, list);
        }
        continue;
      }
      const split = exp.splits.find((s) => s.participantId === selectedId);
      if (!split) continue;
      const list = map.get(exp.date) ?? [];
      list.push({ expense: exp, share: split.amount, isPersonal: false });
      map.set(exp.date, list);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, items]) => ({ date, items }));
  }, [expenses, selectedId]);

  // ── Apply category filter ──────────────────────────────────────────────────
  const groups = useMemo<DayGroup[]>(() => {
    if (catFilter === ALL_CATEGORY) return allGroups;
    return allGroups
      .map(({ date, items }) => ({ date, items: items.filter((i) => i.expense.category === catFilter) }))
      .filter(({ items }) => items.length > 0);
  }, [allGroups, catFilter]);

  // ── Grand totals per currency (filtered) ───────────────────────────────────
  const grandTotals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const g of groups) for (const { expense, share } of g.items) {
      t[expense.currency] = (t[expense.currency] ?? 0) + share;
    }
    return t;
  }, [groups]);

  // ── Grand total in base currency (filtered) ────────────────────────────────
  const { sharedBase, personalBase, combinedBase } = useMemo(() => {
    let shared = 0;
    let personal = 0;
    for (const g of groups) {
      for (const { expense, share, isPersonal } of g.items) {
        const baseAmt = convertToBase(share, expense.currency, rates);
        if (isPersonal) personal += baseAmt;
        else shared += baseAmt;
      }
    }
    return { sharedBase: shared, personalBase: personal, combinedBase: shared + personal };
  }, [groups, rates]);

  function formatDate(isoDate: string) {
    return new Date(isoDate + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
  }

  function getDayTotals(items: LedgerEntry[]) {
    const t: Record<string, number> = {};
    for (const { expense, share } of items) t[expense.currency] = (t[expense.currency] ?? 0) + share;
    return Object.entries(t);
  }

  function getDayTotalBase(items: LedgerEntry[]): number {
    return items.reduce((s, { expense, share }) => s + convertToBase(share, expense.currency, rates), 0);
  }

  const CATEGORIES = Object.keys(EXPENSE_CATEGORY_META) as ExpenseCategory[];

  return (
    <div>
      {/* ── Row 1: Member selector ──────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="font-pixel text-[8px] uppercase tracking-widest text-stone-500 dark:text-stone-400 shrink-0">
          Member:
        </span>
        <div className="flex flex-wrap gap-2">
          {participants.map((p) => {
            const active = p.id === selectedId;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`flex items-center gap-1.5 border-2 px-3 py-1.5 font-mono text-xs font-semibold transition-all ${
                  active
                    ? "border-stone-800 bg-stone-800 text-[#fdfbf7] shadow-[2px_2px_0_#292524] dark:border-[#54463d] dark:bg-[#1e1815] dark:shadow-[2px_2px_0_#54463d]"
                    : "border-stone-400 bg-[#fdfbf7] text-stone-600 hover:border-stone-600 dark:border-stone-600 dark:bg-[#28211d] dark:text-[#f5ebd5] dark:hover:border-[#54463d]"
                }`}
              >
                <Avatar name={p.name} colorClass={p.color} size="xs" tooltip={false} />
                {p.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Row 2: Category filter ──────────────────────────────────────────── */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="font-pixel text-[8px] uppercase tracking-widest text-stone-500 dark:text-stone-400 shrink-0">
          Category:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {/* All pill */}
          <button
            onClick={() => setCatFilter(ALL_CATEGORY)}
            className={`border-2 px-3 py-1 font-mono text-[10px] font-semibold transition-all ${
              catFilter === ALL_CATEGORY
                ? "border-stone-800 bg-stone-800 text-[#fdfbf7] dark:border-[#54463d] dark:bg-[#1e1815] dark:text-[#fdfbf7]"
                : "border-stone-400 bg-[#fdfbf7] text-stone-600 hover:border-stone-600 dark:border-stone-600 dark:bg-[#28211d] dark:text-stone-400 dark:hover:border-[#54463d]"
            }`}
          >
            🔘 All
          </button>
          {CATEGORIES.map((cat) => {
            const m      = EXPENSE_CATEGORY_META[cat];
            const active = catFilter === cat;
            return (
              <button
                key={cat}
                onClick={() => setCatFilter(cat)}
                className={`border-2 px-3 py-1 font-mono text-[10px] font-semibold transition-all ${
                  active
                    ? `${m.color} border-current text-stone-900`
                    : "border-stone-400 bg-[#fdfbf7] text-stone-600 hover:border-stone-600 dark:border-stone-600 dark:bg-[#28211d] dark:text-stone-400 dark:hover:border-[#54463d]"
                }`}
              >
                {m.emoji} {m.label}
              </button>
            );
          })}
          {customCategories.map((cat) => {
            const active = catFilter === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setCatFilter(cat.id)}
                className={`border-2 px-3 py-1 font-mono text-[10px] font-semibold transition-all ${
                  active
                    ? "bg-stone-500/15 text-stone-900 border-stone-800 dark:text-[#fdfbf7] dark:border-[#54463d]"
                    : "border-stone-400 bg-[#fdfbf7] text-stone-600 hover:border-stone-600 dark:border-stone-600 dark:bg-[#28211d] dark:text-stone-400 dark:hover:border-[#54463d]"
                }`}
              >
                {cat.emoji} {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Category pie chart (tied to selected member) ────────────────────── */}
      {member && (
        <MemberCategoryChart
          memberId={selectedId}
          memberName={member.name}
          expenses={expenses}
          customCategories={customCategories}
        />
      )}

      {/* ── Ledger ──────────────────────────────────────────────────────────── */}
      {groups.length === 0 ? (
        <div className="py-12 text-center text-stone-500 dark:text-stone-400">
          <div className="mb-2 text-4xl">🔍</div>
          <p className="font-mono text-sm">
            {catFilter === ALL_CATEGORY
              ? `${member?.name ?? "This member"} has no expenses.`
              : `No ${EXPENSE_CATEGORY_META[catFilter]?.label || customCategories.find(c=>c.id===catFilter)?.label || "such"} expenses for ${member?.name}.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(({ date, items }) => {
            const dayTotals   = getDayTotals(items);
            const dayTotalBase = getDayTotalBase(items);
            return (
              <div key={date} className="overflow-hidden border-2 border-stone-400 bg-[#fdfbf7] dark:border-[#54463d] dark:bg-[#28211d]">
                {/* Date header */}
                <div className="flex items-center justify-between border-b-2 border-stone-400 bg-[#f5eed7] px-4 py-2.5 dark:border-[#54463d] dark:bg-[#362d28]">
                  <div className="flex items-center gap-2">
                    <span>📅</span>
                    <span className="font-mono text-xs font-bold text-stone-800 dark:text-[#fdfbf7]">{formatDate(date)}</span>
                  </div>
                  <span className="font-mono text-[10px] font-bold text-stone-700 dark:text-stone-300">
                    ≈ {formatBase(dayTotalBase, baseCurrency)}
                  </span>
                </div>

                {/* Expense rows */}
                <div className="divide-y-2 divide-stone-200 dark:divide-stone-700">
                  {items.map(({ expense, share, isPersonal }) => {
                    const customCat = customCategories.find(c => c.id === expense.category);
                    const cat      = EXPENSE_CATEGORY_META[expense.category] || { label: customCat?.label || expense.category, emoji: customCat?.emoji || "✨", color: "bg-stone-500/15 text-stone-800" };
                    const cur      = CURRENCY_META[expense.currency];
                    const isPayer  = expense.paidById === selectedId;
                    const baseAmt  = convertToBase(share, expense.currency, rates);
                    return (
                      <div key={expense.id} className="flex items-center gap-3 px-4 py-3">
                        <span className="text-base shrink-0">{cat.emoji}</span>

                        <div className="flex-1 min-w-0">
                          <p className="truncate font-mono text-xs font-medium text-stone-800 dark:text-[#fdfbf7]">
                            {expense.description}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className={`text-[10px] border px-1.5 py-px font-mono font-semibold ${cat.color} text-stone-800`}>
                              {cat.label}
                            </span>
                            {isPayer && !isPersonal && (
                              <span className="border border-stone-400 bg-stone-200 px-1.5 py-px font-mono text-[10px] font-semibold text-stone-800 dark:border-[#54463d] dark:bg-[#1e1815] dark:text-stone-300">
                                💳 ผู้จ่าย
                              </span>
                            )}
                            {isPersonal && (
                              <span className="border border-stone-400 bg-amber-100 px-1.5 py-px font-mono text-[10px] font-semibold text-stone-800 dark:border-[#54463d] dark:bg-amber-900/30 dark:text-amber-200">
                                🛡️ Personal / Excluded
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Amounts: original + base */}
                        <div className="shrink-0 text-right">
                          <div className="font-mono text-xs font-bold tabular-nums text-stone-800 dark:text-[#fdfbf7]">
                            {formatCurrency(share, expense.currency)}
                          </div>
                          <div className="font-pixel text-[8px] uppercase tracking-wider text-stone-500 dark:text-stone-400">
                            {cur.flag} {expense.currency}
                          </div>
                          {expense.currency !== baseCurrency && (
                            <div className="font-mono text-[10px] font-semibold text-stone-600 dark:text-stone-400 tabular-nums">
                              ≈ {formatBase(baseAmt, baseCurrency)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Daily รวม rows */}
                <div className="border-t-2 border-stone-400 bg-stone-100 dark:border-[#54463d] dark:bg-[#1e1815]">
                  {dayTotals.map(([cur, total]) => (
                    <div key={cur} className="flex items-center justify-between px-4 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-pixel text-[8px] font-bold uppercase tracking-widest text-stone-500 dark:text-stone-400">รวม</span>
                        <span className="font-mono text-[10px] text-stone-500 dark:text-stone-400">
                          {CURRENCY_META[cur as Currency].flag} {cur}
                        </span>
                      </div>
                      <span className="font-mono text-sm font-black tabular-nums text-stone-800 dark:text-[#fdfbf7]">
                        {formatCurrency(total, cur)}
                      </span>
                    </div>
                  ))}
                  {/* Base-currency daily total */}
                  <div className="flex items-center justify-between border-t-2 border-stone-300 px-4 py-1.5 dark:border-stone-700">
                    <div className="flex items-center gap-2">
                      <span className="font-pixel text-[8px] font-bold uppercase tracking-widest text-stone-500 dark:text-stone-400">รวม</span>
                      <span className="font-mono text-[10px] text-stone-500 dark:text-stone-400">
                        {CURRENCY_META[baseCurrency].flag} {baseCurrency} (converted)
                      </span>
                    </div>
                    <span className="font-mono text-sm font-black tabular-nums text-emerald-700 dark:text-[#4a7c59]">
                      {formatBase(dayTotalBase, baseCurrency)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Grand total card */}
          <div className="border-2 border-stone-800 bg-[#f5eed7] p-4 dark:border-[#54463d] dark:bg-[#362d28] shadow-[4px_4px_0_#292524] dark:shadow-[4px_4px_0_#1e1815]">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {member && <Avatar name={member.name} colorClass={member.color} size="sm" tooltip={false} />}
                <span className="font-mono text-xs font-bold text-stone-800 dark:text-[#fdfbf7]">
                  {member?.name}
                  {catFilter !== ALL_CATEGORY && ` · ${EXPENSE_CATEGORY_META[catFilter]?.label || customCategories.find(c=>c.id===catFilter)?.label || catFilter}`}
                  {" "}— Grand Total
                </span>
              </div>
            </div>

            {/* Original currency totals */}
            <div className="mb-2 flex flex-wrap gap-3">
              {Object.entries(grandTotals).map(([cur, total]) => (
                <div key={cur} className="flex items-center gap-1.5">
                  <span className="text-sm">{CURRENCY_META[cur as Currency].flag}</span>
                  <span className="font-mono text-sm font-black tabular-nums text-stone-800 dark:text-[#fdfbf7]">
                    {formatCurrency(total, cur)}
                  </span>
                  <span className="font-pixel text-[8px] uppercase text-stone-500 dark:text-stone-400">{cur}</span>
                </div>
              ))}
            </div>

            {/* Base currency grand total breakdown */}
            <div className="mt-4 border-t-2 border-stone-400 pt-3 dark:border-[#54463d] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-pixel text-[8px] uppercase text-stone-600 dark:text-[#f5ebd5]">Group Shared:</span>
                <span className="font-mono text-sm font-semibold text-stone-800 dark:text-[#fdfbf7]">{formatBase(sharedBase, baseCurrency)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-pixel text-[8px] uppercase text-stone-600 dark:text-[#f5ebd5]">Personal Excluded:</span>
                <span className="font-mono text-sm font-semibold text-stone-800 dark:text-[#fdfbf7]">{formatBase(personalBase, baseCurrency)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-stone-300 dark:border-[#54463d] pt-2">
                <span className="font-pixel text-[10px] uppercase text-stone-800 dark:text-[#fdfbf7]">Combined Total:</span>
                <span className="font-mono text-lg font-black tabular-nums text-emerald-700 dark:text-emerald-400">
                  {formatBase(combinedBase, baseCurrency)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
