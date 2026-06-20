import { Expense, Settlement, Currency } from "@/types/trip";
import { Rates, convertToBase } from "@/lib/currency";

/**
 * Original multi-currency settlement (no conversion).
 * Keeps debts grouped by original currency.
 */
export function computeSettlements(expenses: Expense[]): Settlement[] {
  const balances: Record<Currency, Record<string, number>> = {
    THB: {}, JPY: {}, CNY: {}, USD: {},
  };

  for (const exp of expenses) {
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
 */
export function computeSettlementsInBase(
  expenses: Expense[],
  rates: Rates,
  baseCurrency: Currency
): Settlement[] {
  // pairwise balances: what borrower owes to payer
  const pairwise: Record<string, Record<string, number>> = {};
  // keep track of specific expenses: what borrower owes to payer
  const pairExpenses: Record<string, Record<string, { exp: Expense, amt: number }[]>> = {};

  for (const exp of expenses) {
    if (exp.isExcluded) continue;

    const paidBy = exp.paidById;
    for (const split of exp.splits) {
      if (split.participantId === paidBy) continue;
      const borrower = split.participantId;
      const shareBase = exp.historicalRate 
        ? split.amount * exp.historicalRate 
        : convertToBase(split.amount, exp.currency, rates);

      if (!split.isSettled) {
        pairwise[borrower] ??= {};
        pairwise[borrower][paidBy] = (pairwise[borrower][paidBy] ?? 0) + shareBase;
      }

      pairExpenses[borrower] ??= {};
      pairExpenses[borrower][paidBy] ??= [];
      pairExpenses[borrower][paidBy].push({ exp, amt: shareBase });
    }
  }

  // Get unique participants from pairwise tracking
  const pIds = new Set<string>();
  for (const b of Object.keys(pairExpenses)) {
    pIds.add(b);
    for (const p of Object.keys(pairExpenses[b])) pIds.add(p);
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
      
      const debtsP1 = pairExpenses[p1]?.[p2] ?? [];
      const creditsP1 = pairExpenses[p2]?.[p1] ?? [];

      if (Math.abs(net) > 0.5 || debtsP1.length > 0 || creditsP1.length > 0) {
        // Calculate historic net to lock the row direction
        const histP1OwesP2 = debtsP1.reduce((sum, e) => sum + e.amt, 0);
        const histP2OwesP1 = creditsP1.reduce((sum, e) => sum + e.amt, 0);
        const historicNet = histP1OwesP2 - histP2OwesP1;

        const fromId = historicNet >= 0 ? p1 : p2;
        const toId   = historicNet >= 0 ? p2 : p1;
        
        // Floor the active net debt to 0 to prevent negative flips
        const activeNet = fromId === p1 ? net : -net;
        const activeDebtFloored = Math.max(0, activeNet);
        
        const involvedExpenses = [];
        // Expenses where fromId owes toId (positive debt contribution)
        const debts = pairExpenses[fromId]?.[toId] ?? [];
        for (const d of debts) {
          involvedExpenses.push({ expense: d.exp, amountOwed: d.amt, isCredit: false });
        }
        // Expenses where toId owes fromId (credit contribution, offsets debt)
        const credits = pairExpenses[toId]?.[fromId] ?? [];
        for (const c of credits) {
          involvedExpenses.push({ expense: c.exp, amountOwed: c.amt, isCredit: true });
        }

        // Sort by date or created at
        involvedExpenses.sort((a, b) => a.expense.date.localeCompare(b.expense.date));

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
  }

  return settlements;
}
