"use client";

import React, { useMemo } from "react";
import Avatar from "@/components/Avatar";

interface SettlementV2Props {
  members: { id: string; name: string; avatar_url?: string; color?: string }[];
  expenses: any[];
}

const toTHB = (e: any): number => {
  if (!e) return 0;
  if (e.currency === 'THB' || !e.currency) return Number(e.amount) || 0;
  
  const customRate = Number(e.custom_exchange_rate) || Number(e.customExchangeRate) || 0;
  const standardRate = Number(e.exchange_rate) || Number(e.exchangeRate) || 0;
  
  const rate = customRate > 0 
    ? customRate 
    : (standardRate > 0 && standardRate !== 1 ? standardRate : (e.currency === 'JPY' ? 0.209096 : 1));
    
  const foreignAmt = Number(e.foreign_amount) || Number(e.foreignAmount) || 0;
  const raw = foreignAmt > 0 ? foreignAmt : (Number(e.amount) || 0);
  
  return raw * rate;
};

export default function SettlementV2({ members, expenses }: SettlementV2Props) {
  // 1. Calculate Balances
  const balances = useMemo(() => {
    return (members || []).map((m) => {
      const mId = String(m.id).trim();

      // Total Paid
      const totalPaid = (expenses || [])
        .filter((e) => String(e.paid_by || e.paidById || e.payer_id || '').trim() === mId)
        .reduce((sum, e) => sum + toTHB(e), 0);

      // Total Share
      const totalShare = (expenses || []).reduce((sum, e) => {
        const splits = Array.isArray(e.split_members) ? e.split_members : (Array.isArray(e.splits) ? e.splits : []);
        const mySplit = splits.find((s: any) => String(s?.participantId || s?.id || s).trim() === mId);
        if (!mySplit) return sum;

        if (typeof mySplit === 'object' && mySplit.amount !== undefined) {
          // If the split has an exact amount, convert that split amount to THB
          const splitAmt = Number(mySplit.amount) || 0;
          
          const customRate = Number(e.custom_exchange_rate) || Number(e.customExchangeRate) || 0;
          const standardRate = Number(e.exchange_rate) || Number(e.exchangeRate) || 0;
          const rate = customRate > 0 
            ? customRate 
            : (standardRate > 0 && standardRate !== 1 ? standardRate : (e.currency === 'JPY' ? 0.209096 : 1));
            
          return sum + (e.currency === 'THB' || !e.currency ? splitAmt : splitAmt * rate);
        }
        
        return sum + (toTHB(e) / (splits.length || 1));
      }, 0);

      const net = Math.round((totalPaid - totalShare) * 100) / 100;

      return {
        id: mId,
        name: m.name,
        color: m.color,
        paid: Math.round(totalPaid * 100) / 100,
        share: Math.round(totalShare * 100) / 100,
        net: net,
      };
    }).sort((a, b) => b.net - a.net);
  }, [members, expenses]);

  // 2. Compute Greedy Settlements
  const settlements = useMemo(() => {
    const debtors = balances.filter((b) => b.net < -0.01).map(b => ({ ...b }));
    const creditors = balances.filter((b) => b.net > 0.01).map(b => ({ ...b }));

    debtors.sort((a, b) => a.net - b.net); // Most negative first
    creditors.sort((a, b) => b.net - a.net); // Most positive first

    const results: { from: any; to: any; amount: number }[] = [];

    let d = 0;
    let c = 0;

    while (d < debtors.length && c < creditors.length) {
      const debtor = debtors[d];
      const creditor = creditors[c];

      const debt = Math.abs(debtor.net);
      const credit = creditor.net;

      const settledAmount = Math.min(debt, credit);
      if (settledAmount > 0.01) {
        results.push({
          from: debtor,
          to: creditor,
          amount: Math.round(settledAmount * 100) / 100,
        });
      }

      debtor.net += settledAmount;
      creditor.net -= settledAmount;

      if (Math.abs(debtor.net) < 0.01) d++;
      if (creditor.net < 0.01) c++;
    }

    return results;
  }, [balances]);

  return (
    <div className="space-y-8 mt-6">
      {/* Balances Section */}
      <div>
        <h3 className="mb-4 font-pixel text-[10px] uppercase tracking-widest text-stone-800 dark:text-[#fdfbf7]">Member Balances</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {balances.map((b) => {
            const isCreditor = b.net > 0.01;
            const isDebtor = b.net < -0.01;

            return (
              <div key={b.id} className="bg-[#fdfbf7] border-2 border-stone-800 dark:border-[#54463d] dark:bg-[#28211d] p-4 shadow-[4px_4px_0_#292524] dark:shadow-[4px_4px_0_#1e1815] flex flex-col gap-2 transition-all">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <Avatar name={b.name} colorClass={b.color || "bg-stone-500 text-white"} size="sm" tooltip={false} />
                    <span className="font-mono font-bold text-stone-900 dark:text-[#fdfbf7]">{b.name}</span>
                  </div>
                  <span
                    className={`text-[9px] px-2.5 py-1 font-bold font-pixel uppercase tracking-wider border-2 ${
                      isCreditor
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-600'
                        : isDebtor
                        ? 'bg-rose-100 text-rose-800 border-rose-800 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-600'
                        : 'bg-[#f5eed7] text-stone-600 border-stone-400 dark:bg-[#362d28] dark:text-stone-400 dark:border-[#54463d]'
                    }`}
                  >
                    {isCreditor && `Gets: ฿${b.net.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                    {isDebtor && `Pays: ฿${Math.abs(b.net).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                    {!isCreditor && !isDebtor && 'Settled'}
                  </span>
                </div>

                <div className="flex justify-between font-mono text-xs text-stone-600 dark:text-stone-400 pt-3 border-t-2 border-stone-300 dark:border-stone-700">
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase tracking-wider mb-0.5 text-stone-500">Total Paid</span>
                    <strong className="text-stone-800 dark:text-stone-200">฿{b.paid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[9px] uppercase tracking-wider mb-0.5 text-stone-500">Total Share</span>
                    <strong className="text-stone-800 dark:text-stone-200">฿{b.share.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Settlements Section */}
      <div>
        <h3 className="mb-4 font-pixel text-[10px] uppercase tracking-widest text-stone-800 dark:text-[#fdfbf7]">Action Plan</h3>
        {settlements.length === 0 ? (
          <div className="border-2 border-dashed border-stone-400 bg-stone-100 px-5 py-8 text-center dark:border-[#54463d] dark:bg-[#362d28]">
            <div className="mb-2 text-4xl">✨</div>
            <p className="font-pixel text-[10px] uppercase tracking-wider text-stone-800 dark:text-[#fdfbf7]">All settled up!</p>
            <p className="mt-1 font-mono text-xs text-stone-600 dark:text-[#f5ebd5]">Nobody owes anything.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {settlements.map((s, idx) => (
              <div key={idx} className="flex flex-wrap items-center justify-between gap-4 border-2 border-stone-800 bg-[#fdfbf7] p-4 dark:border-[#54463d] dark:bg-[#28211d] shadow-[2px_2px_0_#292524] dark:shadow-[2px_2px_0_#1e1815]">
                <div className="flex items-center gap-3">
                  <Avatar name={s.from.name} colorClass={s.from.color || "bg-rose-500 text-white"} size="sm" tooltip={false} />
                  <span className="font-mono text-sm font-bold text-stone-800 dark:text-[#fdfbf7]">{s.from.name}</span>
                </div>
                
                <div className="flex flex-col items-center">
                  <span className="font-mono text-base font-black text-[#4a7c59] dark:text-[#4a7c59] mb-1">
                    ฿{s.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                  <div className="flex items-center text-stone-400 dark:text-stone-600">
                    <div className="h-0.5 w-8 bg-stone-300 dark:bg-stone-600"></div>
                    <span className="mx-1 text-[8px]">▶</span>
                  </div>
                  <span className="font-pixel text-[7px] uppercase tracking-wider text-stone-500 mt-1">Pays to</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold text-stone-800 dark:text-[#fdfbf7]">{s.to.name}</span>
                  <Avatar name={s.to.name} colorClass={s.to.color || "bg-emerald-500 text-white"} size="sm" tooltip={false} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
