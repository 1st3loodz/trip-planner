import React, { useState } from "react";
import { Trip } from "@/types/trip";
import { calculateSettlement, convertToTHB, isSharedExpense, getExpenseExchangeRate } from "@/utils/settlement";

interface SettlementTabProps {
  trip: Trip;
  currentUserId?: string | null;
  onToggleExpenseSettle: (expenseId: string, currentStatus: boolean) => void;
}

export default function SettlementTab({ trip, currentUserId, onToggleExpenseSettle }: SettlementTabProps) {
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  const toggleDateGroup = (dateKey: string) => {
    setExpandedDates(prev => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  const tripRates = (trip as any).exchangeRates || null;
  const { transfers } = calculateSettlement(trip.expenses, trip.participants, tripRates);
  
  const validExpenses = [...trip.expenses].filter(isSharedExpense).sort((a: any, b: any) => {
    const dateA = new Date(a.date || a.expense_date || a.created_at || a.createdAt || 0).getTime();
    const dateB = new Date(b.date || b.expense_date || b.created_at || b.createdAt || 0).getTime();
    return dateA - dateB;
  });

  const groupedExpenses = validExpenses.reduce((acc, expense: any) => {
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
              {transfers.map((t, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-100 text-sm">
                  <span className="font-medium text-amber-950">
                    <strong>{t.from}</strong> 👉 โอนให้ 👉 <strong>{t.to}</strong>
                  </span>
                  <span className="font-bold text-amber-900">
                    ฿{t.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expense Breakdown List */}
        <div className="bg-white rounded-2xl p-5 border shadow-sm mt-6">
          <h4 className="font-semibold text-gray-800 text-sm mb-3">📋 รายการค่าใช้จ่ายทั้งหมด ({validExpenses.length} รายการ)</h4>
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
                const isSettled = expense.is_settled || expense.isSettled || false;

                let myShareInTHB = 0;
                let netImpact = 0;

                if (currentUserId) {
                  const currentId = String(currentUserId).trim();
                  const mySplit = splits.find((s: any) => String(s?.participantId || s?.id || s).trim() === currentId);
                  
                  if (mySplit) {
                    if (typeof mySplit === 'object' && mySplit.amount !== undefined) {
                      const rate = getExpenseExchangeRate(expense, tripRates);
                      myShareInTHB = Number(mySplit.amount) * rate;
                    } else {
                      myShareInTHB = thbAmt / (splits.length || 1);
                    }
                  }

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

                return { ...expense, payer, thbAmt, isForeign, splitCount, isSettled, netImpact };
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
                      {currentUserId && Math.abs(dailyNetImpact) > 0.01 ? (
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
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleExpenseSettle(expense.id, expense.isSettled);
                              }}
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                                expense.isSettled
                                  ? 'border-[#4a7c59] bg-[#4a7c59] text-[#fdfbf7]'
                                  : 'border-gray-300 bg-white hover:border-gray-400'
                              }`}
                            >
                              {expense.isSettled && <span className="text-[10px] font-bold">✓</span>}
                            </button>

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
                              {expense.netImpact > 0.01 ? (
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
