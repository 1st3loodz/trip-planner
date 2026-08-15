import { Expense, Settlement, Currency } from "@/types/trip";
import { Rates, convertToBase } from "@/lib/currency";

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
    const creditors = Object.entries(bal).filter(([, v]) => v > 0.005).map(([id, v]) => ({ id, amount: v })).sort((a, b) => b.amount - a.amount);
    const debtors   = Object.entries(bal).filter(([, v]) => v < -0.005).map(([id, v]) => ({ id, amount: -v })).sort((a, b) => b.amount - a.amount);

    let ci = 0, di = 0;
    while (ci < creditors.length && di < debtors.length) {
      const credit = creditors[ci]; const debt = debtors[di];
      const settle = Math.min(credit.amount, debt.amount);
      if (settle > 0.005) settlements.push({ fromId: debt.id, toId: credit.id, amount: Math.round(settle * 100) / 100, currency });
      credit.amount -= settle; debt.amount -= settle;
      if (credit.amount < 0.005) ci++;
      if (debt.amount < 0.005) di++;
    }
  }

  return settlements;
}

/**
 * Base-currency settlement — converts all amounts to a single base currency,
 * then runs the greedy simplification. Returns settlements in base currency.
 *
 * FIX LOG:
 * - Skips isExcluded expenses from balance math (they shouldn't create debt)
 * - Skips self-splits correctly (payer's own share)
 * - Guards against empty splits arrays (expense is silently skipped rather than crashing)
 * - Logs any expense that produces no pairwise entry (debugging aid)
 */
export function computeSettlementsInBase(
  expenses: Expense[],
  rates: Rates,
  baseCurrency: Currency
): Settlement[] {
  // pairwise[borrower][payer] = net base-currency amount borrower owes payer (unsettled only)
  const pairwise: Record<string, Record<string, number>> = {};
  // pairExpenses[borrower][payer] = list of expense + amt entries (ALL — including settled, for breakdown display)
  const pairExpenses: Record<string, Record<string, { exp: Expense; amt: number }[]>> = {};

  // Diagnostic counters
  let processedCount = 0;
  let skippedExcluded = 0;
  let skippedNoSplits = 0;
  let skippedSelfOnly = 0;

  for (const exp of expenses) {
    // ── Guard: skip expenses marked as personal/excluded ──────────────────
    if (exp.isExcluded) {
      skippedExcluded++;
      continue;
    }

    // ── Guard: skip expenses with no splits (shouldn't happen but be safe) ─
    if (!exp.splits || exp.splits.length === 0) {
      skippedNoSplits++;
      console.warn(
        `[settlement] Expense "${exp.description}" (${exp.id}) has NO splits — skipped from settlement.`
      );
      continue;
    }

    const paidBy = exp.paidById;

    // Count how many non-self splits this expense has
    const nonSelfSplits = exp.splits.filter(s => s.participantId !== paidBy);

    if (nonSelfSplits.length === 0) {
      // Payer paid for themselves only — no inter-person debt generated
      skippedSelfOnly++;
      console.info(
        `[settlement] Expense "${exp.description}" (${exp.id}) has only self-splits — no debt generated.`
      );
      continue;
    }

    processedCount++;

    for (const split of exp.splits) {
      // Skip payer's own share — payer doesn't owe themselves
      if (split.participantId === paidBy) continue;

      const borrower = split.participantId;

      // Convert share to base currency using frozen historical rate when available,
      // else use current live rate
      const shareBase = exp.historicalRate
        ? split.amount * exp.historicalRate
        : convertToBase(split.amount, exp.currency, rates);

      // ── Pairwise balance (unsettled only — drives the "amount owed" number) ──
      if (!split.isSettled) {
        pairwise[borrower] ??= {};
        pairwise[borrower][paidBy] = (pairwise[borrower][paidBy] ?? 0) + shareBase;
      }

      // ── Full expense list (always tracked — drives the accordion breakdown) ──
      pairExpenses[borrower] ??= {};
      pairExpenses[borrower][paidBy] ??= [];
      pairExpenses[borrower][paidBy].push({ exp, amt: shareBase });
    }
  }

  console.info(
    `[settlement] Processed ${processedCount} expenses. ` +
    `Skipped: ${skippedExcluded} excluded, ${skippedNoSplits} no-splits, ${skippedSelfOnly} self-only.`
  );

  // ── Collect all participant IDs seen across all pairExpenses ──────────────
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

      // Only create a settlement row if there are actual expense relationships
      if (debtsP1.length === 0 && creditsP1.length === 0) continue;

      // Historic net (sum of ALL expense shares in both directions, ignoring settled flag)
      // This determines the canonical "from → to" direction so settled items don't flip the arrow
      const histP1OwesP2 = debtsP1.reduce((sum, e) => sum + e.amt, 0);
      const histP2OwesP1 = creditsP1.reduce((sum, e) => sum + e.amt, 0);
      const historicNet  = histP1OwesP2 - histP2OwesP1;

      const fromId = historicNet >= 0 ? p1 : p2;
      const toId   = historicNet >= 0 ? p2 : p1;

      // Active net debt — floor to 0 to avoid negative-flipped arrows when everything is settled
      const activeNet         = fromId === p1 ? net : -net;
      const activeDebtFloored = Math.max(0, activeNet);

      // Build the accordion breakdown list
      const involvedExpenses: NonNullable<Settlement["involvedExpenses"]> = [];

      // Expenses where fromId owes toId (positive debt contribution → isCredit: false)
      const debts = pairExpenses[fromId]?.[toId] ?? [];
      for (const d of debts) {
        involvedExpenses.push({ expense: d.exp, amountOwed: d.amt, isCredit: false });
      }
      // Expenses where toId owes fromId (credit → reduces debt → isCredit: true)
      const credits = pairExpenses[toId]?.[fromId] ?? [];
      for (const c of credits) {
        involvedExpenses.push({ expense: c.exp, amountOwed: c.amt, isCredit: true });
      }

      // Sort by expense date, then by createdAt for same-day stability
      involvedExpenses.sort((a, b) => {
        const dateComp = a.expense.date.localeCompare(b.expense.date);
        return dateComp !== 0 ? dateComp : a.expense.createdAt.localeCompare(b.expense.createdAt);
      });

      console.info(
        `[settlement] ${fromId} → ${toId}: ` +
        `active=฿${activeDebtFloored.toFixed(0)}, ` +
        `historic=฿${Math.abs(historicNet).toFixed(0)}, ` +
        `${involvedExpenses.length} expense(s) in breakdown`
      );

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
