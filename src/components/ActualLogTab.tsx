"use client";

import { useState, useEffect, useCallback } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { createClient } from "@/utils/supabase/client";
import { DayPlan } from "@/types/trip";
import { addDaysToISO } from "@/lib/utils";
import EditActualModal from "./EditActualModal";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ActualLogEntry {
  id: string;
  trip_id: string;
  day_number: number;
  from_time: string | null;
  to_time: string | null;
  details: string;
  created_at: string;
}

interface ActualLogTabProps {
  tripId: string;
  days: DayPlan[];
  tripStartDate: string;
}

// ─── Utility helpers ───────────────────────────────────────────────────────────

function safeArr(arr: ActualLogEntry[] | undefined | null): ActualLogEntry[] {
  return Array.isArray(arr) ? arr : [];
}

function safeDays(d: DayPlan[] | undefined | null): DayPlan[] {
  return Array.isArray(d) ? d : [];
}

/**
 * Compute a day's ISO date string from trip start date + offset.
 * Delegates to addDaysToISO which uses timezone-safe local-date math.
 */
function computeDateForDay(tripStartDate: string, dayNum: number): string {
  return addDaysToISO(tripStartDate, dayNum - 1);
}

function buildDayLabel(dayNum: number, tripStartDate: string): string {
  const isoDate = computeDateForDay(tripStartDate, dayNum);
  const dt = new Date(isoDate + "T00:00:00");
  const dd   = String(dt.getDate()).padStart(2, "0");
  const mm   = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  return `Day ${dayNum}  ·  ${dd}/${mm}/${yyyy}`;
}

function buildDisplayDate(isoDate: string): string {
  return new Date(isoDate + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day:     "2-digit",
    month:   "long",
    year:    "numeric",
  });
}

function buildTimeRange(from: string | null, to: string | null): string {
  const f = (from ?? "").trim();
  const t = (to   ?? "").trim();
  if (f && t) return `${f} – ${t}`;
  if (f)      return f;
  if (t)      return `until ${t}`;
  return "—";
}

function autoColon(raw: string, prev: string): string {
  let v = raw.replace(/[^\d:]/g, "");
  if (v.length === 2 && !v.includes(":") && prev.length === 1) v = v + ":";
  return v.slice(0, 5);
}

// ─── Shared CSS ────────────────────────────────────────────────────────────────

const INPUT =
  "w-full border-2 border-stone-400 bg-[#fdfbf7] px-3 py-2 font-mono text-xs " +
  "text-stone-900 placeholder-stone-400 outline-none focus:border-stone-800 " +
  "dark:border-stone-600 dark:bg-[#28211d] dark:text-[#fdfbf7] " +
  "dark:placeholder-stone-500 dark:focus:border-[#f5ebd5]";

// ─── Component ──────────────────────────────────────────────────────────────────

export default function ActualLogTab({ tripId, days, tripStartDate }: ActualLogTabProps) {

  // ── Core data state ───────────────────────────────────────────────────────────
  const [entries,      setEntries]      = useState<ActualLogEntry[]>([]);
  const [isLoading,    setIsLoading]    = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [fetchError,   setFetchError]   = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<ActualLogEntry | null>(null);
  // ID of the entry pending deletion confirmation
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // ── Day accordion state — Set of day_number values that are expanded ───────────
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());

  // ── Form state ────────────────────────────────────────────────────────────────
  const [selectedDay, setSelectedDay] = useState<string>(
    String(safeDays(days)[0]?.dayNumber ?? 1)
  );
  const [fromTime,    setFromTime]    = useState<string>("");
  const [toTime,      setToTime]      = useState<string>("");
  const [details,     setDetails]     = useState<string>("");
  const [formError,   setFormError]   = useState<string>("");

  // ── Toggle a day section open / closed ────────────────────────────────────────
  function toggleDay(dayNum: number) {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayNum)) {
        next.delete(dayNum);
      } else {
        next.add(dayNum);
      }
      return next;
    });
  }

  // ── Fetch entries from Supabase ───────────────────────────────────────────────
  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const sb = createClient();
      const { data, error } = await sb
        .from("actual_logs")
        .select("id, trip_id, day_number, from_time, to_time, details, created_at")
        .eq("trip_id", tripId)
        .order("day_number", { ascending: true })
        .order("from_time",  { ascending: true, nullsFirst: true });

      if (error) {
        console.warn("[ActualLogTab] fetch error:", error.message, error.details ?? "");
        setFetchError(`Database error — ${error.message}`);
        setEntries([]);
        return;
      }

      const safe = safeArr(data as ActualLogEntry[]);
      setEntries(safe);

      // Days are left collapsed by default on initial load
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[ActualLogTab] unexpected fetch error:", msg);
      setFetchError(`Unexpected error — ${msg}`);
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // ── Submit new entry ──────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!details.trim()) {
      setFormError("Details field cannot be empty.");
      return;
    }
    setFormError("");
    setIsSubmitting(true);

    const dayInt = parseInt(selectedDay, 10);
    if (isNaN(dayInt)) {
      setFormError("Invalid day selection.");
      setIsSubmitting(false);
      return;
    }

    try {
      const sb = createClient();
      const payload = {
        trip_id:    tripId,
        day_number: dayInt,
        from_time:  fromTime.trim() || null,
        to_time:    toTime.trim()   || null,
        details:    details.trim(),
      };

      const { data, error } = await sb
        .from("actual_logs")
        .insert([payload])
        .select("id, trip_id, day_number, from_time, to_time, details, created_at")
        .single();

      if (error) {
        console.warn("[ActualLogTab] insert error:", error.message);
        setFormError(`Failed to save — ${error.message}`);
        return;
      }

      if (data) {
        setEntries((prev) =>
          [...safeArr(prev), data as ActualLogEntry].sort((a, b) => {
            if (a.day_number !== b.day_number) return a.day_number - b.day_number;
            return (a.from_time ?? "").localeCompare(b.from_time ?? "");
          })
        );
        // Ensure the day section the new entry belongs to is expanded
        setExpandedDays((prev) => new Set([...prev, dayInt]));
      }

      setFromTime("");
      setToTime("");
      setDetails("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[ActualLogTab] unexpected insert error:", msg);
      setFormError(`Unexpected error — ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Edit save ────────────────────────────────────────────────────────────────
  const handleEditSave = async (id: string, updates: Partial<ActualLogEntry>) => {
    const sb = createClient();
    const { data, error } = await sb.from("actual_logs").update(updates).eq("id", id).select("*").single();
    if (error) {
      throw new Error(error.message);
    }
    if (data) {
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...data } : e)));
    }
  };

  // ── Delete an entry ───────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    try {
      const sb = createClient();
      const { error } = await sb.from("actual_logs").delete().eq("id", id);
      if (error) {
        console.warn("[ActualLogTab] delete error:", error.message);
        return;
      }
      setEntries((prev) => safeArr(prev).filter((e) => e.id !== id));
    } catch (err: unknown) {
      console.error("[ActualLogTab] unexpected delete error:", err);
    }
  };

  // ── Drag-and-Drop: move log entries across or within day groups ──────────────
  const handleDragEnd = useCallback(async (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination } = result;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const sourceDayNum = parseInt(source.droppableId, 10);
    const destDayNum   = parseInt(destination.droppableId, 10);

    // Build a flat snapshot of the current entries
    const allEntries = safeArr(entries);

    // Group by day preserving current order
    const grouped: Record<number, ActualLogEntry[]> = {};
    for (const e of allEntries) {
      const k = Number(e.day_number);
      if (!grouped[k]) grouped[k] = [];
      grouped[k].push(e);
    }

    const sourceList = [...(grouped[sourceDayNum] ?? [])];
    const destList   = sourceDayNum === destDayNum ? sourceList : [...(grouped[destDayNum] ?? [])];

    const [movedEntry] = sourceList.splice(source.index, 1);
    // Construct a brand new object so React detects the reference change
    const updatedEntry: ActualLogEntry = { ...movedEntry, day_number: destDayNum };
    destList.splice(destination.index, 0, updatedEntry);

    // Build new full entries array immutably
    const newGrouped = { ...grouped, [sourceDayNum]: sourceList, [destDayNum]: destList };
    const newEntries = Object.values(newGrouped).flat();

    // Optimistic UI update immediately
    setEntries(newEntries);

    // Expand destination day so user sees the dropped card
    setExpandedDays((prev) => new Set([...prev, destDayNum]));

    // Persist to Supabase (strictly schema-compliant: only update day_number)
    try {
      const sb = createClient();
      const { error } = await sb
        .from("actual_logs")
        .update({ day_number: destDayNum })
        .eq("id", movedEntry.id);

      if (error) {
        console.warn("[ActualLogTab] drag-update error:", error.message);
        // Rollback on failure
        setEntries(allEntries);
      }
    } catch (err) {
      console.error("[ActualLogTab] unexpected drag-update error:", err);
      setEntries(allEntries);
    }
  }, [entries]);

  // ── Derived: group safe entries by day_number ─────────────────────────────────
  const safeEntries = safeArr(entries);

  const grouped = safeEntries.reduce<Record<number, ActualLogEntry[]>>((acc, entry) => {
    const k = Number(entry.day_number) || 0;
    if (!acc[k]) acc[k] = [];
    acc[k].push(entry);
    return acc;
  }, {});

  // Ensure all planned days are shown (even if empty), plus any extra days with entries
  const plannedDayNums = safeDays(days).map((d) => d.dayNumber);
  const entryDayNums   = Object.keys(grouped).map(Number);
  const allDayNums     = Array.from(new Set([...plannedDayNums, ...entryDayNums])).sort((a, b) => a - b);

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div>

      {/* ───────────────────────── ENTRY FORM ──────────────────────────────── */}
      <div className="mb-6 border-4 border-stone-800 dark:border-[#54463d] bg-[#f5eed7] dark:bg-[#1e1815] shadow-[4px_4px_0_#292524] dark:shadow-[4px_4px_0_#1e1815]">

        <div className="flex items-center gap-2 border-b-4 border-stone-800 dark:border-[#54463d] bg-[#e8dcc4] dark:bg-[#362d28] px-4 py-2.5">
          <span className="font-pixel text-[9px] uppercase tracking-widest text-stone-800 dark:text-[#fdfbf7]">
            📜 Log an Actual Event
          </span>
        </div>

        <div className="p-4 space-y-3">

          {/* Row 1 — Day · FROM · TO */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">

            <div>
              <label className="mb-1.5 block font-pixel text-[7px] uppercase tracking-widest text-stone-600 dark:text-stone-400">
                Day / Date
              </label>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className={INPUT}
              >
                {safeDays(days).map((day) => (
                  <option key={day.dayNumber} value={String(day.dayNumber)}>
                    {buildDayLabel(day.dayNumber, tripStartDate)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block font-pixel text-[7px] uppercase tracking-widest text-stone-600 dark:text-stone-400">
                From <span className="normal-case font-mono text-stone-400">(HH:MM)</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={5}
                placeholder="00:00"
                value={fromTime}
                onChange={(e) => setFromTime(autoColon(e.target.value, fromTime))}
                className={INPUT}
              />
            </div>

            <div>
              <label className="mb-1.5 block font-pixel text-[7px] uppercase tracking-widest text-stone-600 dark:text-stone-400">
                To <span className="normal-case font-mono text-stone-400">(HH:MM)</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={5}
                placeholder="23:59"
                value={toTime}
                onChange={(e) => setToTime(autoColon(e.target.value, toTime))}
                className={INPUT}
              />
            </div>
          </div>

          {/* Row 2 — Details · Submit */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block font-pixel text-[7px] uppercase tracking-widest text-stone-600 dark:text-stone-400">
                What Actually Happened? *
              </label>
              <input
                type="text"
                placeholder="e.g. Missed the train, grabbed local ramen instead..."
                value={details}
                onChange={(e) => { setDetails(e.target.value); setFormError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                className={INPUT}
              />
            </div>
            <div className="flex flex-col justify-end">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="game-btn flex items-center gap-1.5 whitespace-nowrap px-4 py-2 font-pixel text-[8px] uppercase tracking-wider bg-[#4a7c59] text-[#fdfbf7] dark:bg-[#2d5a3d] disabled:opacity-50"
              >
                {isSubmitting ? "Saving…" : "＋ Log Actual"}
              </button>
            </div>
          </div>

          {formError && (
            <p className="font-mono text-[10px] text-red-600 dark:text-red-400">
              {formError}
            </p>
          )}
        </div>
      </div>

      {/* ── Delete Confirmation Dialog ─────────────────────────────────── */}
      {pendingDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4"
          onClick={(e) => e.target === e.currentTarget && setPendingDeleteId(null)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setPendingDeleteId(null)} />

          {/* Dialog panel */}
          <div className="relative w-full max-w-sm border-4 border-stone-800 bg-[#f4ecd8] shadow-[8px_8px_0_#292524] dark:border-[#54463d] dark:bg-[#28211d] dark:shadow-[8px_8px_0_#1e1815] animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 fade-in duration-200">

            {/* Header */}
            <div className="flex items-center gap-3 border-b-4 border-stone-800 bg-[#e8dcc4] px-5 py-4 dark:border-[#54463d] dark:bg-[#362d28]">
              <span className="text-xl">🗑️</span>
              <div className="min-w-0">
                <h2 className="font-pixel text-[11px] uppercase tracking-wider text-stone-900 dark:text-[#fdfbf7]">
                  Delete Activity
                </h2>
                <p className="mt-0.5 font-mono text-[9px] text-stone-500 dark:text-stone-400">
                  ยืนยันการลบ
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="px-5 py-5 space-y-1">
              <p className="font-mono text-sm text-stone-800 dark:text-[#fdfbf7] leading-relaxed">
                Are you sure you want to delete this log entry?
              </p>
              <p className="font-mono text-xs text-stone-500 dark:text-stone-400">
                This action cannot be undone.
              </p>
              <p className="font-mono text-[10px] text-stone-400 dark:text-stone-500 pt-1">
                คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 border-t-2 border-stone-300 px-5 py-4 dark:border-stone-700">
              <button
                type="button"
                onClick={() => setPendingDeleteId(null)}
                className="game-btn flex-1 border-2 border-stone-800 bg-[#fdfbf7] py-3 font-pixel text-[9px] uppercase tracking-wider text-stone-800 hover:bg-[#e8dcc4] dark:border-[#54463d] dark:bg-[#1e1815] dark:text-[#fdfbf7] dark:hover:bg-[#362d28]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = pendingDeleteId;
                  setPendingDeleteId(null);
                  await handleDelete(id);
                }}
                className="game-btn flex-1 border-2 border-red-700 bg-red-600 py-3 font-pixel text-[9px] uppercase tracking-wider text-white hover:bg-red-700 dark:border-red-800 dark:bg-red-700 dark:hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {editingEntry && (
        <EditActualModal
          entry={editingEntry}
          days={days}
          onClose={() => setEditingEntry(null)}
          onSave={handleEditSave}
        />
      )}

      {/* ───────────────────────── TIMELINE ────────────────────────────────── */}

      {isLoading ? (

        <div className="py-16 text-center">
          <p className="font-pixel text-[9px] uppercase text-stone-500 dark:text-stone-400 animate-pulse">
            Loading log…
          </p>
        </div>

      ) : fetchError ? (

        <div className="py-12 text-center border-2 border-dashed border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10">
          <div className="mb-2 text-3xl">⚠️</div>
          <p className="font-mono text-xs text-red-600 dark:text-red-400 mb-3">{fetchError}</p>
          <p className="font-mono text-[10px] text-stone-500 dark:text-stone-400 mb-4">
            Make sure the <strong>actual_logs</strong> table exists in Supabase (run the SQL migration).
          </p>
          <button
            onClick={fetchEntries}
            className="game-btn px-4 py-1.5 font-pixel text-[8px] uppercase bg-stone-800 text-[#fdfbf7] dark:bg-[#1e1815]"
          >
            ↺ Retry
          </button>
        </div>

      ) : (

        /* ── Day-grouped accordion timeline with drag-and-drop ─────────────── */
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="space-y-4">
            {allDayNums.map((dayNum) => {
              const dayEntries = grouped[dayNum] ?? [];
              const isOpen     = expandedDays.has(dayNum);

              // Compute the date dynamically from tripStartDate — single source of truth
              const computedDate = computeDateForDay(tripStartDate, dayNum);

              return (
                <div
                  key={dayNum}
                  className="border-4 border-stone-800 dark:border-[#54463d] bg-[#fdfbf7] dark:bg-[#28211d] shadow-[4px_4px_0_#292524] dark:shadow-[4px_4px_0_#1e1815] overflow-hidden"
                >

                  {/* ── Clickable Day accordion header ──────────────────────── */}
                  <button
                    type="button"
                    onClick={() => toggleDay(dayNum)}
                    className={[
                      "w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150",
                      isOpen
                        ? "bg-stone-800 dark:bg-[#1e1815]"
                        : "bg-[#e8dcc4] dark:bg-[#362d28] hover:bg-[#d8ccb4] dark:hover:bg-[#463d38]",
                    ].join(" ")}
                  >
                    {/* Toggle icon */}
                    <div
                      className={[
                        "flex h-7 w-7 shrink-0 items-center justify-center border-2 font-pixel text-[12px] transition-colors",
                        isOpen
                          ? "border-[#fdfbf7] text-stone-800 bg-[#fdfbf7]"
                          : "border-stone-800 dark:border-[#54463d] text-stone-800 dark:text-[#fdfbf7] bg-[#fdfbf7] dark:bg-[#28211d]",
                      ].join(" ")}
                    >
                      {isOpen ? "－" : "＋"}
                    </div>

                    {/* Day label — computed dynamically from tripStartDate */}
                    <div className="flex-1 min-w-0">
                      <span
                        className={[
                          "font-pixel text-[10px] uppercase tracking-wider",
                          isOpen ? "text-[#fdfbf7]" : "text-stone-800 dark:text-[#fdfbf7]",
                        ].join(" ")}
                      >
                        {buildDayLabel(dayNum, tripStartDate)}
                      </span>
                      {isOpen && (
                        <span className="ml-3 font-mono text-[9px] text-stone-400 dark:text-stone-500">
                          {buildDisplayDate(computedDate)}
                        </span>
                      )}
                    </div>

                    {/* Entry count badge */}
                    <span
                      className={[
                        "shrink-0 font-mono text-[9px] px-2 py-0.5",
                        isOpen
                          ? "bg-[#fdfbf7]/20 text-[#fdfbf7] border border-[#fdfbf7]/30"
                          : "bg-stone-200 dark:bg-[#28211d] text-stone-600 dark:text-stone-400 border border-stone-300 dark:border-stone-600",
                      ].join(" ")}
                    >
                      {dayEntries.length} event{dayEntries.length !== 1 ? "s" : ""}
                    </span>

                    {/* Chevron */}
                    <span
                      className={[
                        "shrink-0 font-mono text-sm transition-transform duration-200",
                        isOpen ? "text-[#fdfbf7]" : "text-stone-500 dark:text-stone-400",
                      ].join(" ")}
                      style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                    >
                      ▼
                    </span>
                  </button>

                  {/* ── Droppable zone — always in DOM so collapsed days accept drops */}
                  <Droppable droppableId={String(dayNum)} type="actual-entry">
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        style={isOpen ? undefined : { height: 0, overflow: "hidden", position: "absolute", pointerEvents: "none" }}
                        className={snapshot.isDraggingOver && isOpen ? "bg-amber-50/50 dark:bg-amber-900/10" : ""}
                      >
                        {isOpen && (
                          <div className="divide-y-2 divide-stone-100 dark:divide-stone-700/60">
                            {dayEntries.length === 0 ? (
                              <p className="py-6 text-center font-mono text-xs text-amber-700 dark:text-amber-300">
                                No entries yet. Drop one here!
                              </p>
                            ) : (
                              dayEntries.map((entry, idx) => (
                                <Draggable key={entry.id} draggableId={entry.id} index={idx}>
                                  {(dragProvided, dragSnapshot) => (
                                    <div
                                      ref={dragProvided.innerRef}
                                      {...dragProvided.draggableProps}
                                      style={{
                                        ...dragProvided.draggableProps.style,
                                        opacity: dragSnapshot.isDragging ? 0.85 : 1,
                                        zIndex: dragSnapshot.isDragging ? 100 : undefined,
                                      }}
                                      className="group flex items-start gap-3 px-4 py-3.5 bg-[#fdfbf7] dark:bg-[#28211d] hover:bg-[#f5eed7] dark:hover:bg-[#2d2620] transition-colors duration-100"
                                    >
                                      {/* Drag handle */}
                                      <div
                                        {...dragProvided.dragHandleProps}
                                        className="mt-1 flex shrink-0 items-center justify-center w-5 h-6 cursor-grab active:cursor-grabbing text-stone-300 hover:text-stone-500 dark:text-stone-600 dark:hover:text-stone-400 touch-none select-none"
                                        title="Drag to move this log entry"
                                      >
                                        <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                                          <circle cx="3" cy="3"  r="1.5" />
                                          <circle cx="7" cy="3"  r="1.5" />
                                          <circle cx="3" cy="8"  r="1.5" />
                                          <circle cx="7" cy="8"  r="1.5" />
                                          <circle cx="3" cy="13" r="1.5" />
                                          <circle cx="7" cy="13" r="1.5" />
                                        </svg>
                                      </div>

                                      {/* Timeline connector dot */}
                                      <div className="relative flex shrink-0 flex-col items-center pt-0.5" style={{ width: 28 }}>
                                        <div
                                          className="z-10 h-5 w-5 flex items-center justify-center text-[10px]"
                                          style={{
                                            background: "#fef9c3",
                                            border:     "2px solid #fcd34d",
                                            boxShadow:  "1px 1px 0 #fcd34d",
                                          }}
                                        >
                                          {idx + 1}
                                        </div>
                                        {idx !== dayEntries.length - 1 && !dragSnapshot.isDragging && (
                                          <div
                                            className="mt-1.5 w-px flex-1 min-h-3"
                                            style={{
                                              background: "linear-gradient(180deg, #c8a96e 0%, transparent 100%)",
                                            }}
                                          />
                                        )}
                                      </div>

                                      {/* Entry content */}
                                      <div className="flex-1 min-w-0">
                                        {/* Day badge — always reflects current day_number from entry state */}
                                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                                          <span className="font-mono text-xs font-bold tabular-nums text-stone-800 dark:text-[#fdfbf7]">
                                            {buildTimeRange(entry.from_time, entry.to_time)}
                                          </span>
                                          <span
                                            className="font-mono text-[8px] px-1.5 py-0.5 text-stone-700 dark:text-stone-300"
                                            style={{ background: "#f5eed7", border: "1.5px solid #c8a96e" }}
                                          >
                                            ACTUAL
                                          </span>
                                          {/* Dynamic day/date badge computed from tripStartDate + day_number */}
                                          <span className="font-mono text-[8px] px-1.5 py-0.5 text-stone-500 border border-stone-300 dark:border-stone-600 rounded bg-[#f5eed7]/50 dark:bg-[#362d28]/50">
                                            Day {entry.day_number} · {(() => {
                                              const d = computeDateForDay(tripStartDate, entry.day_number);
                                              const dt = new Date(d + "T00:00:00");
                                              return `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()}`;
                                            })()}
                                          </span>
                                        </div>
                                        {/* Details text */}
                                        <p className="font-mono text-sm leading-relaxed text-stone-800 dark:text-[#fdfbf7]">
                                          {entry.details}
                                        </p>
                                      </div>

                                      {/* Edit / Delete — hover-reveal */}
                                      <div className="flex shrink-0 items-start gap-1 pt-0.5 opacity-100 transition-opacity duration-150 md:opacity-0 md:group-hover:opacity-100">
                                        <button
                                          onClick={() => setEditingEntry(entry)}
                                          title="Edit entry"
                                          className="game-btn flex h-7 w-7 items-center justify-center font-mono text-xs bg-[#f5eed7] text-stone-800 border-2 border-stone-800 dark:bg-[#362d28] dark:text-[#fdfbf7] dark:border-[#54463d]"
                                        >
                                          ✏
                                        </button>
                                        <button
                                          onClick={() => setPendingDeleteId(entry.id)}
                                          title="Delete entry"
                                          className="game-btn flex h-7 w-7 items-center justify-center font-mono text-xs bg-red-50 text-red-700 border-2 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
                                        >
                                          🗑
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              ))
                            )}
                          </div>
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>

                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}

    </div>
  );
}
