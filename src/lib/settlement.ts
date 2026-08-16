import { Expense, Settlement, Currency, Participant } from "@/types/trip";
import { Rates, convertToBase, getExchangeRate, getConvertedAmountTHB } from "@/lib/currency";

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

      // Resolve payer identity across all known DB column aliases
      const actualPaidById =
        exp.paidById ||
        (exp as any).paid_by ||
        (exp as any).payer_id ||
        (exp as any).created_by ||
        (exp as any).createdBy;

      // Total bill converted to base currency
      const totalBillBase = getConvertedAmountTHB(exp);

      // A: Did this member pay the bill up-front?
      if (actualPaidById === member.id) {
        paid += totalBillBase;
      }

      // B: What is this member's allocated share?
      const mySplit = (exp.splits ?? []).find((s) => s.participantId === member.id);
      if (mySplit) {
        const splitAmt = parseFloat(mySplit.amount as any) || 0;
        // For new-style expenses: split.amount is already in base currency (THB).
        // For legacy foreign expenses (no foreignAmount field): split.amount is in
        // the expense's original currency and must be converted.
        const shareBase =
          exp.foreignAmount !== undefined
            ? splitAmt
            : splitAmt * getExchangeRate(exp);
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

    // ── 3. Resolve payer — check multiple keys for accurate payer identity ──
    const actualPaidById = exp.paidById || (exp as any).paid_by || (exp as any).payer_id;
    const paidBy = actualPaidById && actualPaidById.trim() 
      ? actualPaidById 
      : ((exp as any).created_by || (exp as any).createdBy);

    // Can't do anything without a valid payer identity
    if (!paidBy) continue;

    // ── 4. Resolve splits — synthesize equal splits if missing ───────────────
    let effectiveSplits = exp.splits ?? [];

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
      // For new foreign expenses, split.amount is already in base currency.
      // For legacy foreign expenses, split.amount is in foreign currency and needs conversion.
      const shareBase = (exp.foreignAmount !== undefined) 
        ? splitAmt 
        : splitAmt * getExchangeRate(exp);

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
