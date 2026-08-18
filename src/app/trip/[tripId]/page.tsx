"use client";

import Link from "next/link";
import { format } from 'date-fns';
import { useState, useCallback, use, useEffect, useMemo } from "react";
import { Expense, ActivityItem, Participant, Trip } from "@/types/trip";
import { useTheme } from "@/components/ThemeProvider";
import { useTrips } from "@/contexts/TripContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { createClient } from "@/utils/supabase/client";
import TripHeader         from "@/components/TripHeader";
import ItineraryTab       from "@/components/ItineraryTab";
import ExpensesTab        from "@/components/ExpensesTab";
import SettlementTab      from "@/components/SettlementTab";
import ManageMembersModal from "@/components/ManageMembersModal";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";

export default function TripDetailPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { theme, toggleTheme } = useTheme();
  
  // React `use` hook to unwrap params
  const { tripId } = use(params);

  const { isLoaded, getTrip, updateTrip, addTripMember, removeTripMember, refreshTrips, userId } = useTrips();
  const { setBaseCurrency } = useCurrency();
  const contextTrip = getTrip(tripId);

  const [activeTab,          setActiveTab]          = useState<"itinerary" | "expenses" | "settlement">("itinerary");
  const [showMembersModal,   setShowMembersModal]   = useState(false);
  const [activityToDelete,   setActivityToDelete]   = useState<{dayNumber: number; activityId: string; title: string} | null>(null);

  // ── Window Focus Re-hydration ─────────────────────────────────────────────
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log("[Focus Sync] Window became active! Refreshing trips globally...");
        refreshTrips();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [refreshTrips]);

  // ── Auto-Hydrate Missing Days ──────────────────────────────────────────────
  const safeParseDate = useCallback((dateString: string) => {
    if (!dateString) return null;
    const segments = dateString.split('/');
    if (segments.length === 3) {
      const day = parseInt(segments[0], 10);
      const month = parseInt(segments[1], 10) - 1; // 0-indexed months
      let year = parseInt(segments[2], 10);
      if (year < 100) year += 2000; // Force two-digit '26' to evaluate cleanly as 2026
      return new Date(year, month, day);
    }
    return new Date(dateString);
  }, []);

  const calculateTotalDays = useCallback((startStr: string, endStr: string): number => {
    if (!startStr || !endStr) return 1;
    const start = safeParseDate(startStr);
    const end = safeParseDate(endStr);
    if (!start || !end) return 1;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays === 0 ? 1 : diffDays + 1;
  }, [safeParseDate]);

  const trip = useMemo(() => {
    if (!contextTrip) return undefined;
    const totalDays = calculateTotalDays(contextTrip.startDate, contextTrip.endDate);
    const hydratedDays = Array.from({ length: totalDays }, (_, i) => {
      const dayNum = i + 1;
      const existing = contextTrip.days.find((d) => d.dayNumber === dayNum);
      if (existing) return existing;

      const dayDate = safeParseDate(contextTrip.startDate);
      if (dayDate) dayDate.setDate(dayDate.getDate() + i);
      const isoDate = dayDate ? dayDate.toISOString().split('T')[0] : "";

      return {
        dayNumber: dayNum,
        date: isoDate,
        activities: []
      };
    });
    return { ...contextTrip, days: hydratedDays };
  }, [contextTrip, calculateTotalDays, safeParseDate]);

  useEffect(() => {
    if (trip?.baseCurrency) {
      setBaseCurrency(trip.baseCurrency);
    }
  }, [trip?.baseCurrency, setBaseCurrency]);

  const isGroupTrip = trip ? trip.participants.length >= 2 : false;

  // ── Participants state ────────────────────────────────────────────────────
  const handleAddMember = useCallback(async (p: Participant) => {
    if (!trip) return;
    await addTripMember(trip.id, p);
    refreshTrips(); 
  }, [trip, addTripMember, refreshTrips]);

  const handleRemoveMember = useCallback(async (id: string) => {
    if (!trip) return;
    
    // Step 1: cascade through expenses
    const updatedExpenses = trip.expenses.map((expense) => {
      const newSplits = expense.splits.filter((s) => s.participantId !== id);
      if (newSplits.length === expense.splits.length) return expense;
      if (newSplits.length === 0) return expense;
      
      const newShare = parseFloat((expense.amount / newSplits.length).toFixed(2));
      return {
        ...expense,
        splits: newSplits.map((s) => ({ ...s, amount: newShare })),
      };
    });

    // Step 2: update both expenses and participants
    updateTrip(trip.id, {
      expenses: updatedExpenses,
    });
    await removeTripMember(trip.id, id);
    refreshTrips();
  }, [trip, updateTrip, removeTripMember, refreshTrips]);

  // ── Expenses state ────────────────────────────────────────────────────────
  const handleAddExpense    = useCallback(async (e: Expense)  => {
    if (trip) {
      await updateTrip(trip.id, { expenses: [...trip.expenses, e] });
    }
  }, [trip, updateTrip]);
  
  const handleEditExpense   = useCallback(async (u: Expense)  => {
    if (trip) {
      await updateTrip(trip.id, { expenses: trip.expenses.map((e) => e.id === u.id ? u : e) });
    }
  }, [trip, updateTrip]);

  const handleEditExpenses  = useCallback(async (updates: Expense[])  => {
    if (trip && updates.length > 0) {
      const updateMap = new Map(updates.map(u => [u.id, u]));
      await updateTrip(trip.id, { expenses: trip.expenses.map((e) => updateMap.get(e.id) || e) });
    }
  }, [trip, updateTrip]);
  
  const handleDeleteExpense = useCallback(async (id: string)  => {
    if (trip) {
      await updateTrip(trip.id, { expenses: trip.expenses.filter((e) => e.id !== id) });
    }
  }, [trip, updateTrip]);

  // ── Days / Activities state ───────────────────────────────────────────────
  const handleAddActivity = useCallback(async (dayNumber: number, activity: ActivityItem) => {
    if (!trip) return;
    const newDays = trip.days.map((day) => {
      if (day.dayNumber !== dayNumber) return day;
      return { ...day, activities: [...day.activities, activity].sort((a, b) => a.time.localeCompare(b.time)) };
    });
    await updateTrip(trip.id, { days: newDays });
  }, [trip, updateTrip]);

  const handleEditActivity = useCallback(async (newDayNumber: number, updated: ActivityItem) => {
    if (!trip) return;
    const withRemoved = trip.days.map((day) => ({
      ...day,
      activities: day.activities.filter((a) => a.id !== updated.id),
    }));
    const newDays = withRemoved.map((day) => {
      if (day.dayNumber !== newDayNumber) return day;
      return {
        ...day,
        activities: [...day.activities, updated].sort((a, b) => a.time.localeCompare(b.time)),
      };
    });
    await updateTrip(trip.id, { days: newDays });
  }, [trip, updateTrip]);

  const handleDeleteActivity = useCallback(async (dayNumber: number, activityId: string) => {
    if (!trip) return;
    const targetDay = trip.days.find(d => d.dayNumber === dayNumber);
    const targetActivity = targetDay?.activities.find(a => a.id === activityId);
    setActivityToDelete({
      dayNumber,
      activityId,
      title: targetActivity?.title || "this activity"
    });
  }, [trip]);

  const executeDeleteActivity = useCallback(async () => {
    if (!trip || !activityToDelete) return;
    const { dayNumber, activityId } = activityToDelete;
    
    const newDays = trip.days.map((day) => {
      if (day.dayNumber !== dayNumber) return day;
      return { ...day, activities: day.activities.filter((a) => a.id !== activityId) };
    });
    
    await updateTrip(trip.id, { days: newDays });
    setActivityToDelete(null);
  }, [trip, activityToDelete, updateTrip]);

  // ── Custom Categories state ───────────────────────────────────────────────
  const handleAddCustomCategory = useCallback(async (cat: { id: string; label: string; emoji: string }) => {
    if (!trip) return;
    await updateTrip(trip.id, { customCategories: [...(trip.customCategories || []), cat] });
  }, [trip, updateTrip]);

  // ── Day Reordering (Drag-and-Drop) ────────────────────────────────────────
  const handleReorderDays = useCallback(async (reorderedDays: import("@/types/trip").DayPlan[]) => {
    if (!trip) return;
    const renumbered = reorderedDays.map((day, idx) => ({ ...day, dayNumber: idx + 1 }));
    await updateTrip(trip.id, { days: renumbered });
  }, [trip, updateTrip]);

  const handleUpdateDays = useCallback(async (newDays: import("@/types/trip").DayPlan[]) => {
    if (!trip) return;
    await updateTrip(trip.id, { days: newDays });
  }, [trip, updateTrip]);

  const handleToggleExpenseSettle = async (expenseId: string, currentStatus: boolean) => {
    if (!trip) return;
    try {
      const newStatus = !currentStatus;

      const updatedExpenses = trip.expenses.map((e: any) => 
        e.id === expenseId ? { ...e, is_settled: newStatus, isSettled: newStatus } : e
      );
      
      // Update the trips table directly via the centralized updateTrip method
      await updateTrip(trip.id, { expenses: updatedExpenses });
    } catch (err) {
      console.error("Error toggling expense settle status:", err);
    }
  };

  if (!isLoaded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4ecd8] dark:bg-[#28211d]">
        <p className="font-pixel text-amber-700 dark:text-[#f5ebd5] text-xs animate-blink">Loading…</p>
      </main>
    );
  }

  if (!trip) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#f4ecd8] dark:bg-[#28211d]">
        <div className="dialogue-box p-8 text-center bg-[#fdfbf7] dark:bg-[#362d28] border-2 border-stone-800 dark:border-[#54463d] max-w-[400px]">
          <p className="font-pixel text-stone-800 dark:text-[#fdfbf7] text-xs mb-4">Trip Not Found</p>
          <p className="font-mono text-amber-800 dark:text-[#f5ebd5] text-xs mb-6">The adventure log you seek doesn’t exist or was removed.</p>
          <Link href="/" className="game-btn inline-block px-6 py-3 font-pixel text-[9px] text-amber-100 uppercase bg-[#4a7c59] dark:bg-[#2d5a3d]">
            ← Back to Village
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4ecd8] dark:bg-[#28211d]">
      {/* ── Sticky nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 w-full bg-[#fdfbf7] dark:bg-[#362d28] border-b-2 border-stone-800 dark:border-[#54463d] shadow-[0_2px_0_#292524] dark:shadow-[0_2px_0_#54463d]">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="font-pixel text-stone-800 dark:text-[#fdfbf7] text-[10px] hover:text-stone-600">
            ✈ Nomadic Journey
          </Link>
          <span className="font-mono text-stone-400 dark:text-stone-500 text-sm">/</span>
          <span className="truncate font-mono text-stone-600 dark:text-[#f5ebd5] text-xs">{trip.title}</span>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setActiveTab("itinerary")}
              className="game-btn px-3 py-1.5 font-pixel text-[8px] uppercase bg-[#f5eed7] text-stone-800 dark:bg-[#1e1815] dark:text-[#fdfbf7] dark:border-[#54463d]"
            >
              + Journal
            </button>
            <button
              onClick={() => setActiveTab("expenses")}
              className="game-btn px-3 py-1.5 font-pixel text-[8px] uppercase bg-[#4a7c59] text-amber-100 dark:bg-[#2d5a3d]"
            >
              + Gold
            </button>
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="game-btn flex h-8 w-8 items-center justify-center font-mono text-stone-800 text-sm bg-[#f5eed7] dark:bg-[#1e1815] dark:text-[#fdfbf7] dark:border-[#54463d]"
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>
          </div>
        </div>
      </nav>

      {/* ── Page content ── */}
      <div className="mx-auto max-w-4xl px-4 pt-24 pb-8 sm:px-6">
        <TripHeader
          trip={trip}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onManageMembers={() => setShowMembersModal(true)}
          onRefreshRequest={refreshTrips}
        />

        {activeTab === "itinerary" ? (
          <ItineraryTab
            trip={trip}
            onAddActivity={handleAddActivity}
            onEditActivity={handleEditActivity}
            onDeleteActivity={handleDeleteActivity}
            onReorderDays={handleReorderDays}
            onUpdateDays={handleUpdateDays}
            customCategories={trip.customCategories || []}
            onAddCustomCategory={handleAddCustomCategory}
            setRefreshToggle={() => refreshTrips()}
          />
        ) : activeTab === "expenses" ? (
          <ExpensesTab
            expenses={trip.expenses}
            participants={trip.participants}
            onAddExpense={handleAddExpense}
            onEditExpense={handleEditExpense}
            onEditExpenses={handleEditExpenses}
            onDeleteExpense={handleDeleteExpense}
            customCategories={trip.customCategories || []}
            onAddCustomCategory={handleAddCustomCategory}
            isGroupTrip={isGroupTrip}
          />
        ) : activeTab === "settlement" ? (
          <SettlementTab trip={trip} currentUserId={userId} onToggleExpenseSettle={handleToggleExpenseSettle} />
        ) : null}
      </div>

      {showMembersModal && (
        <ManageMembersModal
          tripId={trip.id}
          participants={trip.participants}
          expenses={trip.expenses}
          onAdd={handleAddMember}
          onRemove={handleRemoveMember}
          onClose={() => setShowMembersModal(false)}
          setRefreshToggle={() => refreshTrips()}
        />
      )}

      {activityToDelete && (
        <ConfirmDeleteModal
          itemName="activity"
          title={activityToDelete.title}
          description={`Are you sure you want to delete "${activityToDelete.title}"? This action cannot be undone and it will be removed from your itinerary permanently.`}
          onConfirm={executeDeleteActivity}
          onCancel={() => setActivityToDelete(null)}
        />
      )}
    </main>
  );
}
