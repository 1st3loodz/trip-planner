import React, { useState } from "react";
import { Trip } from "@/types/trip";
import { calculateSettlement, convertToTHB, SettlementBalance } from "@/utils/settlement";
import MemberExpenseDetailModal from "./MemberExpenseDetailModal";

interface SettlementTabProps {
  trip: Trip;
  onToggleSettle: (expenseId: string, participantId: string, currentStatus: boolean) => void;
}

export default function SettlementTab({ trip, onToggleSettle }: SettlementTabProps) {
  const [inspectedMember, setInspectedMember] = useState<SettlementBalance | null>(null);

  const { balances, debtors, creditors, transfers } = calculateSettlement(trip.expenses, trip.participants);
  const validExpenses = trip.expenses.filter((e: any) => {
    if (!e || (!e.split_members && !e.splits)) return false;
    const splits = e.split_members || e.splits || [];
    if (splits.length > 1) return true;
    const payerId = String(e.paid_by || e.paidById || e.payer_id || '').trim();
    const singleId = String(splits[0]?.participantId || splits[0]?.id || splits[0] || '').trim();
    return singleId !== payerId;
  });

  return (
    <div className="space-y-6 pb-20">
      <div className="space-y-4">
        {/* Transfer Plan */}
        <div className="bg-white rounded-2xl p-5 border shadow-sm">
          <h4 className="font-semibold text-gray-800 text-sm mb-3">💸 แผนการโอนเงิน (Transfer Plan)</h4>
          {transfers.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-3">ยอดเคลียร์ครบถ้วนแล้ว 🎉</p>
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

        {/* Member Balances (Debtors Only) */}
        <div className="grid grid-cols-1 gap-3">
          {debtors.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-3 bg-white rounded-xl border border-dashed border-gray-300">ทุกคนเคลียร์ยอดครบถ้วนแล้ว ไม่มีหนี้ค้างชำระ 🎉</p>
          ) : (
            debtors.map((b) => (
              <div 
                key={b.id} 
                onClick={() => setInspectedMember(b)}
                className="bg-white rounded-2xl p-4 border shadow-sm cursor-pointer hover:border-blue-400 hover:shadow-md transition-all"
              >
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold text-gray-900">{b.name}</span>
                  <span className="text-xs px-3 py-1 rounded-full font-semibold bg-rose-50 text-rose-600 border border-rose-200">
                    ต้องจ่ายเงิน: ฿{Math.abs(b.net).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5 mb-2">
                  <div className="flex justify-between text-slate-600">
                    <span>+ ยอดสำรองจ่ายไป (Paid):</span>
                    <span className="font-semibold text-emerald-600">+฿{b.paid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>- ยอดส่วนตัวที่ร่วมหาร (Share):</span>
                    <span className="font-semibold text-rose-600">-฿{b.share.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between pt-1.5 border-t border-slate-200 font-bold text-gray-900">
                    <span>= ยอดสุทธิที่ต้องโอนชำระ (Net):</span>
                    <span className="text-rose-600">-฿{Math.abs(b.net).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="flex justify-end text-xs">
                  <span className="text-blue-500 font-medium hover:text-blue-700 flex items-center gap-1">
                    🔍 ดูประวัติ
                  </span>
                </div>
              </div>
            ))
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
                  
                  {/* Expanded Splits View */}
                  <div className="border-t border-gray-100 bg-white p-3 space-y-2">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Split Breakdown</h4>
                    {splits.map((split: any, idx: number) => {
                      const memberId = String(split.participantId || split.id || split).trim();
                      const memberName = trip.participants.find(m => String(m.id).trim() === memberId)?.name || 'Member';
                      
                      let amt = 0;
                      if (typeof split === 'object' && split.amount !== undefined) {
                        const rate = (expense.currency !== 'THB' && expense.currency) 
                          ? (Number(expense.custom_exchange_rate) || Number(expense.exchange_rate) || 0.209096) 
                          : 1;
                        amt = Number(split.amount) * rate;
                      } else {
                        amt = thbAmt / (splits.length || 1);
                      }
                      
                      const isSettled = typeof split === 'object' ? split.isSettled : false;

                      return (
                        <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                          <span className={`text-sm ${isSettled ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{memberName}</span>
                          <div className="flex items-center gap-3">
                            <span className={`text-sm font-semibold ${isSettled ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                              ฿{amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleSettle(expense.id, memberId, isSettled);
                              }}
                              className={`flex px-2 py-1 items-center justify-center border rounded-md transition-all text-xs font-medium ${
                                isSettled
                                  ? "border-[#4a7c59] bg-[#4a7c59] text-[#fdfbf7]"
                                  : "border-gray-300 bg-white hover:border-gray-400 text-gray-700"
                              }`}
                            >
                              {isSettled ? '✅ เคลียร์แล้ว' : '⚪ กดเคลียร์'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {inspectedMember && (
        <MemberExpenseDetailModal
          member={inspectedMember}
          trip={trip}
          onToggleSettle={onToggleSettle}
          onClose={() => setInspectedMember(null)}
        />
      )}
    </div>
  );
}
