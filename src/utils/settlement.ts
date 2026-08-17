import { Expense, Participant } from "@/types/trip";

export interface SettlementBalance {
  id: string;
  name: string;
  paid: number;
  share: number;
  net: number;
}

export interface SettlementTransfer {
  from: string;
  to: string;
  amount: number;
}

export interface SettlementResult {
  balances: SettlementBalance[];
  debtors: (SettlementBalance & { remaining: number })[];
  creditors: (SettlementBalance & { remaining: number })[];
  transfers: SettlementTransfer[];
}

export const convertToTHB = (e: Expense | any): number => {
  if (!e) return 0;
  if (e.currency === 'THB' || !e.currency) return Number(e.amount) || 0;
  const rate = Number(e.custom_exchange_rate) > 0 
    ? Number(e.custom_exchange_rate) 
    : (Number(e.exchange_rate) > 0 && Number(e.exchange_rate) !== 1 ? Number(e.exchange_rate) : 0.209096);
  const foreign = Number(e.foreign_amount) > 0 ? Number(e.foreign_amount) : (Number(e.amount) || 0);
  return foreign * rate;
};

export const isSharedExpense = (e: Expense | any): boolean => {
  if (!e || !Array.isArray(e.split_members) || e.split_members.length === 0) {
    if (!Array.isArray(e.splits) || e.splits.length === 0) return false;
  }
  const payerId = String(e.paid_by || e.paidById || e.payer_id || '').trim();
  const splits = e.split_members || e.splits || [];
  if (splits.length > 1) return true;
  const singleId = String(splits[0]?.participantId || splits[0]?.id || splits[0] || '').trim();
  return singleId !== payerId;
};

export const calculateSettlement = (
  expenses: (Expense | any)[],
  members: Participant[]
): SettlementResult => {
  const validExpenses = (expenses || []).filter(isSharedExpense);

  // Balance Computation
  const balances: SettlementBalance[] = (members || []).map((m) => {
    const mId = String(m.id).trim();

    // A. Only sum shared expenses paid by this member
    const totalPaid = validExpenses
      .filter((e) => String(e.paid_by || e.paidById || e.payer_id || '').trim() === mId)
      .reduce((sum, e) => sum + convertToTHB(e), 0);

    // B. Only sum shared expenses consumed by this member
    const totalShare = validExpenses.reduce((sum, e) => {
      const splits = Array.isArray(e.split_members) ? e.split_members : (Array.isArray(e.splits) ? e.splits : []);
      const mySplit = splits.find((s: any) => String(s?.participantId || s?.id || s).trim() === mId);
      if (!mySplit) return sum;

      const rate = (e.currency !== 'THB' && e.currency) 
        ? (Number(e.custom_exchange_rate) || Number(e.exchange_rate) || 0.209096) 
        : 1;

      if (typeof mySplit === 'object' && mySplit.amount !== undefined) {
        return sum + (Number(mySplit.amount) * rate);
      }
      return sum + (convertToTHB(e) / (splits.length || 1));
    }, 0);

    const net = Math.round((totalPaid - totalShare) * 100) / 100;

    return {
      id: mId,
      name: m.name,
      paid: Math.round(totalPaid * 100) / 100,
      share: Math.round(totalShare * 100) / 100,
      net: net,
    };
  });

  // Transfers (Debtor -> Creditor)
  let debtors = balances.filter((b) => b.net < -0.01).map((b) => ({ ...b, remaining: Math.abs(b.net) }));
  let creditors = balances.filter((b) => b.net > 0.01).map((b) => ({ ...b, remaining: b.net }));
  const transfers: SettlementTransfer[] = [];

  for (const d of debtors) {
    for (const c of creditors) {
      if (d.remaining <= 0.01 || c.remaining <= 0.01) continue;
      const settleAmt = Math.min(d.remaining, c.remaining);
      d.remaining -= settleAmt;
      c.remaining -= settleAmt;
      transfers.push({
        from: d.name,
        to: c.name,
        amount: Math.round(settleAmt * 100) / 100,
      });
    }
  }

  return { balances, debtors, creditors, transfers };
};
