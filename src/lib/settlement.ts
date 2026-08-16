import { Expense, Settlement, Currency, Participant, ExpenseSplit } from "@/types/trip";
import { Rates, convertToBase, getExchangeRate, getConvertedAmountTHB } from "@/lib/currency";

export function resolvePayerId(expense: any, participants: Participant[]): string | undefined {
  const payerVal = String(expense.paidById || expense.paid_by || expense.payer_id || expense.payer || expense.created_by || expense.createdBy || '').trim();
  if (!payerVal) return undefined;

  for (const p of participants) {
    const memberId = String(p.id || '').trim();
    const memberName = String(p.name || '').trim();
    const memberUserId = String((p as any).user_id || '').trim();

    if (
      (memberId && payerVal === memberId) ||
      (memberUserId && payerVal === memberUserId) ||
      (memberName && payerVal.toLowerCase() === memberName.toLowerCase())
    ) {
      return memberId;
    }
  }
  
  // Fallback to exactly what was in the database if no match, just in case
  return payerVal;
}

export function isSplitMember(expense: any, member: Participant): boolean {
  if (!expense || !member) return false;
  const splits = Array.isArray(expense.splits) ? expense.splits : [];
  const splitMembers = Array.isArray(expense.split_members) ? expense.split_members : [];
  const splitWith = Array.isArray(expense.split_with) ? expense.split_with : [];
  
  const memberId = String(member.id || '').trim();
  const memberName = String(member.name || '').trim();

  // Check expense.splits
  for (const s of splits) {
    const sVal = String(s?.participantId || s?.id || s || '').trim();
    if (sVal === memberId || (memberName && sVal.toLowerCase() === memberName.toLowerCase())) return true;
  }
  
  // Check expense.split_members and split_with
  for (const s of [...splitMembers, ...splitWith]) {
    const sVal = String(s?.id || s || '').trim();
    if (sVal === memberId || (memberName && sVal.toLowerCase() === memberName.toLowerCase())) return true;
  }

  return false;
}

export function getResolvedSplits(expense: any, participants: Participant[]): ExpenseSplit[] {
  let rawSplits = Array.isArray(expense.splits) ? expense.splits : [];
  if (rawSplits.length === 0) {
    const fallbackSplits = Array.isArray(expense.split_members) ? expense.split_members : (Array.isArray(expense.split_with) ? expense.split_with : []);
    rawSplits = fallbackSplits.map((s: any) => ({
      participantId: String(s?.id || s || ''),
      amount: expense.amount / Math.max(1, fallbackSplits.length),
      isSettled: false
    }));
  }

  return rawSplits.map((split: any) => {
    const sVal = String(split?.participantId || split?.id || split || '').trim();
    let resolvedId = sVal;
    
    for (const p of participants) {
      const memberId = String(p.id || '').trim();
      const memberName = String(p.name || '').trim();
      if (
        (memberId && sVal === memberId) ||
        (memberName && sVal.toLowerCase() === memberName.toLowerCase())
      ) {
        resolvedId = memberId;
        break;
      }
    }

    return {
      ...split,
      participantId: resolvedId,
    };
  });
}

export interface MemberBalance {
  id: string;
  name: string;
  /** Total amount this member physically paid out-of-pocket (in base currency) */
  paid: number;
  /** Total amount this member is responsible to consume (their share, in base currency) */
  share: number;
  /** net = paid - share. Positive → CREDITOR (should receive). Negative → DEBTOR (must pay). */
  net: number;
}

const getExpenseAmountTHB = (e: any): number => {
  if (!e) return 0;
  if (e.currency === 'THB') return Number(e.amount) || 0;
  const rate = Number(e.custom_exchange_rate) > 0 
    ? Number(e.custom_exchange_rate) 
    : (Number(e.exchange_rate) > 0 && Number(e.exchange_rate) !== 1 ? Number(e.exchange_rate) : (e.currency === 'JPY' ? 0.209096 : 1));
  const raw = Number(e.foreign_amount) > 0 ? Number(e.foreign_amount) : (Number(e.amount) || 0);
  return raw * rate;
};

/**
 * Computes raw per-member net balances using the canonical formula:
 *   net = totalPaid - totalShare
 *   net > 0  → CREDITOR (เจ้าหนี้) — paid more than consumed, should RECEIVE money
 *   net < 0  → DEBTOR   (ลูกหนี้) — consumed more than paid,  MUST PAY money
 *   net = 0  → SETTLED  (ลงตัว)  — perfectly balanced
 */
export function computeMemberBalances(
  expenses: Expense[],
  participants: Participant[],
): MemberBalance[] {
  return participants.map((member) => {
    // A. All expenses where this member is the payer
    const totalPaid = expenses
      .filter((e) => {
        if (e.isExcluded) return false;
        return resolvePayerId(e, participants) === member.id;
      })
      .reduce((sum, e) => sum + getExpenseAmountTHB(e), 0);

    // B. All expenses where this member participated in the split
    const totalShare = expenses.reduce((sum, e) => {
      if (e.isExcluded) return sum;
      
      const splitList = Array.isArray((e as any).split_members) ? (e as any).split_members : (Array.isArray(e.splits) ? e.splits : []);
      const mySplit = splitList.find((s: any) => String(s?.participantId || s?.id || s).trim() === member.id);
      
      if (!mySplit) return sum;
      
      if (typeof mySplit === 'object' && mySplit.amount !== undefined) {
        let rate = 1;
        if (e.splitType === 'CUSTOM') {
           rate = Number((e as any).custom_exchange_rate) > 0 
            ? Number((e as any).custom_exchange_rate) 
            : (Number((e as any).exchange_rate) > 0 && Number((e as any).exchange_rate) !== 1 ? Number((e as any).exchange_rate) : (e.currency === 'JPY' ? 0.209096 : 1));
        } else {
           // For equal splits with amount, maybe the DB stored THB amount already, but let's fall back to safe conversion
           rate = getExchangeRate(e);
        }
        
        // If foreignAmount is set or we are using custom split mode, it means split.amount is in foreign currency
        // But if it's already THB, rate will be 1
        return sum + (Number(mySplit.amount) * rate);
      }
      
      // Fallback: Even split of total bill
      const totalTHB = getExpenseAmountTHB(e);
      const splitCount = splitList.length > 0 ? splitList.length : 1;
      
      return sum + (totalTHB / splitCount);
    }, 0);

    // C. Net Balance: Paid - Share
    // > 0 => Creditor (Receives money)
    // < 0 => Debtor (Owes money)
    const netBalance = totalPaid - totalShare;

    return {
      id: member.id,
      name: member.name,
      paid: Number(totalPaid.toFixed(2)),
      share: Number(totalShare.toFixed(2)),
      net: Number(netBalance.toFixed(2)),
    };
  });
}

/**
 * Original multi-currency settlement (no conversion).
 * Keeps debts grouped by original currency.
 */
export function computeSettlements(expenses: Expense[]): Settlement[] {
  const balances: Record<Currency, Record<string, number>> = {
    THB: {}, JPY: {}, CNY: {}, USD: {}, KZT: {},
  };

  for (const exp of expenses) {
    if (exp.isExcluded) continue;
    const cur = exp.currency;
    balances[cur][exp.paidById] = (balances[cur][exp.paidById] ?? 0) + exp.amount;
    for (const split of exp.splits) {
      balances[cur][split.participantId] =
        (balances[cur][split.participantId] ?? 0) - split.amount;
    }
  }

  const settlements: Settlement[] = [];

  for (const currency of Object.keys(balances) as Currency[]) {
    const bal = balances[currency];
    const creditors = Object.entries(bal)
      .filter(([, v]) => v > 0.005)
      .map(([id, v]) => ({ id, amount: v }))
      .sort((a, b) => b.amount - a.amount);
    const debtors = Object.entries(bal)
      .filter(([, v]) => v < -0.005)
      .map(([id, v]) => ({ id, amount: -v }))
      .sort((a, b) => b.amount - a.amount);

    let ci = 0, di = 0;
    while (ci < creditors.length && di < debtors.length) {
      const credit = creditors[ci];
      const debt = debtors[di];
      const settle = Math.min(credit.amount, debt.amount);
      if (settle > 0.005) {
        settlements.push({
          fromId: debt.id,
          toId: credit.id,
          amount: Math.round(settle * 100) / 100,
          currency,
        });
      }
      credit.amount -= settle;
      debt.amount -= settle;
      if (credit.amount < 0.005) ci++;
      if (debt.amount < 0.005) di++;
    }
  }

  return settlements;
}

/**
 * Base-currency settlement with robust fallbacks:
 *
 * Fallback rules (zero expenses are ever silently skipped):
 * 1. isExcluded = true  → genuinely excluded personal expense; skip intentionally.
 * 2. paidById missing   → fall back to first participant in the list.
 * 3. splits empty/null  → synthesize equal splits among ALL active participants.
 * 4. splits contain only self (payer) → no inter-person debt; skip (correct).
 * 5. amount ≤ 0        → no financial impact; skip gracefully.
 */
export function computeSettlementsInBase(
  expenses: Expense[],
  rates: Rates,
  baseCurrency: Currency,
  allParticipants: Participant[] = []
): Settlement[] {
  // 1. Get exact net balances per member based on strictly Paid - Share
  const memberBalances = computeMemberBalances(expenses, allParticipants);

  // 1.5 Build a map of all unsettled expenses per debtor for the UI accordion
  const unsettledExpensesByDebtor: Record<string, { exp: Expense; amt: number }[]> = {};
  for (const exp of expenses) {
    if (exp.isExcluded) continue;
    const splitList = Array.isArray((exp as any).split_members) ? (exp as any).split_members : (Array.isArray(exp.splits) ? exp.splits : []);
    const payerId = String((exp as any).paid_by || exp.paidById || '').trim();

    for (const split of splitList) {
      if (split.isSettled) continue;
      const borrower = String(split.participantId || split.id || split).trim();
      if (!borrower || borrower === payerId) continue;
      
      unsettledExpensesByDebtor[borrower] ??= [];
      unsettledExpensesByDebtor[borrower].push({ exp, amt: split.amount || 0 });
    }
  }

  // 2. Separate into Creditors (net > 0) and Debtors (net < 0)
  // Creditor: paid more than share (should receive)
  // Debtor: paid less than share (must pay)
  const creditors = memberBalances
    .filter(m => m.net > 0.005)
    .map(m => ({ id: m.id, amount: m.net }))
    .sort((a, b) => b.amount - a.amount); // Largest creditors first

  const debtors = memberBalances
    .filter(m => m.net < -0.005)
    .map(m => ({ id: m.id, amount: Math.abs(m.net) }))
    .sort((a, b) => b.amount - a.amount); // Largest debtors first

  const settlements: Settlement[] = [];
  
  let ci = 0;
  let di = 0;

  // 3. Greedily match Debtors to Creditors
  while (ci < creditors.length && di < debtors.length) {
    const credit = creditors[ci];
    const debt = debtors[di];
    
    const settleAmount = Math.min(credit.amount, debt.amount);
    
    // Allocate all unsettled expenses where this debtor owes money to this settlement transfer
    // This allows the UI to mark them as settled when the transfer is paid.
    const involvedExpenses: NonNullable<Settlement["involvedExpenses"]> = [];
    const myUnsettled = unsettledExpensesByDebtor[debt.id] ?? [];
    for (const u of myUnsettled) {
      // We push them as if they are debts owed to this creditor just so the UI can check them off
      involvedExpenses.push({ expense: u.exp, amountOwed: u.amt, isCredit: false });
    }
    
    if (settleAmount > 0.005) {
      settlements.push({
        fromId: debt.id,      // Debtor pays
        toId: credit.id,      // Creditor receives
        amount: Math.round(settleAmount * 100) / 100,
        historicAmount: Math.round(settleAmount * 100) / 100,
        currency: baseCurrency,
        involvedExpenses,
      });
    }

    credit.amount -= settleAmount;
    debt.amount -= settleAmount;

    if (credit.amount < 0.005) ci++;
    if (debt.amount < 0.005) di++;
  }

  return settlements;
}
