import { Expense, Participant } from "@/types/trip";

export interface SettlementTransfer {
  from: string;
  to: string;
  amount: number;
}

export interface SettlementResult {
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
  if (!e) return false;
  const splits = e.split_members || e.splits || [];
  if (!Array.isArray(splits) || splits.length === 0) return false;
  
  // Strict Filtering of Personal Expenses:
  // Exclude any expense where splits only contain 1 member AND that member is the payer (paid_by).
  const payerId = String(e.paid_by || e.paidById || e.payer_id || '').trim();
  if (splits.length === 1) {
    const singleId = String(splits[0]?.participantId || splits[0]?.id || splits[0] || '').trim();
    if (singleId === payerId) {
      return false; // It's a personal/solo expense
    }
  }
  return true; // Contains at least one other participant or multiple participants
};

export const calculateSettlement = (
  expenses: (Expense | any)[],
  members: Participant[]
): SettlementResult => {
  const validExpenses = (expenses || []).filter(isSharedExpense);

  // Direct Pairwise Debt Matrix:
  // debtMatrix[debtorId][creditorId] = sum of money debtor owes to creditor
  const debtMatrix: Record<string, Record<string, number>> = {};
  members.forEach(m => {
    debtMatrix[m.id] = {};
    members.forEach(m2 => {
      debtMatrix[m.id][m2.id] = 0;
    });
  });

  for (const expense of validExpenses) {
    if (expense.is_settled || expense.isSettled) continue;

    const creditorId = String(expense.paid_by || expense.paidById || expense.payer_id || '').trim();
    if (!debtMatrix[creditorId]) continue; // Safety check in case payer is not in members array

    const splits = Array.isArray(expense.split_members) ? expense.split_members : (Array.isArray(expense.splits) ? expense.splits : []);
    if (splits.length === 0) continue;

    for (const split of splits) {
      const debtorId = String(split?.participantId || split?.id || split || '').trim();
      if (!debtMatrix[debtorId]) continue; // Safety check if member was removed but expense persists

      if (debtorId !== creditorId) {
        let debtorShare = 0;
        const rate = (expense.currency !== 'THB' && expense.currency) 
          ? (Number(expense.custom_exchange_rate) || Number(expense.exchange_rate) || 0.209096) 
          : 1;

        if (typeof split === 'object' && split.amount !== undefined) {
          debtorShare = Number(split.amount) * rate;
        } else {
          debtorShare = convertToTHB(expense) / splits.length;
        }

        debtMatrix[debtorId][creditorId] += debtorShare;
      }
    }
  }

  const transfers: SettlementTransfer[] = [];

  // Bilateral Debt Netting:
  // Process unique pairs to avoid double counting
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const A = members[i];
      const B = members[j];

      const owesB = debtMatrix[A.id][B.id];
      const owesA = debtMatrix[B.id][A.id];
      const net = owesB - owesA; // net > 0 means A owes B

      if (net > 0.01) {
        transfers.push({
          from: A.name,
          to: B.name,
          amount: Math.round(net * 100) / 100
        });
      } else if (net < -0.01) {
        transfers.push({
          from: B.name,
          to: A.name,
          amount: Math.round(Math.abs(net) * 100) / 100
        });
      }
    }
  }

  return { transfers };
};
