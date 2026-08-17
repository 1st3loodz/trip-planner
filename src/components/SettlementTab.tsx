import React from "react";
import { Trip } from "@/types/trip";
import { calculateSettlement, convertToTHB, isSharedExpense } from "@/utils/settlement";

interface SettlementTabProps {
  trip: Trip;
  onToggleSettle: (expenseId: string, participantId: string, currentStatus: boolean) => void;
}

export default function SettlementTab({ trip, onToggleSettle }: SettlementTabProps) {
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
              const payer = trip.participants.find(m => String(m.id).trim() === String(expense.paid_by || expense.paidById || expense.payer_id || '').trim())?.name || 'Unknown';
              const thbAmt = convertToTHB(expense);
              const isForeign = expense.currency && expense.currency !== 'THB';
              const splits = expense.split_members || expense.splits || [];
              const splitCount = Array.isArray(splits) ? splits.length : 1;

              return (
                <div key={expense.id} className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden hover:bg-gray-100 transition-colors">
                  <div className="flex items-center justify-between p-3">
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-800 text-sm">{expense.title || expense.description || 'Expense'}</span>
                      <span className="text-xs text-gray-500">
                        จ่ายโดย {payer} • หาร {splitCount} คน
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-bold text-gray-900">
                        ฿{thbAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      {isForeign && (
                        <span className="text-[10px] text-gray-400">
                          {Number(expense.foreign_amount || expense.foreignAmount || expense.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} {expense.currency}
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
