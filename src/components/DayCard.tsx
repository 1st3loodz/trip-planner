"use client";

import { useState } from "react";
import { DayPlan, ActivityItem } from "@/types/trip";
import { formatDate } from "@/lib/utils";
import ActivityRow from "@/components/ActivityRow";

interface DayCardProps {
  day: DayPlan;
  destination: string;
  defaultOpen?: boolean;
  onEditActivity: (dayNumber: number, activity: ActivityItem) => void;
  onDeleteActivity: (dayNumber: number, activityId: string) => void;
  customCategories?: { id: string; label: string; emoji: string }[];
}

export default function DayCard({ day, destination, defaultOpen = true, onEditActivity, onDeleteActivity, customCategories = [] }: DayCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="mb-5">
      {/* Day header — wooden sign style */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="group w-full flex items-center gap-3 px-5 py-3.5 bg-[#fdfbf7] dark:bg-[#362d28] border-2 border-stone-800 dark:border-[#54463d] shadow-[3px_3px_0_#292524] dark:shadow-[3px_3px_0_#54463d]"
      >
        {/* Day number badge */}
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center font-pixel text-[10px] text-[#fdfbf7] bg-stone-800 dark:bg-[#1e1815] border-2 border-stone-900 dark:border-[#54463d]"
        >
          {day.dayNumber}
        </div>

        <div className="flex-1 text-left min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-pixel text-[10px] text-stone-800 dark:text-[#fdfbf7]">Day {day.dayNumber}</span>
            {day.label && <span className="font-mono text-xs text-stone-600 dark:text-[#f5ebd5]">— {day.label}</span>}
          </div>
          <span className="font-mono text-[10px] text-stone-600 dark:text-stone-400">{formatDate(day.date)}</span>
        </div>

        <div className="shrink-0 text-right">
          <div className="font-mono text-[10px] text-stone-600 dark:text-stone-400">{day.activities.length} entries</div>
        </div>

        {/* Arrow indicator */}
        <span
          className="font-mono text-stone-600 dark:text-[#f5ebd5] text-sm"
          style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 150ms" }}
        >
          ▶
        </span>
      </button>

      {open && (
        <div
          className="mt-0 px-5 py-4 bg-[#f5eed7] dark:bg-[#28211d] border-2 border-t-0 border-stone-800 dark:border-[#54463d]"
        >
          {day.activities.length === 0 ? (
            <p className="py-4 text-center font-mono text-xs text-amber-700 dark:text-amber-300">No entries yet.</p>
          ) : (
            day.activities.map((act, idx) => (
              <ActivityRow
                key={act.id}
                activity={act}
                destination={destination}
                isLast={idx === day.activities.length - 1}
                customCategories={customCategories}
                onEdit={(a) => onEditActivity(day.dayNumber, a)}
                onDelete={(id) => onDeleteActivity(day.dayNumber, id)}
              />
            ))
          )}
        </div>
      )}
    </section>
  );
}
