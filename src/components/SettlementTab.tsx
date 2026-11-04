import React, { useState } from "react";
import { Trip } from "@/types/trip";
import { calculateTransferPlan, convertToTHB, isSharedExpense, getExpenseExchangeRate, getParticipantShareTHB, isParticipantSettled } from "@/utils/settlement";
import Avatar from "@/components/Avatar";

interface SettlementTabProps {
  trip: Trip;
  currentUserId?: string | null;
  onToggleExpenseSettle: (expenseId: string, currentStatus: boolean) => void;
  onToggleParticipantSettle: (expenseId: string, participantId: string) => void;
  onSetPairSettled: (debtorId: string, creditorId: string, settled: boolean) => void;
}

export default function SettlementTab({ trip, currentUserId, onToggleExpenseSettle, onToggleParticipantSettle, onSetPairSettled }: SettlementTabProps) {
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string | "all">("all");

  const toggleDateGroup = (dateKey: string) => {
    setExpandedDates(prev => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  const tripRates = (trip as any).exchangeRates || null;
  const transfers = calculateTransferPlan(trip.expenses, trip.participants, tripRates);
  
  const visibleExpenses = trip.expenses.filter((e: any) => {
    if (selectedMemberFilter === "all") return isSharedExpense(e);
    
    const isPayer = String(e.paid_by || e.paidById || e.payer_id || '').trim() === selectedMemberFilter;
    const splits = Array.isArray(e.split_members) ? e.split_members : (Array.isArray(e.splits) ? e.splits : []);
    const isInSplit = splits.some((s: any) => String(s?.participantId || s?.id || s).trim() === selectedMemberFilter);
    
    // Member view: only debts this member owes to another payer (hide credit items where they paid)
    return isSharedExpense(e) && !isPayer && isInSplit && getParticipantShareTHB(e, selectedMemberFilter, tripRates) > 0.005;
  }).sort((a: any, b: any) => {
    const dateA = new Date(a.date || a.expense_date || a.created_at || a.createdAt || 0).getTime();
    const dateB = new Date(b.date || b.expense_date || b.created_at || b.createdAt || 0).getTime();
    return dateA - dateB;
  });

  // Whose share to display: selected member tab, otherwise the logged-in user
  const viewerId = selectedMemberFilter !== "all" ? String(selectedMemberFilter).trim() : (currentUserId ? String(currentUserId).trim() : null);

  const groupedExpenses = visibleExpenses.reduce((acc, expense: any) => {
    const rawDate = expense.date || expense.expense_date || expense.created_at;
    let dateKey = "Other / ไม่ระบุวันที่";
    if (rawDate) {
      try {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          dateKey = `📅 ${d.toLocaleDateString('en-GB')}`;
        }
      } catch (e) {}
    }
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(expense);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-6 pb-20">
      <div className="space-y-4">
        {/* Transfer Plan */}
        <div className="bg-white rounded-2xl p-5 border shadow-sm">
          <h4 className="font-semibold text-gray-800 text-sm mb-3">💸 แผนการโอนเงิน (Transfer Plan)</h4>
          {transfers.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-3 bg-white rounded-xl border border-dashed border-gray-300">
              ยอดเคลียร์ครบถ้วนแล้ว 🎉
            </p>
          ) : (
            <div className="space-y-2">
              {transfers.map((t, idx) => {
                const pairKey = `${t.fromId}_${t.toId}`;
                const isSettled = t.remaining <= 0.01;
                
                return (
                  <div
                    key={pairKey}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                      isSettled
                        ? "bg-gray-100/80 border-gray-200 opacity-60"
                        : "bg-amber-50 border-amber-200"
                    }`}
                  >
                    {/* Left: Checkbox + Transfer Names */}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => onSetPairSettled(t.fromId, t.toId, !isSettled)}
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                          isSettled
                            ? "border-[#4a7c59] bg-[#4a7c59] text-white"
                            : "border-amber-400 bg-white hover:border-amber-500"
                        }`}
                      >
                        {isSettled && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="2,6 5,9 10,3" />
                          </svg>
                        )}
                      </button>

                      <span className={`font-medium text-sm ${isSettled ? "line-through text-gray-400" : "text-amber-950"}`}>
                        <strong>{t.from}</strong> 👉 โอนให้ 👉 <strong>{t.to}</strong>
                      </span>
                    </div>

                    {/* Right: Transfer Amount */}
                    <span className={`font-bold text-sm ${isSettled ? "line-through text-gray-400" : "text-amber-900"}`}>
                      {isSettled ? (<><span className="mr-2 inline-block text-[10px] font-semibold text-emerald-700">เคลียร์ครบแล้ว</span>฿0.00</>) : <>฿{t.remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}</>}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Expense Breakdown List */}
        <div className="bg-white rounded-2xl p-5 border shadow-sm mt-6">
          <div className="mb-4 space-y-3">
            <h4 className="font-semibold text-gray-800 text-sm">📋 รายการค่าใช้จ่ายทั้งหมด ({visibleExpenses.length} รายการ)</h4>
            
            {/* Member Filter Bar */}
            <div className="flex overflow-x-auto pb-2 scrollbar-hide gap-2 items-center">
              <button
                type="button"
                onClick={() => setSelectedMemberFilter("all")}
                className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold font-mono border-2 transition-all ${
                  selectedMemberFilter === "all"
                    ? "bg-[#4a7c59] border-[#4a7c59] text-white"
                    : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                }`}
              >
                ทั้งหมด (All)
              </button>
              
              {trip.participants.map((p) => {
                const isActive = selectedMemberFilter === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedMemberFilter(p.id)}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold font-mono border-2 transition-all ${
                      isActive
                        ? "bg-[#4a7c59] border-[#4a7c59] text-white"
                        : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <Avatar name={p.name} colorClass={p.color} size="xs" tooltip={false} />
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
          {selectedMemberFilter !== "all" && visibleExpenses.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-4 bg-white rounded-xl border border-dashed border-gray-300">
              ไม่มีรายการที่ต้องชำระ (คุณเป็นผู้สำรองจ่าย/ไม่มีหนี้ค้าง)
            </p>
          )}
          <div className="space-y-4">
            {Object.entries(groupedExpenses).map(([dateKey, groupExpenses]) => {
              const isExpanded = Boolean(expandedDates[dateKey]);
              let dailyNetImpact = 0;
              let dailyTotalTHB = 0;

              // Pre-calculate daily summaries
              const enhancedGroup = (groupExpenses as any[]).map((expense: any) => {
                const payerId = String(expense.paid_by || expense.paidById || expense.payer_id || '').trim();
                const payer = trip.participants.find(m => String(m.id).trim() === payerId)?.name || 'Unknown';
                const thbAmt = convertToTHB(expense, tripRates);
                const isForeign = expense.currency && expense.currency !== 'THB';
                const splits = expense.split_members || expense.splits || [];
                const splitCount = Array.isArray(splits) ? splits.length : 1;
                const isSettled = selectedMemberFilter !== "all"
                  ? isParticipantSettled(expense, selectedMemberFilter)
                  : Boolean(expense.is_settled || expense.isSettled);

                let myShareInTHB = 0;
                let netImpact = 0;

                if (viewerId) {
                  const currentId = viewerId;
                  myShareInTHB = getParticipantShareTHB(expense, currentId, tripRates);

                  const isPayer = payerId === currentId;
                  if (isPayer) {
                    netImpact = +(thbAmt - myShareInTHB);
                  } else {
                    netImpact = -(myShareInTHB);
                  }
                }

                if (!isSettled) {
                  dailyNetImpact += netImpact;
                  dailyTotalTHB += thbAmt;
                }

                const isCustomSplit = expense.split_type === 'custom' || expense.splitType === 'custom' || expense.splitType === 'CUSTOM' ||
                  (Array.isArray(splits) && splits.some((s: any) => typeof s === 'object' && s !== null && (s.amount !== undefined || s.share !== undefined)));
                return { ...expense, payer, thbAmt, isForeign, splitCount, isSettled, netImpact, isCustomSplit };
              });

              return (
                <div key={dateKey} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div 
                    onClick={() => toggleDateGroup(dateKey)}
                    className="flex justify-between items-center p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-800 text-sm">{dateKey}</span>
                      <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-md border border-gray-200">
                        {groupExpenses.length} รายการ
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {selectedMemberFilter !== "all" && viewerId && Math.abs(dailyNetImpact) > 0.01 ? (
                        <span className={`text-xs font-bold ${dailyNetImpact > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {dailyNetImpact > 0 ? '+' : '-'}฿{Math.abs(dailyNetImpact).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-gray-500">
                          รวม ฿{dailyTotalTHB.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                      <span className="text-gray-400 text-xs">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-3 bg-white space-y-2 border-t border-gray-100">
                      {enhancedGroup.map((expense: any) => (
                        <div key={expense.id} className={`bg-gray-50 rounded-xl border border-gray-100 overflow-hidden transition-colors ${expense.isSettled ? 'opacity-50' : 'hover:bg-gray-100'}`}>
                          <div className="flex items-center p-3 gap-3">
                            {selectedMemberFilter !== "all" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (selectedMemberFilter !== "all") {
                                  onToggleParticipantSettle(expense.id, selectedMemberFilter);
                                } else {
                                  onToggleExpenseSettle(expense.id, expense.isSettled);
                                }
                              }}
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                                expense.isSettled
                                  ? 'border-[#4a7c59] bg-[#4a7c59] text-[#fdfbf7]'
                                  : 'border-gray-300 bg-white hover:border-gray-400'
                              }`}
                            >
                              {expense.isSettled && <span className="text-[10px] font-bold">✓</span>}
                            </button>
                            )}

                            <div className="flex flex-col flex-1 min-w-0">
                              <span className={`font-semibold text-sm ${expense.isSettled ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                                {expense.title || expense.description || 'Expense'}
                              </span>
                              <span className={`text-xs truncate ${expense.isSettled ? 'text-gray-400 line-through' : 'text-gray-500 dark:text-gray-400'}`}>
                                จ่ายโดย {expense.payer} • หาร {expense.splitCount} คน • รวม ฿{expense.thbAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                {expense.isForeign && ` (${Number(expense.foreign_amount || expense.amount || 0).toLocaleString('en-US')} ${expense.currency} @ ${Number(getExpenseExchangeRate(expense, tripRates).toFixed(6)).toString()})`}
                              </span>
                            </div>
                            <div className="flex flex-col items-end">
                              {selectedMemberFilter === "all" ? null : expense.netImpact > 0.01 ? (
                                <span className={`font-bold ${expense.isSettled ? 'text-gray-400 line-through' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                  +฿{expense.netImpact.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </span>
                              ) : expense.netImpact < -0.01 ? (
                                <span className={`font-bold ${expense.isSettled ? 'text-gray-400 line-through' : 'text-rose-600 dark:text-rose-400'}`}>
                                  -฿{Math.abs(expense.netImpact).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </span>
                              ) : (
                                <span className={`font-medium ${expense.isSettled ? 'text-gray-400 line-through' : 'text-gray-400'}`}>
                                  ฿0.00
                                </span>
                              )}
                            </div>
                          </div>
                          {selectedMemberFilter === "all" && Array.isArray(expense.split_members || expense.splits) && (
                            <div className="flex flex-wrap gap-1.5 px-3 pb-2.5 pl-11">
                              {(expense.split_members || expense.splits).map((s: any) => {
                                const pid = String(s?.participantId || s?.id || s).trim();
                                const pn = trip.participants.find(m => String(m.id).trim() === pid)?.name || pid;
                                return (
                                  <span key={pid} className="text-[10px] text-gray-500 bg-white border border-gray-200 rounded-md px-1.5 py-0.5">
                                    {pn}: ฿{getParticipantShareTHB(expense, pid, tripRates).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
