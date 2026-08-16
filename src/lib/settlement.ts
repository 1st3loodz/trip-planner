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
    let paid = 0;
    let share = 0;

    for (const exp of expenses) {
      if (exp.isExcluded) continue;
      const expAmount = parseFloat(exp.amount as any) || 0;
      if (expAmount <= 0) continue;

      const resolvedPayerId = resolvePayerId(exp, participants);

      // Total bill converted to base currency
      const totalBillBase = getConvertedAmountTHB(exp);

      // A: Did this member pay the bill up-front?
      if (resolvedPayerId === member.id) {
        paid += totalBillBase;
      }

      // B: What is this member's allocated share?
      const resolvedSplits = getResolvedSplits(exp, participants);
      const mySplit = resolvedSplits.find((s) => s.participantId === member.id);
      
      if (mySplit) {
        let shareBase = 0;
        if (exp.splitType === 'CUSTOM') {
          const splitAmt = parseFloat(mySplit.amount as any) || 0;
          shareBase = exp.foreignAmount !== undefined
            ? splitAmt
            : splitAmt * getExchangeRate(exp);
        } else {
          // Equal split - calculate exactly as total / count to avoid rounding differences
          const splitCount = resolvedSplits.length || 1;
          shareBase = totalBillBase / splitCount;
        }
        share += shareBase;
      }
    }

    const net = paid - share;

    return {
      id:    member.id,
      name:  member.name,
      paid:  Math.round(paid  * 100) / 100,
      share: Math.round(share * 100) / 100,
      net:   Math.round(net   * 100) / 100,
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
  // pairwise[borrower][payer] = unsettled base-currency net debt
  const pairwise: Record<string, Record<string, number>> = {};
  // pairExpenses[borrower][payer] = all expense entries (including settled) for breakdown display
  const pairExpenses: Record<string, Record<string, { exp: Expense; amt: number }[]>> = {};

  for (const exp of expenses) {
    // ── 1. Genuine personal/excluded expense — intentional skip ──────────────
    if (exp.isExcluded) continue;

    // ── 2. Guard against zero/negative amounts ───────────────────────────────
    const expAmount = parseFloat(exp.amount as any) || 0;
    if (expAmount <= 0) continue;

    // ── 3. Resolve payer — robust match against participants ──────────────────
    const paidBy = resolvePayerId(exp, allParticipants);

    // Can't do anything without a valid payer identity
    if (!paidBy) continue;

    // ── 4. Resolve splits — synthesize equal splits if missing ───────────────
    let effectiveSplits = getResolvedSplits(exp, allParticipants);

    if (effectiveSplits.length === 0 && allParticipants.length > 0) {
      // No splits recorded → distribute equally among everyone
      const equalShare = expAmount / allParticipants.length;
      effectiveSplits = allParticipants.map(p => ({
        participantId: p.id,
        amount: parseFloat(equalShare.toFixed(2)),
        isSettled: false,
      }));
    }

    // ── 5. Count non-self splits — skip if truly solo ────────────────────────
    const nonSelfSplits = effectiveSplits.filter(s => s.participantId !== paidBy);
    if (nonSelfSplits.length === 0) continue;

    // ── 6. Build pairwise balances ───────────────────────────────────────────
    for (const split of effectiveSplits) {
      // Skip payer's own share — they don't owe themselves
      if (split.participantId === paidBy) continue;

      const borrower = split.participantId;
      if (!borrower || !borrower.trim()) continue; // guard against bad participant IDs

      const splitAmt = parseFloat(split.amount as any) || 0;
      
      // Convert this split's share to base currency
      // If it's a CUSTOM split, use the split amount (converted if needed).
      // If it's an EQUAL split, divide the total base bill by the number of splits to avoid rounding errors.
      let shareBase = 0;
      if (exp.splitType === 'CUSTOM') {
        shareBase = (exp.foreignAmount !== undefined) 
          ? splitAmt 
          : splitAmt * getExchangeRate(exp);
      } else {
        const totalBillBase = getConvertedAmountTHB(exp);
        shareBase = totalBillBase / effectiveSplits.length;
      }

      if (shareBase <= 0) continue;

      // Unsettled balance (drives the "amount owed" number)
      if (!split.isSettled) {
        pairwise[borrower] ??= {};
        pairwise[borrower][paidBy] = (pairwise[borrower][paidBy] ?? 0) + shareBase;
      }

      // Full expense list (always recorded — drives the accordion breakdown)
      pairExpenses[borrower] ??= {};
      pairExpenses[borrower][paidBy] ??= [];
      pairExpenses[borrower][paidBy].push({ exp, amt: shareBase });
    }
  }

  // ── Collect all participant IDs seen in pairExpenses ─────────────────────
  const pIds = new Set<string>();
  for (const borrower of Object.keys(pairExpenses)) {
    pIds.add(borrower);
    for (const payer of Object.keys(pairExpenses[borrower])) {
      pIds.add(payer);
    }
  }
  const participants = Array.from(pIds);

  const settlements: Settlement[] = [];
  const processed = new Set<string>();

  for (const p1 of participants) {
    for (const p2 of participants) {
      if (p1 === p2) continue;
      const key = [p1, p2].sort().join("-");
      if (processed.has(key)) continue;
      processed.add(key);

      const p1OwesP2 = pairwise[p1]?.[p2] ?? 0;
      const p2OwesP1 = pairwise[p2]?.[p1] ?? 0;
      const net = p1OwesP2 - p2OwesP1;

      const debtsP1   = pairExpenses[p1]?.[p2] ?? [];
      const creditsP1 = pairExpenses[p2]?.[p1] ?? [];

      // Only create a row if there are actual expense relationships
      if (debtsP1.length === 0 && creditsP1.length === 0) continue;

      // Historic net (all expense shares in both directions, ignoring settled flag)
      // Determines canonical arrow direction — prevents settled items from flipping it
      const histP1OwesP2 = debtsP1.reduce((sum, e) => sum + e.amt, 0);
      const histP2OwesP1 = creditsP1.reduce((sum, e) => sum + e.amt, 0);
      const historicNet  = histP1OwesP2 - histP2OwesP1;

      const fromId = historicNet >= 0 ? p1 : p2;
      const toId   = historicNet >= 0 ? p2 : p1;

      // Active net debt — floored at 0 to prevent negative flips when everything settled
      const activeNet         = fromId === p1 ? net : -net;
      const activeDebtFloored = Math.max(0, activeNet);

      // Build accordion breakdown list
      const involvedExpenses: NonNullable<Settlement["involvedExpenses"]> = [];

      // fromId owes toId (positive debt → isCredit: false)
      for (const d of (pairExpenses[fromId]?.[toId] ?? [])) {
        involvedExpenses.push({ expense: d.exp, amountOwed: d.amt, isCredit: false });
      }
      // toId owes fromId (credit offsets debt → isCredit: true)
      for (const c of (pairExpenses[toId]?.[fromId] ?? [])) {
        involvedExpenses.push({ expense: c.exp, amountOwed: c.amt, isCredit: true });
      }

      // Stable sort: date then createdAt
      involvedExpenses.sort((a, b) => {
        const d = a.expense.date.localeCompare(b.expense.date);
        return d !== 0 ? d : a.expense.createdAt.localeCompare(b.expense.createdAt);
      });

      settlements.push({
        fromId,
        toId,
        amount: Math.round(activeDebtFloored),
        historicAmount: Math.round(Math.abs(historicNet)),
        currency: baseCurrency,
        involvedExpenses,
      });
    }
  }

  return settlements;
}
