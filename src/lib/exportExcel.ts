import * as XLSX from "xlsx";
import { Trip, Currency } from "@/types/trip";
import { Rates } from "@/lib/currency";
import { computeSettlementsInBase } from "@/lib/settlement";
import { createClient } from "@/utils/supabase/client";
import { addDaysToISO, formatDate } from "@/lib/utils";

export async function exportTripToExcel(trip: Trip, baseCurrency: Currency, rates: Rates) {
  const supabase = createClient();
  const { data: actualLogs } = await supabase
    .from("actual_logs")
    .select("*")
    .eq("trip_id", trip.id)
    .order("day_number", { ascending: true })
    .order("from_time", { ascending: true, nullsFirst: true });

  const wb = XLSX.utils.book_new();

  // Sheet 1: Expenses
  const expensesData = trip.expenses.map((e) => {
    const paidBy = trip.participants.find((p) => p.id === (e.paidById || (e as any).paid_by))?.name || "Unknown";
    const splits = (e.splits || []).map((s) => {
      const p = trip.participants.find((p) => p.id === s.participantId);
      return `${p?.name || "Unknown"}: ${s.amount}`;
    }).join(", ");
    
    return {
      "Date (DD/MM/YYYY)": formatDate(e.date || (e as any).expense_date),
      "Title": e.description,
      "Category": e.category,
      "Paid By": paidBy,
      [`Total Amount (${baseCurrency})`]: e.amount,
      "Foreign Amount": e.foreignAmount || "",
      "Currency": e.currency,
      "Rate": e.exchangeRate || e.historicalRate || "",
      "Split Type": e.splitType || "EQUAL",
      "Split Details": splits,
    };
  });
  const wsExpenses = XLSX.utils.json_to_sheet(expensesData);
  XLSX.utils.book_append_sheet(wb, wsExpenses, "Expenses");

  // Sheet 2: Settlement
  const settlements = computeSettlementsInBase(trip.expenses, rates, baseCurrency, trip.participants);
  const settlementData = settlements.map((s) => {
    const debtor = trip.participants.find((p) => p.id === s.fromId)?.name || s.fromId;
    const creditor = trip.participants.find((p) => p.id === s.toId)?.name || s.toId;
    return {
      "Debtor (คนโอน)": debtor,
      "Creditor (คนรับ)": creditor,
      [`Amount (${baseCurrency})`]: s.amount,
      "Status": s.amount === 0 ? "Settled" : "Owes",
    };
  });
  const wsSettlement = XLSX.utils.json_to_sheet(settlementData);
  XLSX.utils.book_append_sheet(wb, wsSettlement, "Settlement");

  // Sheet 3: Actual Plan
  const actualPlanData = (actualLogs || []).map((log: any) => ({
    "Day Number": log.day_number,
    "Date": formatDate(addDaysToISO(trip.startDate, log.day_number - 1)),
    "From Time": log.from_time || "",
    "To Time": log.to_time || "",
    "Details": log.details,
  }));
  const wsActual = XLSX.utils.json_to_sheet(actualPlanData);
  XLSX.utils.book_append_sheet(wb, wsActual, "Actual Plan");

  // Sheet 4: Planned Itinerary
  const itineraryData: any[] = [];
  (trip.days || []).forEach((day) => {
    (day.activities || []).forEach((act) => {
      itineraryData.push({
        "Day Number": day.dayNumber,
        "Date": formatDate(addDaysToISO(trip.startDate, day.dayNumber - 1)),
        "Activity Title": act.title,
        "Time": `${act.time || ""} - ${act.endTime || ""}`,
        "Location/Notes": act.location || act.description || "",
      });
    });
  });
  const wsItinerary = XLSX.utils.json_to_sheet(itineraryData);
  XLSX.utils.book_append_sheet(wb, wsItinerary, "Planned Itinerary");

  // Download file
  const filename = `${trip.title || "Trip"}_summary.xlsx`;
  XLSX.writeFile(wb, filename);
}
