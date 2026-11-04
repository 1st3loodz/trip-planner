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

/**
 * A participant's share of an expense, converted to THB.
 * Respects custom per-member amounts (`amount` or `share`) in split_members;
 * falls back to an equal split only when no custom amount is defined.
 */
export const getParticipantShareTHB = (
  e: any,
  participantId: string,
  tripRates?: Record<string, number> | null
): number => {
  if (!e) return 0;
  const splits = Array.isArray(e.split_members) && e.split_members.length > 0
    ? e.split_members
    : (Array.isArray(e.splits) ? e.splits : []);
  if (splits.length === 0) return 0;

  const mId = String(participantId || '').trim();
  const mySplit = splits.find((s: any) => String(s?.participantId || s?.id || s).trim() === mId);
  if (!mySplit) return 0;

  const rawAmt = typeof mySplit === 'object' && mySplit !== null
    ? (mySplit.amount !== undefined ? mySplit.amount : mySplit.share)
    : undefined;

  if (rawAmt !== undefined && rawAmt !== null && !isNaN(Number(rawAmt))) {
    return Number(rawAmt) * getExpenseExchangeRate(e, tripRates);
  }

  return convertToTHB(e, tripRates) / (splits.length || 1);
};

/**
 * Whether a specific participant has settled their share of an expense.
 * Reads the per-member flag inside split_members (or splits).
 */
export const isParticipantSettled = (expense: any, participantId: string): boolean => {
  if (!expense) return false;
  const splits = Array.isArray(expense.split_members) && expense.split_members.length > 0
    ? expense.split_members
    : (Array.isArray(expense.splits) ? expense.splits : []);
  const mId = String(participantId || '').trim();
  const split = splits.find((s: any) => String(s?.participantId || s?.id || s).trim() === mId);
  if (!split || typeof split !== 'object') return false;
  return Boolean(split.isSettled ?? split.is_settled);
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

      if (debtorId !== creditorId && !isParticipantSettled(expense, debtorId)) {
        const debtorShare = getParticipantShareTHB(expense, debtorId, tripRates);

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

export interface TransferPlanItem extends SettlementTransfer {
  fromId: string;
  toId: string;
  /** Remaining unsettled amount (0 when every item in this direction is settled) */
  remaining: number;
}

const buildDebtMatrix = (
  expenses: any[],
  members: Participant[],
  tripRates: Record<string, number> | null | undefined,
  ignoreSettled: boolean
): Record<string, Record<string, number>> => {
  const matrix: Record<string, Record<string, number>> = {};
  members.forEach(m => {
    matrix[m.id] = {};
    members.forEach(m2 => { matrix[m.id][m2.id] = 0; });
  });
  for (const expense of (expenses || []).filter(isSharedExpense)) {
    if (!ignoreSettled && (expense.is_settled || expense.isSettled)) continue;
    const creditorId = String(expense.paid_by || expense.paidById || expense.payer_id || '').trim();
    if (!matrix[creditorId]) continue;
    const splits = Array.isArray(expense.split_members) ? expense.split_members : (Array.isArray(expense.splits) ? expense.splits : []);
    for (const split of splits) {
      const debtorId = String(split?.participantId || split?.id || split || '').trim();
      if (!matrix[debtorId] || debtorId === creditorId) continue;
      if (!ignoreSettled && isParticipantSettled(expense, debtorId)) continue;
      matrix[debtorId][creditorId] += getParticipantShareTHB(expense, debtorId, tripRates);
    }
  }
  return matrix;
};

/**
 * Transfer plan that stays stable as items get settled: the pair list and `amount`
 * come from ALL items (settled flags ignored), `remaining` from unsettled items only.
 */
export const calculateTransferPlan = (
  expenses: any[],
  members: Participant[],
  tripRates?: Record<string, number> | null
): TransferPlanItem[] => {
  const total = buildDebtMatrix(expenses, members, tripRates, true);
  const open = buildDebtMatrix(expenses, members, tripRates, false);
  const plan: TransferPlanItem[] = [];
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const A = members[i];
      const B = members[j];
      const net = total[A.id][B.id] - total[B.id][A.id];
      if (Math.abs(net) <= 0.01) continue;
      const [from, to] = net > 0 ? [A, B] : [B, A];
      const openNet = open[from.id][to.id] - open[to.id][from.id];
      plan.push({
        from: from.name,
        to: to.name,
        fromId: from.id,
        toId: to.id,
        amount: Math.round(Math.abs(net) * 100) / 100,
        remaining: openNet > 0.01 ? Math.round(openNet * 100) / 100 : 0,
      });
    }
  }
  return plan;
};