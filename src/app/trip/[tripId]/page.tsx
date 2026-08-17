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
  const [activeTab,          setActiveTab]          = useState<"itinerary" | "expenses" | "settlement_v2">("itinerary");
  const [showMembersModal,   setShowMembersModal]   = useState(false);
  const [refreshToggle,      setRefreshToggle]      = useState(0);
  const [activityToDelete,   setActivityToDelete]   = useState<{dayNumber: number; activityId: string; title: string} | null>(null);
  const [selectedExpenseDetail, setSelectedExpenseDetail] = useState<any | null>(null);
  const [inspectedMember,    setInspectedMember]    = useState<any | null>(null);

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
            notice:           tripData?.notice           !== undefined ? tripData.notice : prev.notice,
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

  const safeFormatDate = useCallback((dateVal: any, formatStr: string = 'dd/MM/yyyy'): string => {
    if (!dateVal) return '-';
    try {
      const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
      return isNaN(d.getTime()) ? '-' : format(d, formatStr);
    } catch {
      return '-';
    }
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

  const handleEditActivity = useCallback(async (newDayNumber: number, updated: ActivityItem) => {
    if (!trip) return;

    // Step 1: Remove the activity from whichever day currently holds it (search by ID).
    // This correctly handles day-change edits where the source day ≠ newDayNumber.
    const withRemoved = trip.days.map((day) => ({
      ...day,
      activities: day.activities.filter((a) => a.id !== updated.id),
    }));

    // Step 2: Insert the updated activity into the target day and re-sort by time.
    const newDays = withRemoved.map((day) => {
      if (day.dayNumber !== newDayNumber) return day;
      return {
        ...day,
        activities: [...day.activities, updated].sort((a, b) => a.time.localeCompare(b.time)),
      };
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

  // ── Day Reordering (Drag-and-Drop) ────────────────────────────────────────
  const handleReorderDays = useCallback(async (reorderedDays: import("@/types/trip").DayPlan[]) => {
    if (!trip) return;
    // Renumber dayNumber fields to match new visual positions (1-based)
    const renumbered = reorderedDays.map((day, idx) => ({ ...day, dayNumber: idx + 1 }));
    // Optimistic local update first
    setLocalTrip((prev) => prev ? { ...prev, days: renumbered } : prev);
    // Then persist to Supabase via updateTrip
    await updateTrip(trip.id, { days: renumbered });
  }, [trip, updateTrip, setLocalTrip]);

  const handleUpdateDays = useCallback(async (newDays: import("@/types/trip").DayPlan[]) => {
    if (!trip) return;
    setLocalTrip((prev) => prev ? { ...prev, days: newDays } : prev);
    await updateTrip(trip.id, { days: newDays });
  }, [trip, updateTrip, setLocalTrip]);



  const handleToggleSettle = async (expenseId: string, participantId: string, currentStatus: boolean) => {
    if (!trip) return;
    try {
      const expense: any = trip.expenses.find((e: any) => e.id === expenseId);
      if (!expense) return;
      const splitsArray = expense.split_members || expense.splits || [];
      if (!Array.isArray(splitsArray)) return;

      const updatedSplits = splitsArray.map((s: any) => {
        const sId = String(s?.participantId || s?.id || s).trim();
        if (sId === participantId) {
          return {
            ...(typeof s === 'object' ? s : { participantId: sId }),
            isSettled: !currentStatus,
          };
        }
        return s;
      });

      // Update in Supabase
      const supabase = createClient();
      const { error } = await supabase
        .from('expenses')
        .update({ split_members: updatedSplits, splits: updatedSplits })
        .eq('id', expenseId);

      if (error) throw error;

      // Optimistic UI state update
      setLocalTrip((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          expenses: prev.expenses.map((e: any) => e.id === expenseId ? { ...e, split_members: updatedSplits, splits: updatedSplits } : e)
        };
      });

      // Also update selected expense state if open
      if (selectedExpenseDetail?.id === expenseId) {
        setSelectedExpenseDetail((prev: any) => ({ ...prev, split_members: updatedSplits, splits: updatedSplits }));
      }
    } catch (err) {
      console.error("Error toggling settle status:", err);
    }
  };

  const isSharedExpense = (e: any): boolean => {
    if (!e || !Array.isArray(e.split_members) || e.split_members.length === 0) return false;
    const payerId = String(e.paid_by || '').trim();
    if (e.split_members.length > 1) return true;
    const singleId = String(e.split_members[0]?.participantId || e.split_members[0]?.id || e.split_members[0] || '').trim();
    return singleId !== payerId;
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
            onReorderDays={handleReorderDays}
            onUpdateDays={handleUpdateDays}
            customCategories={trip.customCategories || []}
            onAddCustomCategory={handleAddCustomCategory}
            setRefreshToggle={setRefreshToggle}
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
        ) : activeTab === "settlement_v2" ? (
          <div className="space-y-6 pb-20">
            {/* 1. Debug / Verified Header */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-900 text-sm">
              <h3 className="font-bold text-base mb-1">⚡ Settlement System #2 (Fresh Engine)</h3>
              <p className="text-xs text-blue-700">ระบบคำนวณแยกอิสระ แมป participantId ตรงจากฐานข้อมูล</p>
            </div>

            {/* 2. Calculation Logic */}
            {(() => {
              const members = trip.participants;
              const expenses = (trip.expenses || []).filter(isSharedExpense);

              // Helper: Convert to THB
              const toTHB = (e: any): number => {
                if (!e) return 0;
                if (e.currency === 'THB' || !e.currency) return Number(e.amount) || 0;
                const rate = Number(e.custom_exchange_rate) > 0 
                  ? Number(e.custom_exchange_rate) 
                  : (Number(e.exchange_rate) > 0 && Number(e.exchange_rate) !== 1 ? Number(e.exchange_rate) : 0.209096);
                const raw = Number(e.foreign_amount) > 0 ? Number(e.foreign_amount) : (Number(e.amount) || 0);
                return raw * rate;
              };

              // Balance Computation
              const balances = (members || []).map((m) => {
                const mId = String(m.id).trim();

                // A. Only sum shared expenses paid by this member
                const totalPaid = (expenses || [])
                  .filter((e: any) => isSharedExpense(e) && String(e.paid_by || '').trim() === mId)
                  .reduce((sum, e: any) => sum + toTHB(e), 0);

                // B. Only sum shared expenses consumed by this member
                const totalShare = (expenses || []).filter(isSharedExpense).reduce((sum, e: any) => {
                  const splits = Array.isArray(e.split_members) ? e.split_members : [];
                  const mySplit = splits.find((s: any) => String(s?.participantId || s?.id || s).trim() === mId);
                  if (!mySplit) return sum;

                  const rate = (e.currency !== 'THB' && e.currency) 
                    ? (Number(e.custom_exchange_rate) || Number(e.exchange_rate) || 0.209096) 
                    : 1;

                  if (typeof mySplit === 'object' && mySplit.amount !== undefined) {
                    return sum + (Number(mySplit.amount) * rate);
                  }
                  return sum + (toTHB(e) / (splits.length || 1));
                }, 0);

                const net = Math.round((totalPaid - totalShare) * 100) / 100;

                return {
                  id: mId,
                  name: m.name,
                  paid: Math.round(totalPaid * 100) / 100,
                  share: Math.round(totalShare * 100) / 100,
                  net: net,
                };
              });

              // Transfers (Debtor -> Creditor)
              let debtors = balances.filter((b) => b.net < -0.01).map((b) => ({ ...b, remaining: Math.abs(b.net) }));
              let creditors = balances.filter((b) => b.net > 0.01).map((b) => ({ ...b, remaining: b.net }));
              const transfers: Array<{ from: string; to: string; amount: number }> = [];

              for (const d of debtors) {
                for (const c of creditors) {
                  if (d.remaining <= 0.01 || c.remaining <= 0.01) continue;
                  const settleAmt = Math.min(d.remaining, c.remaining);
                  d.remaining -= settleAmt;
                  c.remaining -= settleAmt;
                  transfers.push({
                    from: d.name,
                    to: c.name,
                    amount: Math.round(settleAmt * 100) / 100,
                  });
                }
              }

              return (
                <div className="space-y-4">
                  {/* Transfer Plan */}
                  <div className="bg-white rounded-2xl p-5 border shadow-sm">
                    <h4 className="font-semibold text-gray-800 text-sm mb-3">💸 แผนการโอนเงิน (Transfer Plan)</h4>
                    {transfers.length === 0 ? (
                      <p className="text-gray-500 text-sm text-center py-3">ยอดเคลียร์ครบถ้วนแล้ว 🎉</p>
                    ) : (
                      <div className="space-y-2">
                        {transfers.map((t, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-100 text-sm">
                            <span className="font-medium text-amber-950">
                              <strong>{t.from}</strong> 👉 โอนให้ 👉 <strong>{t.to}</strong>
                            </span>
                            <span className="font-bold text-amber-900">
                              ฿{t.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Member Balances (Debtors Only) */}
                  <div className="grid grid-cols-1 gap-3">
                    {balances.filter((b) => b.net < -0.01).length === 0 ? (
                      <p className="text-gray-500 text-sm text-center py-3 bg-white rounded-xl border border-dashed border-gray-300">ทุกคนเคลียร์ยอดครบถ้วนแล้ว ไม่มีหนี้ค้างชำระ 🎉</p>
                    ) : (
                      balances.filter((b) => b.net < -0.01).map((b) => {
                        return (
                          <div 
                            key={b.id} 
                            onClick={() => setInspectedMember(b)}
                            className="bg-white rounded-2xl p-4 border shadow-sm cursor-pointer hover:border-blue-400 hover:shadow-md transition-all"
                          >
                            <div className="flex justify-between items-center mb-3">
                              <span className="font-bold text-gray-900">{b.name}</span>
                              <span className="text-xs px-3 py-1 rounded-full font-semibold bg-rose-50 text-rose-600 border border-rose-200">
                                ต้องจ่ายเงิน: ฿{Math.abs(b.net).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </span>
                            </div>

                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5 mb-2">
                              <div className="flex justify-between text-slate-600">
                                <span>+ ยอดสำรองจ่ายไป (Paid):</span>
                                <span className="font-semibold text-emerald-600">+฿{b.paid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                              </div>
                              <div className="flex justify-between text-slate-600">
                                <span>- ยอดส่วนตัวที่ร่วมหาร (Share):</span>
                                <span className="font-semibold text-rose-600">-฿{b.share.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                              </div>
                              <div className="flex justify-between pt-1.5 border-t border-slate-200 font-bold text-gray-900">
                                <span>= ยอดสุทธิที่ต้องโอนชำระ (Net):</span>
                                <span className="text-rose-600">-฿{Math.abs(b.net).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                              </div>
                            </div>

                            <div className="flex justify-end text-xs">
                              <span className="text-blue-500 font-medium hover:text-blue-700 flex items-center gap-1">
                                🔍 ดูประวัติ
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Expense Breakdown List */}
                  <div className="bg-white rounded-2xl p-5 border shadow-sm mt-6">
                    <h4 className="font-semibold text-gray-800 text-sm mb-3">📋 รายการค่าใช้จ่ายทั้งหมด ({expenses.length} รายการ)</h4>
                    <div className="space-y-2">
                      {expenses.map((expense: any) => {
                        const payer = members?.find(m => String(m.id).trim() === String(expense.paid_by || expense.paidById || expense.payer_id || '').trim())?.name || 'Unknown';
                        const thbAmt = toTHB(expense);
                        const isForeign = expense.currency && expense.currency !== 'THB';
                        const splitCount = Array.isArray(expense.split_members || expense.splits) ? (expense.split_members || expense.splits).length : 1;

                        return (
                          <div key={expense.id} className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden hover:bg-gray-100 transition-colors">
                            <div
                              className="flex items-center justify-between p-3"
                            >
                              <div className="flex flex-col">
                                <span className="font-semibold text-gray-800 text-sm">{expense.title || expense.description || 'Expense'}</span>
                                <span className="text-xs text-gray-500">
                                  จ่ายโดย {payer} • หาร {splitCount} คน
                                </span>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="font-bold text-gray-900">
                                  ฿{thbAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </span>
                                {isForeign && (
                                  <span className="text-[10px] text-gray-400">
                                    {Number(expense.foreign_amount || expense.foreignAmount || expense.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} {expense.currency}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* Expanded Splits View */}
                            <div className="border-t border-gray-100 bg-white p-3 space-y-2">
                              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Split Breakdown</h4>
                              {(expense.split_members || expense.splits || []).map((split: any, idx: number) => {
                                const memberId = String(split.participantId || split.id || split).trim();
                                const memberName = members?.find(m => String(m.id).trim() === memberId)?.name || 'Member';
                                
                                let amt = 0;
                                if (typeof split === 'object' && split.amount !== undefined) {
                                  const rate = (expense.currency !== 'THB' && expense.currency) 
                                    ? (Number(expense.custom_exchange_rate) || Number(expense.exchange_rate) || 0.209096) 
                                    : 1;
                                  amt = Number(split.amount) * rate;
                                } else {
                                  const splitsLen = (expense.split_members || expense.splits || []).length || 1;
                                  amt = toTHB(expense) / splitsLen;
                                }
                                
                                const isSettled = typeof split === 'object' ? split.isSettled : false;

                                return (
                                  <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                                    <span className={`text-sm ${isSettled ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{memberName}</span>
                                    <div className="flex items-center gap-3">
                                      <span className={`text-sm font-semibold ${isSettled ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                        ฿{amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                      </span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleToggleSettle(expense.id, memberId, isSettled);
                                        }}
                                        className={`flex px-2 py-1 items-center justify-center border rounded-md transition-all text-xs font-medium ${
                                          isSettled
                                            ? "border-[#4a7c59] bg-[#4a7c59] text-[#fdfbf7]"
                                            : "border-gray-300 bg-white hover:border-gray-400 text-gray-700"
                                        }`}
                                      >
                                        {isSettled ? '✅ เคลียร์แล้ว' : '⚪ กดเคลียร์'}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : null}
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
          description={`Are you sure you want to delete "${activityToDelete.title}"? This action cannot be undone and it will be removed from your itinerary permanently.`}
          onConfirm={executeDeleteActivity}
          onCancel={() => setActivityToDelete(null)}
        />
      )}

      {/* Expense Detail Modal */}
      {selectedExpenseDetail && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setSelectedExpenseDetail(null)}
        >
          <div 
            className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-900 text-lg">{selectedExpenseDetail.title || selectedExpenseDetail.description || 'Expense'}</h3>
              <button 
                onClick={() => setSelectedExpenseDetail(null)}
                className="text-gray-400 hover:text-gray-600 text-lg p-1"
              >
                ✕
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-1">ยอดจัดเก็บ</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900">
                  {(() => {
                    const toTHB = (e: any): number => {
                      if (!e) return 0;
                      if (e.currency === 'THB' || !e.currency) return Number(e.amount) || 0;
                      const rate = Number(e.custom_exchange_rate) > 0 
                        ? Number(e.custom_exchange_rate) 
                        : (Number(e.exchange_rate) > 0 && Number(e.exchange_rate) !== 1 ? Number(e.exchange_rate) : 0.209096);
                      const raw = Number(e.foreign_amount) > 0 ? Number(e.foreign_amount) : (Number(e.amount) || 0);
                      return raw * rate;
                    };
                    return `฿${toTHB(selectedExpenseDetail).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
                  })()}
                </span>
                {selectedExpenseDetail.currency && selectedExpenseDetail.currency !== 'THB' && (
                  <span className="text-xs text-gray-500">
                    ({Number(selectedExpenseDetail.foreign_amount || selectedExpenseDetail.foreignAmount || selectedExpenseDetail.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} {selectedExpenseDetail.currency})
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                {(() => {
                  const name = trip.participants.find(m => String(m.id).trim() === String(selectedExpenseDetail.paid_by || selectedExpenseDetail.paidById || selectedExpenseDetail.payer_id || '').trim())?.name || 'U';
                  return name.charAt(0).toUpperCase();
                })()}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Paid By</span>
                <span className="text-sm font-semibold text-gray-800">
                  {trip.participants.find(m => String(m.id).trim() === String(selectedExpenseDetail.paid_by || selectedExpenseDetail.paidById || selectedExpenseDetail.payer_id || '').trim())?.name || 'Unknown'}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Split Breakdown</h4>
              {(selectedExpenseDetail.split_members || selectedExpenseDetail.splits || []).map((split: any, idx: number) => {
                const memberId = String(split.participantId || split.id || split).trim();
                const memberName = trip.participants.find(m => String(m.id).trim() === memberId)?.name || 'Member';
                
                let amt = 0;
                if (typeof split === 'object' && split.amount !== undefined) {
                  const rate = (selectedExpenseDetail.currency !== 'THB' && selectedExpenseDetail.currency) 
                    ? (Number(selectedExpenseDetail.custom_exchange_rate) || Number(selectedExpenseDetail.exchange_rate) || 0.209096) 
                    : 1;
                  amt = Number(split.amount) * rate;
                } else {
                  const splitsLen = (selectedExpenseDetail.split_members || selectedExpenseDetail.splits || []).length || 1;
                  const toTHB = (e: any): number => {
                    if (!e) return 0;
                    if (e.currency === 'THB' || !e.currency) return Number(e.amount) || 0;
                    const rate = Number(e.custom_exchange_rate) > 0 
                      ? Number(e.custom_exchange_rate) 
                      : (Number(e.exchange_rate) > 0 && Number(e.exchange_rate) !== 1 ? Number(e.exchange_rate) : 0.209096);
                    const raw = Number(e.foreign_amount) > 0 ? Number(e.foreign_amount) : (Number(e.amount) || 0);
                    return raw * rate;
                  };
                  amt = toTHB(selectedExpenseDetail) / splitsLen;
                }
                const isSettled = typeof split === 'object' ? split.isSettled : false;

                return (
                  <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                    <span className={`text-sm ${isSettled ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{memberName}</span>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-semibold ${isSettled ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                        ฿{amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSettle(selectedExpenseDetail.id, memberId, isSettled);
                        }}
                        className={`flex h-5 w-5 items-center justify-center border-2 rounded-md transition-all ${
                          isSettled
                            ? "border-[#4a7c59] bg-[#4a7c59] text-[#fdfbf7]"
                            : "border-gray-300 bg-white hover:border-gray-400"
                        }`}
                      >
                        {isSettled && (
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="2,6 5,9 10,3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Inspected Member Modal */}
      {inspectedMember && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={() => setInspectedMember(null)}
        >
          <div 
            className="bg-white rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4 pb-3 border-b">
              <div>
                <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                  <span>{inspectedMember.name}</span>
                </h3>
                <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded font-semibold ${
                  inspectedMember.net > 0.01 
                    ? 'bg-emerald-100 text-emerald-700' 
                    : inspectedMember.net < -0.01 
                    ? 'bg-rose-100 text-rose-700' 
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {inspectedMember.net > 0.01 && `ยอดรับคืน: +฿${inspectedMember.net.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                  {inspectedMember.net < -0.01 && `ยอดค้างจ่าย: -฿${Math.abs(inspectedMember.net).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                  {Math.abs(inspectedMember.net) <= 0.01 && 'ยอดสุทธิลงตัว: ฿0.00'}
                </span>
              </div>
              <button 
                onClick={() => setInspectedMember(null)}
                className="text-gray-400 hover:text-gray-600 text-xl p-1 h-8 w-8 flex items-center justify-center bg-gray-100 rounded-full"
              >
                ✕
              </button>
            </div>
            
            {(() => {
              const mId = inspectedMember.id;
              
              const toTHB = (e: any): number => {
                if (!e) return 0;
                if (e.currency === 'THB' || !e.currency) return Number(e.amount) || 0;
                const rate = Number(e.custom_exchange_rate) > 0 
                  ? Number(e.custom_exchange_rate) 
                  : (Number(e.exchange_rate) > 0 && Number(e.exchange_rate) !== 1 ? Number(e.exchange_rate) : 0.209096);
                const raw = Number(e.foreign_amount) > 0 ? Number(e.foreign_amount) : (Number(e.amount) || 0);
                return raw * rate;
              };

              // Paid Out-of-Pocket
              const paidExpenses = (trip.expenses || [])
                .filter(isSharedExpense)
                .filter((e: any) => String(e.paid_by || e.paidById || e.payer_id || '').trim() === mId);
              
              // Consumed Share
              const sharedExpenses = (trip.expenses || [])
                .filter(isSharedExpense)
                .map((e: any) => {
                const splits = Array.isArray(e.split_members) ? e.split_members : (Array.isArray(e.splits) ? e.splits : []);
                const mySplit = splits.find((s: any) => String(s?.participantId || s?.id || s).trim() === mId);
                if (!mySplit) return null;

                let shareAmt = 0;
                if (typeof mySplit === 'object' && mySplit.amount !== undefined) {
                  const rate = (e.currency !== 'THB' && e.currency) 
                    ? (Number(e.custom_exchange_rate) || Number(e.exchange_rate) || 0.209096) 
                    : 1;
                  shareAmt = Number(mySplit.amount) * rate;
                } else {
                  shareAmt = toTHB(e) / (splits.length || 1);
                }
                return { expense: e, shareAmt };
              }).filter(Boolean) as { expense: any; shareAmt: number }[];

              return (
                <div className="space-y-6">
                  {/* Section A: Paid Out-of-Pocket */}
                  <div>
                    <h4 className="font-semibold text-blue-800 text-sm mb-2 flex items-center gap-2">
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">A</span> 
                      รายการที่จ่ายออกไป (Paid Out-of-Pocket)
                    </h4>
                    {paidExpenses.length === 0 ? (
                      <p className="text-xs text-gray-400 italic px-2">ไม่มีรายการที่สำรองจ่าย</p>
                    ) : (
                      <div className="space-y-2">
                        {paidExpenses.map((e: any) => (
                          <div key={e.id} className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                            <div>
                              <p className="text-gray-800 font-medium">{e.title || e.description || 'Expense'}</p>
                              <p className="text-[10px] text-gray-500">{new Date(e.date || e.created_at || Date.now()).toLocaleDateString('en-GB')}</p>
                            </div>
                            <span className="font-semibold text-blue-700">฿{toTHB(e).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 text-right text-xs text-gray-500 font-medium">
                      รวมยอดสำรองจ่าย: <strong className="text-blue-700 text-sm">฿{inspectedMember.paid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                    </div>
                  </div>

                  {/* Section B: Consumed Share */}
                  <div>
                    <h4 className="font-semibold text-rose-800 text-sm mb-2 flex items-center gap-2">
                      <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-xs font-bold">B</span> 
                      รายการที่ร่วมหาร (Consumed Share)
                    </h4>
                    {sharedExpenses.length === 0 ? (
                      <p className="text-xs text-gray-400 italic px-2">ไม่มีรายการที่ต้องหาร</p>
                    ) : (
                      <div className="space-y-2">
                        {sharedExpenses.map(({ expense, shareAmt }: { expense: any; shareAmt: number }) => {
                          const split = (expense.split_members || expense.splits).find((s: any) => String(s?.participantId || s?.id || s).trim() === mId);
                          const isSettled = split?.isSettled || false;
                          
                          return (
                          <div key={expense.id} className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                            <div>
                              <p className={`font-medium ${isSettled ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{expense.title || expense.description || 'Expense'}</p>
                              <p className="text-[10px] text-gray-500">ยอดบิลเต็ม: ฿{toTHB(expense).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`font-semibold ${isSettled ? 'text-gray-400 line-through' : 'text-rose-600'}`}>฿{shareAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleSettle(expense.id, mId, isSettled);
                                }}
                                className={`flex h-5 w-5 items-center justify-center border-2 rounded-md transition-all ${
                                  isSettled
                                    ? "border-[#4a7c59] bg-[#4a7c59] text-[#fdfbf7]"
                                    : "border-gray-300 bg-white hover:border-gray-400"
                                }`}
                              >
                                {isSettled && (
                                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="2,6 5,9 10,3" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="mt-2 text-right text-xs text-gray-500 font-medium">
                      รวมยอดที่ต้องรับผิดชอบ: <strong className="text-rose-600 text-sm">฿{inspectedMember.share.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                    </div>
                  </div>

                  {/* Summary Footer */}
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mt-4">
                    <p className="text-xs text-center text-gray-500 mb-1">สรุปการคำนวณยอดสุทธิ (A - B)</p>
                    <p className="text-center font-mono text-sm font-semibold text-gray-800 flex items-center justify-center flex-wrap gap-2">
                      <span>ยอดจ่าย <span className="text-blue-600">฿{inspectedMember.paid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></span>
                      <span className="text-gray-400">-</span>
                      <span>ยอดหาร <span className="text-rose-600">฿{inspectedMember.share.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></span>
                      <span className="text-gray-400">=</span>
                      <span className={inspectedMember.net > 0.01 ? 'text-emerald-600' : inspectedMember.net < -0.01 ? 'text-rose-600' : 'text-gray-900'}>
                        ฿{inspectedMember.net.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </main>
  );
}
