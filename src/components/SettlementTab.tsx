import React from "react";
import { Trip } from "@/types/trip";
import { calculateSettlement, convertToTHB, isSharedExpense } from "@/utils/settlement";

interface SettlementTabProps {
  trip: Trip;
  currentUserId?: string | null;
  onToggleExpenseSettle: (expenseId: string, currentStatus: boolean) => void;
}

export default function SettlementTab({ trip, currentUserId, onToggleExpenseSettle }: SettlementTabProps) {
  const { transfers } = calculateSettlement(trip.expenses, trip.participants);
  
  const validExpenses = trip.expenses.filter(isSharedExpense);

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
          <div className="space-y-2">
            {validExpenses.map((expense: any) => {
              const payerId = String(expense.paid_by || expense.paidById || expense.payer_id || '').trim();
              const payer = trip.participants.find(m => String(m.id).trim() === payerId)?.name || 'Unknown';
              const thbAmt = convertToTHB(expense);
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
                    const rate = (expense.currency !== 'THB' && expense.currency) 
                      ? (Number(expense.custom_exchange_rate) || Number(expense.exchange_rate) || 0.209096) 
                      : 1;
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

              return (
                <div key={expense.id} className={`bg-gray-50 rounded-xl border border-gray-100 overflow-hidden transition-colors ${isSettled ? 'opacity-50' : 'hover:bg-gray-100'}`}>
                  <div className="flex items-center p-3 gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleExpenseSettle(expense.id, isSettled);
                      }}
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                        isSettled
                          ? 'border-[#4a7c59] bg-[#4a7c59] text-[#fdfbf7]'
                          : 'border-gray-300 bg-white hover:border-gray-400'
                      }`}
                    >
                      {isSettled && <span className="text-[10px] font-bold">✓</span>}
                    </button>

                    <div className="flex flex-col flex-1 min-w-0">
                      <span className={`font-semibold text-sm ${isSettled ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                        {expense.title || expense.description || 'Expense'}
                      </span>
                      <span className={`text-xs truncate ${isSettled ? 'text-gray-400 line-through' : 'text-gray-500 dark:text-gray-400'}`}>
                        จ่ายโดย {payer} • หาร {splitCount} คน • รวม ฿{thbAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        {isForeign && ` (${Number(expense.foreign_amount || expense.amount || 0).toLocaleString('en-US')} ${expense.currency} @ ${Number(expense.custom_exchange_rate || expense.exchange_rate || 1)})`}
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      {netImpact > 0.01 ? (
                        <span className={`font-bold ${isSettled ? 'text-gray-400 line-through' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          +฿{netImpact.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      ) : netImpact < -0.01 ? (
                        <span className={`font-bold ${isSettled ? 'text-gray-400 line-through' : 'text-rose-600 dark:text-rose-400'}`}>
                          -฿{Math.abs(netImpact).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className={`font-medium ${isSettled ? 'text-gray-400 line-through' : 'text-gray-400'}`}>
                          ฿0.00
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
