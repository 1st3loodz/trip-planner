import React from "react";
import { Trip } from "@/types/trip";
import { SettlementBalance, convertToTHB, isSharedExpense } from "@/utils/settlement";

interface MemberExpenseDetailModalProps {
  member: SettlementBalance;
  trip: Trip;
  onToggleSettle: (expenseId: string, participantId: string, currentStatus: boolean) => void;
  onClose: () => void;
}

export default function MemberExpenseDetailModal({
  member,
  trip,
  onToggleSettle,
  onClose,
}: MemberExpenseDetailModalProps) {
  const mId = member.id;

  // Paid Out-of-Pocket
  const paidExpenses = (trip.expenses || [])
    .filter(isSharedExpense)
    .filter((e: any) => String(e.paid_by || e.paidById || e.payer_id || '').trim() === mId);

  // Consumed Share
  const sharedExpenses = (trip.expenses || [])
    .filter(isSharedExpense)
    .map((e: any) => {
      const splits = Array.isArray(e.split_members) ? e.split_members : (Array.isArray(e.splits) ? e.splits : []);
      const mySplit = splits.find((s: any) => String(s?.participantId || s?.id || s).trim() === mId);
      if (!mySplit) return null;

      let shareAmt = 0;
      if (typeof mySplit === 'object' && mySplit.amount !== undefined) {
        const rate = (e.currency !== 'THB' && e.currency) 
          ? (Number(e.custom_exchange_rate) || Number(e.exchange_rate) || 0.209096) 
          : 1;
        shareAmt = Number(mySplit.amount) * rate;
      } else {
        shareAmt = convertToTHB(e) / (splits.length || 1);
      }
      return { expense: e, shareAmt };
    }).filter(Boolean) as { expense: any; shareAmt: number }[];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4 pb-3 border-b">
          <div>
            <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
              <span>{member.name}</span>
            </h3>
            <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded font-semibold ${
              member.net > 0.01 
                ? 'bg-emerald-100 text-emerald-700' 
                : member.net < -0.01 
                ? 'bg-rose-100 text-rose-700' 
                : 'bg-gray-100 text-gray-700'
            }`}>
              {member.net > 0.01 && `ยอดรับคืน: +฿${member.net.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
              {member.net < -0.01 && `ยอดค้างจ่าย: -฿${Math.abs(member.net).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
              {Math.abs(member.net) <= 0.01 && 'ยอดสุทธิลงตัว: ฿0.00'}
            </span>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl p-1 h-8 w-8 flex items-center justify-center bg-gray-100 rounded-full"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* Section A: Paid Out-of-Pocket */}
          <div>
            <h4 className="font-semibold text-blue-800 text-sm mb-2 flex items-center gap-2">
              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">A</span> 
              รายการที่จ่ายออกไป (Paid Out-of-Pocket)
            </h4>
            {paidExpenses.length === 0 ? (
              <p className="text-xs text-gray-400 italic px-2">ไม่มีรายการที่สำรองจ่าย</p>
            ) : (
              <div className="space-y-2">
                {paidExpenses.map((e: any) => (
                  <div key={e.id} className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                    <div>
                      <p className="text-gray-800 font-medium">{e.title || e.description || 'Expense'}</p>
                      <p className="text-[10px] text-gray-500">{new Date(e.date || e.created_at || Date.now()).toLocaleDateString('en-GB')}</p>
                    </div>
                    <span className="font-semibold text-blue-700">฿{convertToTHB(e).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2 text-right text-xs text-gray-500 font-medium">
              รวมยอดสำรองจ่าย: <strong className="text-blue-700 text-sm">฿{member.paid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
            </div>
          </div>

          {/* Section B: Consumed Share */}
          <div>
            <h4 className="font-semibold text-rose-800 text-sm mb-2 flex items-center gap-2">
              <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-xs font-bold">B</span> 
              รายการที่ร่วมหาร (Consumed Share)
            </h4>
            {sharedExpenses.length === 0 ? (
              <p className="text-xs text-gray-400 italic px-2">ไม่มีรายการที่ต้องหาร</p>
            ) : (
              <div className="space-y-2">
                {sharedExpenses.map(({ expense, shareAmt }: { expense: any; shareAmt: number }) => {
                  const split = (expense.split_members || expense.splits).find((s: any) => String(s?.participantId || s?.id || s).trim() === mId);
                  const isSettled = split?.isSettled || false;
                  
                  return (
                  <div key={expense.id} className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                    <div>
                      <p className={`font-medium ${isSettled ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{expense.title || expense.description || 'Expense'}</p>
                      <p className="text-[10px] text-gray-500">ยอดบิลเต็ม: ฿{convertToTHB(expense).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`font-semibold ${isSettled ? 'text-gray-400 line-through' : 'text-rose-600'}`}>฿{shareAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleSettle(expense.id, mId, isSettled);
                        }}
                        className={`flex h-5 w-5 items-center justify-center border-2 rounded-md transition-all ${
                          isSettled
                            ? "border-[#4a7c59] bg-[#4a7c59] text-[#fdfbf7]"
                            : "border-gray-300 bg-white hover:border-gray-400"
                        }`}
                      >
                        {isSettled && (
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="2,6 5,9 10,3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
            <div className="mt-2 text-right text-xs text-gray-500 font-medium">
              รวมยอดที่ต้องรับผิดชอบ: <strong className="text-rose-600 text-sm">฿{member.share.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
            </div>
          </div>

          {/* Summary Footer */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mt-4">
            <p className="text-xs text-center text-gray-500 mb-1">สรุปการคำนวณยอดสุทธิ (A - B)</p>
            <p className="text-center font-mono text-sm font-semibold text-gray-800 flex items-center justify-center flex-wrap gap-2">
              <span>ยอดจ่าย <span className="text-blue-600">฿{member.paid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></span>
              <span className="text-gray-400">-</span>
              <span>ยอดหาร <span className="text-rose-600">฿{member.share.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></span>
              <span className="text-gray-400">=</span>
              <span className={member.net > 0.01 ? 'text-emerald-600' : member.net < -0.01 ? 'text-rose-600' : 'text-gray-900'}>
                ฿{member.net.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
