"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { DayPlan } from "@/types/trip";

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
}

// ─── Utility helpers ───────────────────────────────────────────────────────────

function safeArr(arr: ActualLogEntry[] | undefined | null): ActualLogEntry[] {
  return Array.isArray(arr) ? arr : [];
}

function safeDays(d: DayPlan[] | undefined | null): DayPlan[] {
  return Array.isArray(d) ? d : [];
}

function buildDayLabel(dayNum: number, days: DayPlan[]): string {
  const plan = safeDays(days).find((d) => d.dayNumber === dayNum);
  if (!plan?.date) return `Day ${dayNum}`;
  const dt = new Date(plan.date + "T00:00:00");
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

export default function ActualLogTab({ tripId, days }: ActualLogTabProps) {

  // ── Core data state ───────────────────────────────────────────────────────────
  const [entries,      setEntries]      = useState<ActualLogEntry[]>([]);
  const [isLoading,    setIsLoading]    = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [fetchError,   setFetchError]   = useState<string | null>(null);

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

  // ── Derived: group safe entries by day_number ─────────────────────────────────
  const safeEntries = safeArr(entries);

  const grouped = safeEntries.reduce<Record<number, ActualLogEntry[]>>((acc, entry) => {
    const k = Number(entry.day_number) || 0;
    if (!acc[k]) acc[k] = [];
    acc[k].push(entry);
    return acc;
  }, {});

  const sortedDayNums = Object.keys(grouped).map(Number).sort((a, b) => a - b);

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
                    {buildDayLabel(day.dayNumber, days)}
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

      ) : safeEntries.length === 0 ? (

        <div className="py-16 text-center border-2 border-dashed border-stone-400 bg-stone-200/50 dark:border-stone-600 dark:bg-stone-800/30">
          <div className="mb-3 text-4xl">📜</div>
          <div className="text-stone-500 font-mono p-4">NO ACTUAL LOGS RECORDED YET</div>
          <p className="font-mono text-[10px] text-stone-400 dark:text-stone-500">
            Use the form above to capture what really happened!
          </p>
        </div>

      ) : (

        /* ── Day-grouped accordion timeline ───────────────────────────────── */
        <div className="space-y-4">
          {sortedDayNums.map((dayNum) => {
            const dayEntries = (grouped[dayNum] || []);
            const isOpen     = expandedDays.has(dayNum);
            const dayPlan    = safeDays(days).find((d) => d.dayNumber === dayNum);

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

                  {/* Day label */}
                  <div className="flex-1 min-w-0">
                    <span
                      className={[
                        "font-pixel text-[10px] uppercase tracking-wider",
                        isOpen ? "text-[#fdfbf7]" : "text-stone-800 dark:text-[#fdfbf7]",
                      ].join(" ")}
                    >
                      {buildDayLabel(dayNum, days)}
                    </span>
                    {dayPlan?.date && isOpen && (
                      <span className="ml-3 font-mono text-[9px] text-stone-400 dark:text-stone-500">
                        {buildDisplayDate(dayPlan.date)}
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

                {/* ── Expandable entry list ────────────────────────────────── */}
                {isOpen && (
                  <div className="divide-y-2 divide-stone-100 dark:divide-stone-700/60">
                    {(dayEntries || []).map((entry, idx) => (
                      <div
                        key={entry.id}
                        className="group flex items-start gap-3 px-4 py-3.5 bg-[#fdfbf7] dark:bg-[#28211d] hover:bg-[#f5eed7] dark:hover:bg-[#2d2620] transition-colors duration-100"
                      >
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
                          {idx !== dayEntries.length - 1 && (
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
                          {/* Time range + badge */}
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
                          </div>
                          {/* Details text */}
                          <p className="font-mono text-sm leading-relaxed text-stone-800 dark:text-[#fdfbf7]">
                            {entry.details}
                          </p>
                        </div>

                        {/* Delete — hover-reveal */}
                        <div className="shrink-0 pt-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                          <button
                            onClick={() => handleDelete(entry.id)}
                            title="Delete entry"
                            className="game-btn flex h-7 w-7 items-center justify-center font-mono text-xs bg-red-50 text-red-700 border-2 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
