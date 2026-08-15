"use client";

import { useState, useEffect } from "react";
import { ActualLogEntry } from "./ActualLogTab";
import { DayPlan } from "@/types/trip";

interface EditActualModalProps {
  entry: ActualLogEntry;
  days: DayPlan[];
  onSave: (id: string, updates: Partial<ActualLogEntry>) => Promise<void>;
  onClose: () => void;
}

function buildDayLabel(dayNum: number, days: DayPlan[]): string {
  const plan = days.find((d) => d.dayNumber === dayNum);
  if (!plan?.date) return `Day ${dayNum}`;
  const dt = new Date(plan.date + "T00:00:00");
  const dd   = String(dt.getDate()).padStart(2, "0");
  const mm   = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  return `Day ${dayNum}  ·  ${dd}/${mm}/${yyyy}`;
}

function autoColon(raw: string, prev: string): string {
  let v = raw.replace(/[^\d:]/g, "");
  if (v.length === 2 && !v.includes(":") && prev.length === 1) v = v + ":";
  return v.slice(0, 5);
}

export default function EditActualModal({ entry, days, onSave, onClose }: EditActualModalProps) {
  const [dayNumber, setDayNumber] = useState<number>(entry.day_number);
  const [fromTime, setFromTime] = useState<string>(entry.from_time ?? "");
  const [toTime, setToTime] = useState<string>(entry.to_time ?? "");
  const [details, setDetails] = useState<string>(entry.details ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  async function handleSubmit() {
    if (!details.trim()) {
      setError("Details cannot be empty.");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      await onSave(entry.id, {
        day_number: dayNumber,
        from_time: fromTime.trim() || null,
        to_time: toTime.trim() || null,
        details: details.trim(),
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save updates.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const INPUT = "w-full border-2 border-stone-400 bg-[#fdfbf7] px-3 py-2 font-mono text-xs text-stone-900 placeholder-stone-400 outline-none focus:border-stone-800 dark:border-stone-600 dark:bg-[#1e1815] dark:text-[#fdfbf7] dark:placeholder-stone-500 dark:focus:border-[#f5ebd5]";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-sm dark:bg-black/60">
      <div className="w-full max-w-md border-4 border-stone-800 bg-[#fdfbf7] shadow-[8px_8px_0_#292524] dark:border-[#54463d] dark:bg-[#28211d] dark:shadow-[8px_8px_0_#1e1815] max-h-[90vh] flex flex-col overflow-hidden">
        
        <div className="flex shrink-0 items-center justify-between border-b-4 border-stone-800 bg-[#e8dcc4] px-4 py-3 dark:border-[#54463d] dark:bg-[#362d28]">
          <h2 className="font-pixel text-[10px] uppercase tracking-widest text-stone-800 dark:text-[#fdfbf7]">
            ✏ Edit Actual Plan
          </h2>
          <button onClick={onClose} className="font-mono text-xl leading-none text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-[#fdfbf7]">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="mb-1.5 block font-pixel text-[8px] uppercase tracking-widest text-stone-600 dark:text-stone-400">Day / Date</label>
            <select value={dayNumber} onChange={(e) => setDayNumber(Number(e.target.value))} className={INPUT}>
              {days.map((day) => (
                <option key={day.dayNumber} value={day.dayNumber}>
                  {buildDayLabel(day.dayNumber, days)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block font-pixel text-[8px] uppercase tracking-widest text-stone-600 dark:text-stone-400">Start Time</label>
              <input type="text" inputMode="numeric" maxLength={5} placeholder="00:00" value={fromTime} onChange={(e) => setFromTime(autoColon(e.target.value, fromTime))} className={INPUT} />
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block font-pixel text-[8px] uppercase tracking-widest text-stone-600 dark:text-stone-400">End Time</label>
              <input type="text" inputMode="numeric" maxLength={5} placeholder="23:59" value={toTime} onChange={(e) => setToTime(autoColon(e.target.value, toTime))} className={INPUT} />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block font-pixel text-[8px] uppercase tracking-widest text-stone-600 dark:text-stone-400">What Actually Happened? *</label>
            <textarea rows={4} value={details} onChange={(e) => setDetails(e.target.value)} className={`${INPUT} resize-none`} placeholder="e.g. Missed the train, grabbed local ramen instead..." />
          </div>

          {error && <p className="font-mono text-[10px] text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="flex shrink-0 gap-3 border-t-4 border-stone-800 bg-[#e8dcc4] px-5 py-4 dark:border-[#54463d] dark:bg-[#362d28]">
          <button onClick={onClose} disabled={isSubmitting} className="game-btn flex-1 border-2 border-stone-800 bg-[#fdfbf7] py-2.5 font-pixel text-[10px] uppercase tracking-wider text-stone-800 dark:border-[#54463d] dark:bg-[#28211d] dark:text-[#fdfbf7] disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={isSubmitting} className="game-btn flex-1 bg-[#4a7c59] py-2.5 font-pixel text-[10px] uppercase tracking-wider text-[#fdfbf7] dark:bg-[#2d5a3d] disabled:opacity-50">
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </div>

      </div>
    </div>
  );
}
