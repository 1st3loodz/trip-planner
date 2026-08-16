"use client";

import { useState, useMemo } from "react";
import { Settlement, Participant, CURRENCY_META, EXPENSE_CATEGORY_META, Expense } from "@/types/trip";
import { formatCurrency } from "@/lib/utils";
import { formatBase, getConvertedAmountTHB } from "@/lib/currency";
import { computeMemberBalances } from "@/lib/settlement";
import Avatar from "@/components/Avatar";

interface SettlementCalculatorProps {
  settlements:  Settlement[];
  participants: Participant[];
  expenses:     Expense[];
  onEditExpense: (e: Expense) => void;
  onEditExpenses?: (e: Expense[]) => void;
}

export default function SettlementCalculator({ settlements, participants, expenses, onEditExpense, onEditExpenses }: SettlementCalculatorProps) {
  // Set of keys marking settlements expanded to show breakdown
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  
  // Staged UI tracking array for sub-items
  const [stagedSettlements, setStagedSettlements] = useState<string[]>([]);
  
  // Member Filter
  const [memberFilter, setMemberFilter] = useState<string>("all");

  // Debug panel toggle
  const [showDebug, setShowDebug] = useState(false);

  // ── Per-member balance audit (paid / share / net) ──────────────────────────
  const memberBalances = useMemo(
    () => computeMemberBalances(expenses, participants),
    [expenses, participants]
  );

  function settlementKey(s: Settlement) {
    return `${s.fromId}-${s.toId}`;
  }

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Initialize stagedSettlements from database whenever settlements change
  useMemo(() => {
    const settledIds: string[] = [];
    settlements.forEach(s => {
      s.involvedExpenses?.forEach((inv, idx) => {
        if (!inv?.expense) return; // guard: skip if expense data is missing
        const debtorId = inv.isCredit ? s.toId : s.fromId;
        const split = inv.expense.splits?.find(sp => sp.participantId === debtorId);
        if (split?.isSettled) settledIds.push(`${inv.expense.id}-${debtorId}`);
      });
    });
    setStagedSettlements(settledIds);
  }, [settlements]);

  async function toggleSubExpenseSettled(s: Settlement, inv: NonNullable<Settlement["involvedExpenses"]>[0]) {
    if (!inv?.expense?.id) return;
    const debtorId = inv.isCredit ? s.toId : s.fromId;
    const itemId = `${inv.expense.id}-${debtorId}`;
    
    // Determine the action based on the *specific* sub-item's current state
    const isCurrentlySettled = stagedSettlements.includes(itemId);
    
    // 1. Instant local visual update
    if (isCurrentlySettled) {
      setStagedSettlements(prev => prev.filter(id => id !== itemId));
    } else {
      setStagedSettlements(prev => [...prev, itemId]);
    }
    
    // 2. Database update
    let expToUpdate = { ...inv.expense };
    const split = expToUpdate.splits?.find(sp => sp.participantId === debtorId);
    
    if (isCurrentlySettled && split?.isSettled) {
      expToUpdate = {
        ...expToUpdate,
        splits: (expToUpdate.splits ?? []).map(sp => sp.participantId === debtorId ? { ...sp, isSettled: false } : sp)
      };
    } else if (!isCurrentlySettled && !split?.isSettled) {
      expToUpdate = {
        ...expToUpdate,
        splits: (expToUpdate.splits ?? []).map(sp => sp.participantId === debtorId ? { ...sp, isSettled: true } : sp)
      };
    }
    
    onEditExpense(expToUpdate);
  }

  async function handleMasterToggle(s: Settlement, isMasterChecked: boolean) {
    const currentSubItems = s.involvedExpenses;
    if (!currentSubItems || currentSubItems.length === 0) return;
    
    // 1. Instant local visual update using functional array mutation
    if (!isMasterChecked) {
      // Checking the group: Add all missing IDs
      setStagedSettlements(prev => {
        const uniqueNewIds = currentSubItems
          .filter(inv => inv?.expense?.id)
          .map(inv => {
            const debtorId = inv.isCredit ? s.toId : s.fromId;
            return `${inv.expense.id}-${debtorId}`;
          }).filter(id => !prev.includes(id));
        return [...prev, ...uniqueNewIds];
      });
    } else {
      // Unchecking the group: Evict all IDs belonging to this group
      setStagedSettlements(prev => {
        const toRemove = currentSubItems
          .filter(inv => inv?.expense?.id)
          .map(inv => {
            const debtorId = inv.isCredit ? s.toId : s.fromId;
            return `${inv.expense.id}-${debtorId}`;
          });
        return prev.filter(id => !toRemove.includes(id));
      });
    }
    
    // 2. Database update batching
    const updates = new Map<string, Expense>();
    
    for (const inv of currentSubItems) {
      if (!inv?.expense?.id) continue; // guard: skip malformed entries
      const debtorId = inv.isCredit ? s.toId : s.fromId;
      let expToUpdate = updates.get(inv.expense.id) || inv.expense;
      
      const split = expToUpdate.splits?.find(sp => sp.participantId === debtorId);
      
      if (isMasterChecked && split?.isSettled) {
        expToUpdate = {
          ...expToUpdate,
          splits: (expToUpdate.splits ?? []).map(sp => sp.participantId === debtorId ? { ...sp, isSettled: false } : sp)
        };
        updates.set(expToUpdate.id, expToUpdate);
      } else if (!isMasterChecked && !split?.isSettled) {
        expToUpdate = {
          ...expToUpdate,
          splits: (expToUpdate.splits ?? []).map(sp => sp.participantId === debtorId ? { ...sp, isSettled: true } : sp)
        };
        updates.set(expToUpdate.id, expToUpdate);
      }
    }
    
    const updatesArray = Array.from(updates.values());
    if (onEditExpenses) {
      onEditExpenses(updatesArray);
    } else {
      for (let i = 0; i < updatesArray.length; i++) {
        if (i > 0) await new Promise(r => setTimeout(r, 100));
        onEditExpense(updatesArray[i]);
      }
    }
  }

  const findP = (id: string) => participants.find((p) => p.id === id);

  function checkIsAllSubChecked(s: Settlement) {
    if (!s.involvedExpenses || s.involvedExpenses.length === 0) return false;
    return s.involvedExpenses.every(inv => {
      const subDebtorId = inv.isCredit ? s.toId : s.fromId;
      const itemId = `${inv.expense.id}-${subDebtorId}`;
      return stagedSettlements.includes(itemId);
    });
  }

  // Filter settlements based on memberFilter
  const filteredSettlements = useMemo(() => {
    if (memberFilter === "all") return settlements;
    return settlements.filter((s) => s.fromId === memberFilter || s.toId === memberFilter);
  }, [settlements, memberFilter]);

  const clearedCount = filteredSettlements.filter((s) => {
    return s.amount === 0 || checkIsAllSubChecked(s);
  }).length;

  // Group by currency, then group by fromId (debtor)
  const groupedSettlements = useMemo(() => {
    const byCur: Record<string, Record<string, Settlement[]>> = {};
    for (const s of filteredSettlements) {
      if (!byCur[s.currency]) byCur[s.currency] = {};
      if (!byCur[s.currency][s.fromId]) byCur[s.currency][s.fromId] = [];
      byCur[s.currency][s.fromId].push(s);
    }
    
    // Sort debtors and their settlement rows alphabetically (A-Z) by name
    const sortedByCur: { currency: string; groups: { debtorId: string; totalDebt: number; list: Settlement[] }[] }[] = [];
    for (const [cur, debtorsMap] of Object.entries(byCur)) {
      const groups = Object.entries(debtorsMap).map(([debtorId, list]) => {
        // Sort inner list by receiver name A-Z
        list.sort((a, b) => {
          const nameA = findP(a.toId)?.name ?? "";
          const nameB = findP(b.toId)?.name ?? "";
          return nameA.localeCompare(nameB);
        });
        const totalDebt = list.reduce((sum, s) => sum + s.amount, 0);
        return { debtorId, totalDebt, list };
      });
      // Sort debtor groups by debtor name A-Z
      groups.sort((a, b) => {
        const nameA = findP(a.debtorId)?.name ?? "";
        const nameB = findP(b.debtorId)?.name ?? "";
        return nameA.localeCompare(nameB);
      });
      sortedByCur.push({ currency: cur, groups });
    }
    return sortedByCur;
  }, [filteredSettlements]);

  if (settlements.length === 0) {
    return (
      <div className="border-2 border-stone-400 bg-stone-100 px-5 py-6 text-center dark:border-[#54463d] dark:bg-[#362d28]">
        <div className="mb-1 text-3xl">🎉</div>
        <p className="font-pixel text-[10px] uppercase tracking-wider text-stone-800 dark:text-[#fdfbf7]">All settled up!</p>
        <p className="mt-1 font-mono text-xs text-stone-600 dark:text-[#f5ebd5]">No outstanding balances.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Balance Audit Debug Panel ───────────────────────────────────────── */}
      <div className="border-2 border-stone-400 bg-[#fdfbf7] dark:border-[#54463d] dark:bg-[#28211d]">
        <button
          onClick={() => setShowDebug(v => !v)}
          className="flex w-full items-center justify-between px-4 py-2.5 hover:bg-[#f5eed7] dark:hover:bg-[#362d28] transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm">🔍</span>
            <span className="font-pixel text-[8px] uppercase tracking-widest text-stone-600 dark:text-stone-400">
              Balance Audit — Verify Creditor / Debtor Direction
            </span>
          </div>
          <span className="font-mono text-[10px] text-stone-500 dark:text-stone-400">
            {showDebug ? "▲ Hide" : "▼ Show"}
          </span>
        </button>

        {showDebug && (
          <div className="border-t-2 border-stone-300 dark:border-[#54463d] p-4">
            <p className="mb-3 font-mono text-[10px] text-stone-500 dark:text-stone-400">
              Formula: <span className="font-semibold text-stone-700 dark:text-stone-300">net = totalPaid − totalShare</span>
              &nbsp;·&nbsp;
              <span className="text-[#4a7c59] dark:text-emerald-400 font-semibold">net &gt; 0 = เจ้าหนี้ Creditor (should RECEIVE)</span>
              &nbsp;·&nbsp;
              <span className="text-red-600 dark:text-red-400 font-semibold">net &lt; 0 = ลูกหนี้ Debtor (must PAY)</span>
            </p>

            <div className="overflow-x-auto">
              <table className="w-full font-mono text-[11px]">
                <thead>
                  <tr className="border-b-2 border-stone-300 dark:border-stone-600">
                    <th className="pb-2 text-left font-pixel text-[8px] uppercase tracking-wider text-stone-500 dark:text-stone-400">Member</th>
                    <th className="pb-2 text-right font-pixel text-[8px] uppercase tracking-wider text-stone-500 dark:text-stone-400">Paid (A)</th>
                    <th className="pb-2 text-right font-pixel text-[8px] uppercase tracking-wider text-stone-500 dark:text-stone-400">Share (B)</th>
                    <th className="pb-2 text-right font-pixel text-[8px] uppercase tracking-wider text-stone-500 dark:text-stone-400">Net = A−B</th>
                    <th className="pb-2 text-center font-pixel text-[8px] uppercase tracking-wider text-stone-500 dark:text-stone-400">Status</th>
                    <th className="pb-2 text-left font-pixel text-[8px] uppercase tracking-wider text-stone-500 dark:text-stone-400">Settlement Rows</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 dark:divide-stone-700">
                  {memberBalances.map((mb) => {
                    const isCreditor = mb.net > 0.5;
                    const isDebtor   = mb.net < -0.5;
                    const p = participants.find(p => p.id === mb.id);

                    // Which settlement rows list this member?
                    const mySettlements = settlements.filter(
                      s => s.fromId === mb.id || s.toId === mb.id
                    );

                    return (
                      <tr key={mb.id} className="py-2">
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-2">
                            {p && <Avatar name={p.name} colorClass={p.color} size="xs" tooltip={false} />}
                            <span className="font-semibold text-stone-800 dark:text-[#fdfbf7]">{mb.name}</span>
                          </div>
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-stone-700 dark:text-stone-300">
                          {formatBase(mb.paid, settlements[0]?.currency ?? 'THB')}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-stone-700 dark:text-stone-300">
                          {formatBase(mb.share, settlements[0]?.currency ?? 'THB')}
                        </td>
                        <td className={`py-2 pr-3 text-right tabular-nums font-bold ${isCreditor ? 'text-[#4a7c59] dark:text-emerald-400' : isDebtor ? 'text-red-700 dark:text-red-400' : 'text-stone-500 dark:text-stone-400'}`}>
                          {mb.net > 0 ? "+" : ""}{formatBase(mb.net, settlements[0]?.currency ?? 'THB')}
                        </td>
                        <td className="py-2 pr-3 text-center">
                          <span className={`border-2 px-2 py-0.5 font-pixel text-[7px] uppercase tracking-wider whitespace-nowrap ${
                            isCreditor
                              ? 'border-[#4a7c59] bg-[#4a7c59]/10 text-[#2d5a3d] dark:text-emerald-400'
                              : isDebtor
                                ? 'border-red-400 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400'
                                : 'border-stone-400 bg-stone-100 text-stone-600 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-400'
                          }`}>
                            {isCreditor ? '✓ RECEIVE' : isDebtor ? '↑ PAY' : '= SETTLED'}
                          </span>
                        </td>
                        <td className="py-2 text-[10px] text-stone-500 dark:text-stone-400 max-w-[200px]">
                          {mySettlements.length === 0 ? (
                            <span className="italic">None</span>
                          ) : mySettlements.map((s, i) => {
                            const other = s.fromId === mb.id ? s.toId : s.fromId;
                            const role  = s.fromId === mb.id ? '→ pays' : '← receives from';
                            const otherName = participants.find(p => p.id === other)?.name ?? other.slice(0, 6);
                            return (
                              <span key={i} className={`inline-flex items-center gap-1 mr-1.5 ${s.fromId === mb.id ? 'text-red-600 dark:text-red-400' : 'text-[#4a7c59] dark:text-emerald-400'}`}>
                                {role} {otherName} ({formatBase(s.amount, s.currency)})
                              </span>
                            );
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-3 border-t border-stone-300 dark:border-stone-600 pt-3">
              <p className="font-pixel text-[8px] uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Settlement rows below: <span className="font-mono normal-case text-stone-700 dark:text-stone-300">fromId</span> = the person who <strong>pays</strong> &nbsp;·&nbsp;
                <span className="font-mono normal-case text-stone-700 dark:text-stone-300">toId</span> = the person who <strong>receives</strong>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Top Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-stone-400 bg-[#f5eed7] px-4 py-3 dark:border-[#54463d] dark:bg-[#28211d]">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className="shrink-0 font-pixel text-[8px] uppercase tracking-widest text-stone-500 dark:text-stone-400 mr-2">
            View:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setMemberFilter("all")}
              title="All Members"
              className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-stone-800 bg-[#fdfbf7] dark:bg-[#1e1815] dark:border-[#54463d] transition-all ${
                memberFilter === "all"
                  ? "outline outline-2 outline-offset-1 outline-stone-800 dark:outline-stone-400 opacity-100"
                  : "opacity-60 hover:opacity-100"
              }`}
            >
              <span className="text-sm leading-none">👥</span>
            </button>
            
            {participants.map((p) => (
              <button
                key={p.id}
                onClick={() => setMemberFilter(p.id)}
                title={p.name}
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-stone-800 font-mono text-xs font-bold transition-all ${p.color} ${
                  memberFilter === p.id
                    ? "outline outline-2 outline-offset-1 outline-stone-800 dark:outline-stone-400 opacity-100"
                    : "opacity-60 hover:opacity-100"
                }`}
              >
                {p.name.charAt(0).toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 overflow-hidden border border-stone-400 bg-stone-200 dark:border-[#54463d] dark:bg-[#1e1815]">
            <div
              className="h-full bg-[#4a7c59] transition-all duration-500 dark:bg-[#2d5a3d]"
              style={{ width: filteredSettlements.length > 0 ? `${(clearedCount / filteredSettlements.length) * 100}%` : "0%" }}
            />
          </div>
          <span className="font-mono text-[10px] text-stone-600 dark:text-[#f5ebd5]">
            {clearedCount} / {filteredSettlements.length}
          </span>
        </div>
      </div>

      {groupedSettlements.map(({ currency, groups }) => {
        const meta = CURRENCY_META[currency as keyof typeof CURRENCY_META];
        return (
          <div key={currency} className="space-y-4">
            {/* Currency Header */}
            <div className="flex items-center gap-2">
              <span className="text-xl">{meta.flag}</span>
              <h3 className="font-pixel text-[10px] uppercase tracking-wider text-stone-800 dark:text-[#fdfbf7]">{currency} Settlements</h3>
            </div>
            
            {groups.map(({ debtorId, totalDebt, list }) => {
              const debtor = findP(debtorId) || { id: debtorId, name: 'Unknown Member', color: 'bg-stone-500 text-white' };
              
              return (
                <div key={debtorId} className="overflow-hidden border-2 border-stone-400 bg-[#fdfbf7] dark:border-[#54463d] dark:bg-[#28211d]">
                  {/* Debtor Group Header */}
                  <div className="flex items-center gap-3 border-b-2 border-stone-400 bg-[#e8dcc4] px-4 py-2 dark:border-[#54463d] dark:bg-[#362d28]">
                    <span className="font-pixel text-[8px] uppercase tracking-widest text-stone-600 dark:text-stone-400">
                      Debtor
                    </span>
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar name={debtor.name} colorClass={debtor.color} size="xs" tooltip={false} />
                      <span className="truncate font-mono text-sm font-bold text-stone-800 dark:text-[#fdfbf7]">
                        {debtor.name}
                      </span>
                    </div>
                    <div className="ml-auto flex items-center gap-2 text-right">
                      <span className="font-pixel text-[8px] uppercase text-stone-500 dark:text-stone-400">
                        Total Owed
                      </span>
                      <span className="font-mono text-sm font-black text-red-700 dark:text-red-400 tabular-nums">
                        {formatCurrency(totalDebt, currency)}
                      </span>
                    </div>
                  </div>

                  {/* Settlement rows */}
                  <div className="divide-y-2 divide-stone-200 dark:divide-[#54463d]">
                    {list.map((s, i) => {
                      const to = findP(s.toId) || { id: s.toId, name: 'Unknown Member', color: 'bg-stone-500 text-white' };

                      const key       = settlementKey(s);
                      const isAllSubChecked = checkIsAllSubChecked(s);
                      const isZero    = s.amount === 0;
                      const isMasterChecked = isZero || isAllSubChecked;
                      const isExpanded = expanded.has(key);

                      return (
                        <div key={i} className={`flex flex-col transition-all duration-300 ${isMasterChecked ? "opacity-60" : ""}`}>
                          {/* Main Row */}
                          <div
                            onClick={() => toggleExpanded(key)}
                            className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-300 hover:bg-[#f5eed7] dark:hover:bg-[#362d28] ${
                              isMasterChecked ? "opacity-50" : ""
                            }`}
                          >
                            {/* ── Checkbox ── */}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleMasterToggle(s, isMasterChecked); }}
                              title={isMasterChecked ? "Mark as outstanding" : "Mark as settled"}
                              className={`shrink-0 flex h-5 w-5 items-center justify-center border-2 transition-all duration-200 ${
                                isMasterChecked
                                  ? "border-[#4a7c59] bg-[#4a7c59] text-[#fdfbf7] dark:border-[#2d5a3d] dark:bg-[#2d5a3d]"
                                  : "border-stone-400 bg-[#fdfbf7] hover:border-stone-800 dark:border-stone-500 dark:bg-[#1e1815] dark:hover:border-[#fdfbf7]"
                              }`}
                            >
                              {isMasterChecked && (
                                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="2,6 5,9 10,3" />
                                </svg>
                              )}
                            </button>

                            <span className="font-pixel text-[8px] uppercase text-stone-500 shrink-0 dark:text-stone-400">
                              Owes
                            </span>

                            {/* To */}
                            <div className="flex items-center gap-2 min-w-0">
                              <Avatar name={to.name} colorClass={to.color} size="sm" tooltip={false} />
                              <span className={`truncate font-mono text-xs font-semibold transition-all ${isMasterChecked ? "text-stone-500 line-through dark:text-stone-600" : "text-[#4a7c59] dark:text-[#2d5a3d]"}`}>
                                {to.name}
                              </span>
                            </div>

                            {/* Amount */}
                            <div className="ml-auto flex items-center gap-3">
                              <span
                                className={`border-2 px-2.5 py-0.5 font-mono text-xs font-bold tabular-nums transition-all ${
                                  isMasterChecked
                                    ? "border-stone-400 bg-stone-200 text-stone-500 line-through dark:border-[#54463d] dark:bg-[#1e1815] dark:text-stone-600"
                                    : "border-stone-800 bg-[#f5eed7] text-stone-800 dark:border-[#54463d] dark:bg-[#1e1815] dark:text-[#fdfbf7]"
                                }`}
                              >
                                {isMasterChecked && s.historicAmount !== undefined
                                  ? formatCurrency(s.historicAmount, s.currency)
                                  : formatCurrency(s.amount, s.currency)}
                              </span>
                              
                              <span className="font-mono text-[10px] text-stone-400 dark:text-stone-500 w-3 text-center">
                                {isExpanded ? "▲" : "▼"}
                              </span>
                            </div>
                          </div>

                          {/* Accordion Breakdown */}
                          {isExpanded && s.involvedExpenses && s.involvedExpenses.length > 0 && (
                            <div className="border-t-2 border-stone-200 bg-[#fdfbf7] p-4 dark:border-stone-700 dark:bg-[#1e1815]">
                              <h4 className="mb-3 font-pixel text-[8px] uppercase tracking-wider text-stone-500 dark:text-stone-400">
                                Specific Expenses Breakdown:
                              </h4>
                              <div className="space-y-2.5">
                                {s.involvedExpenses.map((inv, idx) => {
                                  // ── Safe category lookup (handles custom categories) ──
                                  const cat = (inv?.expense?.category && EXPENSE_CATEGORY_META[inv.expense.category])
                                    ? EXPENSE_CATEGORY_META[inv.expense.category]
                                    : { emoji: "🧾", label: "Expense" };
                                  const subDebtorId = inv.isCredit ? s.toId : s.fromId;
                                  const itemId = `${inv.expense?.id ?? idx}-${subDebtorId}`;
                                  const isSubSettled = stagedSettlements.includes(itemId);

                                  // ── Safe name lookups — never crash on missing participant ──
                                  const toName    = to?.name    || "Trip Member";
                                  const debtorName = debtor?.name || "Trip Member";
                                  const expDesc   = inv.expense?.description || "Expense";
                                  const expAmt    = inv.amountOwed ?? 0;
                                  const actualDate = inv.expense?.date || (inv.expense as any)?.expense_date || inv.expense?.createdAt || (inv.expense as any)?.created_at;
                                  const parsedDate = actualDate ? new Date(actualDate.includes('T') ? actualDate : actualDate + "T00:00:00") : null;
                                  const dateLabel = parsedDate ? parsedDate.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";

                                  return (
                                    <div key={idx} className={`flex items-center gap-3 font-mono text-[11px] transition-all duration-300 ${isSubSettled ? "opacity-40 grayscale" : ""}`}>
                                      {/* Sub-expense Settled Checkbox */}
                                      <button
                                        onClick={(e) => { e.stopPropagation(); toggleSubExpenseSettled(s, inv); }}
                                        title={isSubSettled ? "Mark as unpaid" : "Mark as paid directly"}
                                        className={`shrink-0 flex h-4 w-4 items-center justify-center border-2 transition-all duration-200 ${
                                          isSubSettled
                                            ? "border-[#4a7c59] bg-[#4a7c59] text-[#fdfbf7] dark:border-[#2d5a3d] dark:bg-[#2d5a3d]"
                                            : "border-stone-400 bg-[#fdfbf7] hover:border-stone-800 dark:border-stone-500 dark:bg-[#28211d] dark:hover:border-[#fdfbf7]"
                                        }`}
                                      >
                                        {isSubSettled && (
                                          <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="2,6 5,9 10,3" />
                                          </svg>
                                        )}
                                      </button>

                                      <span className={`w-4 shrink-0 text-center font-bold ${inv.isCredit ? 'text-stone-400 dark:text-stone-500' : 'text-red-600 dark:text-red-400'}`}>
                                        {inv.isCredit ? "−" : "+"}
                                      </span>
                                      <span className="shrink-0 text-sm">{cat.emoji}</span>
                                      <div className="flex-1 min-w-0 flex flex-col">
                                        <span className={`truncate font-semibold transition-all duration-300 ${isSubSettled ? 'line-through text-stone-500 dark:text-stone-600' : 'text-stone-700 dark:text-[#fdfbf7]'}`}>
                                          {expDesc}{' '}
                                          {(inv.expense as any)?.splitType === 'CUSTOM' && (
                                            <span className="inline-block border border-amber-400 bg-amber-50 px-1 py-0 font-pixel text-[7px] uppercase text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300 ml-1">Custom</span>
                                          )}
                                          {dateLabel && <span className="font-mono text-[9px] font-normal text-stone-500 dark:text-stone-400 ml-1">({dateLabel})</span>}
                                        </span>
                                        <span className="text-[9px] text-stone-500 dark:text-stone-400">
                                          {inv.isCredit
                                            ? `${toName} paid → ${debtorName} shared (credit offset)`
                                            : `${toName} paid → ${debtorName} owes`}
                                        </span>
                                      </div>
                                      <span className={`shrink-0 tabular-nums font-bold transition-all duration-300 ${isSubSettled ? "line-through text-stone-400 dark:text-stone-600" : (inv.isCredit ? "text-stone-500 dark:text-stone-400" : "text-red-700 dark:text-red-400")}`}>
                                        {formatCurrency(expAmt, s.currency)}
                                      </span>
                                    </div>
                                  );
                                })}
                                
                                <div className="mt-2 flex items-center justify-between border-t-2 border-stone-200 pt-3 dark:border-stone-700">
                                  <span className="font-mono text-xs font-bold text-stone-800 dark:text-[#fdfbf7]">
                                    Net Active Debt: <span className="tabular-nums">{formatCurrency(s.amount, s.currency)}</span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
