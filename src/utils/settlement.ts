import { Expense, Participant } from "@/types/trip";

export interface SettlementTransfer {
  from: string;
  to: string;
  amount: number;
}

export interface SettlementResult {
  transfers: SettlementTransfer[];
}

export const getExpenseExchangeRate = (
  expense: any, 
  tripRates?: Record<string, number> | null
): number => {
  const currency = String(expense.currency || 'THB').toUpperCase();
  if (currency === 'THB') return 1;

  // 1. Explicit custom rate saved on this specific expense
  const customRate = Number(expense.custom_exchange_rate || expense.customExchangeRate);
  if (customRate > 0) return customRate;

  // 2. Explicit stored rate on the expense (ignore 1 for foreign currencies)
  const storedRate = Number(expense.exchange_rate || expense.exchangeRate || expense.rate || expense.historicalRate);
  if (storedRate > 0 && storedRate !== 1) return storedRate;

  // 3. Trip-level or Currency Context exchange rate for this currency
  if (tripRates && Number(tripRates[currency]) > 0 && Number(tripRates[currency]) !== 1) {
    return Number(tripRates[currency]);
  }

  // 4. Inferred rate from amounts if foreign_amount and amount both exist and differ
  const foreignAmt = Number(expense.foreign_amount || expense.foreignAmount || 0);
  const thbAmt = Number(expense.amount || 0);
  if (foreignAmt > 0 && thbAmt > 0 && foreignAmt !== thbAmt) {
    return thbAmt / foreignAmt;
  }

  // 5. Default currency-specific fallback to prevent 1:1 disaster
  if (currency === 'JPY') return 0.209096;
  if (currency === 'USD') return 35.5;
  if (currency === 'KRW') return 0.026;
  if (currency === 'EUR') return 38.5;

  return 1;
};

export const convertToTHB = (
  expense: any, 
  tripRates?: Record<string, number> | null
): number => {
  if (!expense) return 0;
  const currency = String(expense.currency || 'THB').toUpperCase();
  if (currency === 'THB') return Number(expense.amount) || 0;

  const rate = getExpenseExchangeRate(expense, tripRates);
  const foreignAmt = Number(expense.foreign_amount || expense.foreignAmount || expense.amount || 0);
  return foreignAmt * rate;
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
  members: Participant[],
  tripRates?: Record<string, number> | null
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
        const rate = getExpenseExchangeRate(expense, tripRates);

        if (typeof split === 'object' && split.amount !== undefined) {
          debtorShare = Number(split.amount) * rate;
        } else {
          debtorShare = convertToTHB(expense, tripRates) / splits.length;
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
