"use client";

import Link from "next/link";
import { useState, useCallback, use, useEffect, useMemo } from "react";
import { Expense, ActivityItem, Participant, Trip } from "@/types/trip";
import { useTheme } from "@/components/ThemeProvider";
import { useTrips } from "@/contexts/TripContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { createClient } from "@/utils/supabase/client";
import TripHeader         from "@/components/TripHeader";
import ItineraryTab       from "@/components/ItineraryTab";
import ExpensesTab        from "@/components/ExpensesTab";
import ManageMembersModal from "@/components/ManageMembersModal";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";

const COLOR_POOL = [
  "bg-amber-600 text-white",   "bg-emerald-700 text-white", "bg-rose-700 text-white",    "bg-teal-700 text-white",
  "bg-orange-600 text-white",  "bg-lime-700 text-white",    "bg-cyan-700 text-white",    "bg-sky-700 text-white",
  "bg-red-700 text-white",     "bg-green-700 text-white",   "bg-yellow-600 text-white",  "bg-indigo-700 text-white",
  "bg-fuchsia-700 text-white", "bg-violet-700 text-white",  "bg-pink-700 text-white",    "bg-stone-600 text-white",
];

function getAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLOR_POOL[Math.abs(hash) % COLOR_POOL.length];
}

export default function TripDetailPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { theme, toggleTheme } = useTheme();
  
  // React `use` hook to unwrap params
  const { tripId } = use(params);

  const { isLoaded, getTrip, updateTrip, addTripMember, removeTripMember, refreshTrips, trips } = useTrips();
  const { setBaseCurrency } = useCurrency();
  const contextTrip = getTrip(tripId);

  // Explicit Local State Dispatchers that govern the visible UI
  const [localTrip,          setLocalTrip]          = useState<Trip | undefined>(contextTrip);
  const [activeTab,          setActiveTab]          = useState<"itinerary" | "expenses">("itinerary");
  const [showMembersModal,   setShowMembersModal]   = useState(false);
  const [refreshToggle,      setRefreshToggle]      = useState(0);
  const [activityToDelete,   setActivityToDelete]   = useState<{dayNumber: number; activityId: string; title: string} | null>(null);

  // Keep localTrip synced whenever context mutates (e.g. after updateTrip resolves)
  useEffect(() => {
    if (contextTrip) {
      setLocalTrip(contextTrip);
    }
  }, [contextTrip]);

  // ── Complete Fetch-to-UI Pipeline ─────────────────────────────────────────
  useEffect(() => {
    async function fetchFreshData() {
      console.log("[Debug Screen] Data hydration triggered due to refresh state flip! Active ID:", tripId);
      
      const supabase = createClient();
      
      // Fetch fresh rows from the cloud
      const { data: members, error: membersError } = await supabase
        .from("trip_members")
        .select("id, user_id, temporary_name")
        .eq("trip_id", tripId);

      const { data: tripData } = await supabase
        .from("trips")
        .select("*")
        .eq("id", tripId)
        .single();

      if (members && !membersError) {
        // Map fetched rows into Participant objects
        const freshCompanions = members.map((m: any) => ({
          id: m.user_id || m.id,
          name: m.temporary_name || "Unknown Traveler",
          color: getAvatarColor(m.user_id || m.temporary_name || "Unknown"),
          avatarUrl: undefined,
        }));

        setLocalTrip((prev) => {
          if (!prev) return prev;
          // Preserve avatar URLs by merging over the fresh companion list
          const mergedCompanions = freshCompanions.map(fc => {
            const existing = prev.participants.find(p => p.id === fc.id);
            return existing ? { ...fc, avatarUrl: existing.avatarUrl, name: existing.name } : fc;
          });
          return {
            ...prev,
            title:            tripData?.title            || prev.title,
            startDate:        tripData?.start_date       || prev.startDate,
            endDate:          tripData?.end_date         || prev.endDate,
            notes:            tripData?.notes            !== undefined ? tripData.notes : prev.notes,
            participants:     mergedCompanions,
            days:             tripData?.days             || prev.days,
            expenses:         tripData?.expenses         || prev.expenses,
            customCategories: tripData?.custom_categories || prev.customCategories,
          };
        });
      }

      // Simultaneously trigger the global TripProvider refetch in the background
      refreshTrips();
    }
    
    // Skip initial mount if no flip happened yet (0)
    if (refreshToggle > 0) {
      fetchFreshData();
    }
  }, [tripId, refreshToggle, refreshTrips]);

  // ── Window Focus Re-hydration ─────────────────────────────────────────────
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log("[Focus Sync] Window became active! Executing background re-fetch from Supabase...");
        setRefreshToggle(prev => prev + 1);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [tripId]);

  const baseTrip = localTrip || contextTrip;

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
    if (!baseTrip) return undefined;
    const totalDays = calculateTotalDays(baseTrip.startDate, baseTrip.endDate);
    const hydratedDays = Array.from({ length: totalDays }, (_, i) => {
      const dayNum = i + 1;
      const existing = baseTrip.days.find((d) => d.dayNumber === dayNum);
      if (existing) return existing;

      const dayDate = safeParseDate(baseTrip.startDate);
      if (dayDate) dayDate.setDate(dayDate.getDate() + i);
      const isoDate = dayDate ? dayDate.toISOString().split('T')[0] : "";

      return {
        dayNumber: dayNum,
        date: isoDate,
        activities: []
      };
    });
    return { ...baseTrip, days: hydratedDays };
  }, [baseTrip, calculateTotalDays, safeParseDate]);

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
    refreshTrips(); // Instantly dispatches a hard state refresher callback!
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
    
    // Step 3: Explicitly fire global refresh to sync layout view
    refreshTrips();
  }, [trip, updateTrip, removeTripMember, refreshTrips]);

  // ── Expenses state ────────────────────────────────────────────────────────
  const handleAddExpense    = useCallback(async (e: Expense)  => {
    if (trip) {
      await updateTrip(trip.id, { expenses: [...trip.expenses, e] });
      setRefreshToggle(prev => prev + 1);
    }
  }, [trip, updateTrip]);
  
  const handleEditExpense   = useCallback(async (u: Expense)  => {
    if (trip) {
      await updateTrip(trip.id, { expenses: trip.expenses.map((e) => e.id === u.id ? u : e) });
      setRefreshToggle(prev => prev + 1);
    }
  }, [trip, updateTrip]);

  const handleEditExpenses  = useCallback(async (updates: Expense[])  => {
    if (trip && updates.length > 0) {
      const updateMap = new Map(updates.map(u => [u.id, u]));
      await updateTrip(trip.id, { expenses: trip.expenses.map((e) => updateMap.get(e.id) || e) });
      setRefreshToggle(prev => prev + 1);
    }
  }, [trip, updateTrip]);
  
  const handleDeleteExpense = useCallback(async (id: string)  => {
    if (trip) {
      await updateTrip(trip.id, { expenses: trip.expenses.filter((e) => e.id !== id) });
      setRefreshToggle(prev => prev + 1);
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
    setRefreshToggle(prev => prev + 1);
  }, [trip, updateTrip]);

  const handleEditActivity = useCallback(async (dayNumber: number, updated: ActivityItem) => {
    if (!trip) return;
    const newDays = trip.days.map((day) => {
      if (day.dayNumber !== dayNumber) return day;
      return { ...day, activities: day.activities.map((a) => a.id === updated.id ? updated : a).sort((a, b) => a.time.localeCompare(b.time)) };
    });
    await updateTrip(trip.id, { days: newDays });
    setRefreshToggle(prev => prev + 1);
  }, [trip, updateTrip]);

  const handleDeleteActivity = useCallback(async (dayNumber: number, activityId: string) => {
    if (!trip) return;
    
    // Locate the title for the prompt
    const targetDay = trip.days.find(d => d.dayNumber === dayNumber);
    const targetActivity = targetDay?.activities.find(a => a.id === activityId);
    
    // Instead of window.confirm, trigger our retro modal via state to comply with Design Rules
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
    setRefreshToggle(prev => prev + 1);
    setActivityToDelete(null);
  }, [trip, activityToDelete, updateTrip]);

  // ── Custom Categories state ───────────────────────────────────────────────
  const handleAddCustomCategory = useCallback(async (cat: { id: string; label: string; emoji: string }) => {
    if (!trip) return;
    await updateTrip(trip.id, { customCategories: [...(trip.customCategories || []), cat] });
    setRefreshToggle(prev => prev + 1);
  }, [trip, updateTrip]);

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
          trip={baseTrip!}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onManageMembers={() => setShowMembersModal(true)}
          onRefreshRequest={() => setRefreshToggle(prev => prev + 1)}
        />

        {activeTab === "itinerary" ? (
          <ItineraryTab
            trip={trip}
            onAddActivity={handleAddActivity}
            onEditActivity={handleEditActivity}
            onDeleteActivity={handleDeleteActivity}
            customCategories={trip.customCategories || []}
            onAddCustomCategory={handleAddCustomCategory}
            setRefreshToggle={setRefreshToggle}
          />
        ) : (
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
        )}
      </div>

      {/* Manage Members Modal */}
      {showMembersModal && (
        <ManageMembersModal
          tripId={trip.id}
          participants={trip.participants}
          expenses={trip.expenses}
          onAdd={handleAddMember}
          onRemove={handleRemoveMember}
          onClose={() => setShowMembersModal(false)}
          setRefreshToggle={setRefreshToggle}
        />
      )}

      {/* Custom Retro Deletion Prompt */}
      {activityToDelete && (
        <ConfirmDeleteModal
          itemName="activity"
          title={activityToDelete.title}
          description={
            <>
              Are you sure you want to delete{" "}
              <strong className="text-stone-800 dark:text-red-400">{activityToDelete.title}</strong>?
              This action cannot be undone and it will be removed from your itinerary permanently.
            </>
          }
          onConfirm={executeDeleteActivity}
          onCancel={() => setActivityToDelete(null)}
        />
      )}
    </main>
  );
}
