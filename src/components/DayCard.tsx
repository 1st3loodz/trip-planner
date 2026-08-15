"use client";

import { useState } from "react";
import { DraggableProvidedDragHandleProps, Droppable, Draggable } from "@hello-pangea/dnd";
import { DayPlan, ActivityItem } from "@/types/trip";
import { formatDate, addDaysToISO } from "@/lib/utils";
import ActivityRow from "@/components/ActivityRow";

interface DayCardProps {
  day: DayPlan;
  destination: string;
  tripStartDate: string;
  defaultOpen?: boolean;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  onEditActivity: (dayNumber: number, activity: ActivityItem) => void;
  onDeleteActivity: (dayNumber: number, activityId: string) => void;
  customCategories?: { id: string; label: string; emoji: string }[];
}

export default function DayCard({ day, destination, tripStartDate, defaultOpen = true, dragHandleProps, onEditActivity, onDeleteActivity, customCategories = [] }: DayCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  // Compute this day's date dynamically from the trip start date + dayNumber offset.
  // Uses timezone-safe local-date math (addDaysToISO) — never use day.date which can be stale.
  const computedDayDate = addDaysToISO(tripStartDate, day.dayNumber - 1);

  return (
    <section className="mb-5">
      {/* Day header — wooden sign style */}
      <div className="group w-full flex items-center bg-[#fdfbf7] dark:bg-[#362d28] border-2 border-stone-800 dark:border-[#54463d] shadow-[3px_3px_0_#292524] dark:shadow-[3px_3px_0_#54463d]">

        {/* ── Drag handle — separate from the collapse toggle ── */}
        {dragHandleProps && (
          <div
            {...dragHandleProps}
            className="flex shrink-0 items-center justify-center w-10 h-full self-stretch px-1 cursor-grab active:cursor-grabbing text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 border-r-2 border-stone-300 dark:border-[#54463d] touch-none select-none"
            title="Drag to reorder"
            aria-label="Drag to reorder day"
          >
            {/* Grip dots — 6-dot grid icon */}
            <svg width="14" height="20" viewBox="0 0 14 20" fill="currentColor" aria-hidden="true">
              <circle cx="4" cy="4"  r="2"/>
              <circle cx="10" cy="4"  r="2"/>
              <circle cx="4" cy="10" r="2"/>
              <circle cx="10" cy="10" r="2"/>
              <circle cx="4" cy="16" r="2"/>
              <circle cx="10" cy="16" r="2"/>
            </svg>
          </div>
        )}

        {/* ── Collapse / expand button (takes remaining space) ── */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-3 px-4 py-3.5 min-w-0 text-left"
        >
          {/* Day number badge */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center font-pixel text-[10px] text-[#fdfbf7] bg-stone-800 dark:bg-[#1e1815] border-2 border-stone-900 dark:border-[#54463d]">
            {day.dayNumber}
          </div>

          <div className="flex-1 text-left min-w-0">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-pixel text-[10px] text-stone-800 dark:text-[#fdfbf7]">Day {day.dayNumber}</span>
              {day.label && <span className="font-mono text-xs text-stone-600 dark:text-[#f5ebd5]">— {day.label}</span>}
            </div>
            <span className="font-mono text-[10px] text-stone-600 dark:text-stone-400">{formatDate(computedDayDate)}</span>
          </div>

          <div className="shrink-0 text-right">
            <div className="font-mono text-[10px] text-stone-600 dark:text-stone-400">{day.activities.length} entries</div>
          </div>

          {/* Arrow indicator */}
          <span
            className="font-mono text-stone-600 dark:text-[#f5ebd5] text-sm shrink-0"
            style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 150ms" }}
          >
            ▶
          </span>
        </button>
      </div>

      {/* Always render the Droppable so collapsed days are valid drop targets */}
      <Droppable droppableId={String(day.dayNumber)} type="activity">
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            // When closed: hidden container at height 0, still in DOM for DnD
            style={open ? undefined : { height: 0, overflow: "hidden", position: "absolute", pointerEvents: "none" }}
          >
            {open && (
              <div className="mt-0 px-5 py-4 bg-[#f5eed7] dark:bg-[#28211d] border-2 border-t-0 border-stone-800 dark:border-[#54463d]">
                {(!day?.activities || day.activities.length === 0) ? (
                  <p className="py-4 text-center font-mono text-xs text-amber-700 dark:text-amber-300">No entries yet.</p>
                ) : (
                  (Array.isArray(day?.activities) ? day.activities : []).map((act, idx) => (
                    <Draggable key={act?.id || idx} draggableId={act?.id || String(idx)} index={idx}>
                      {(dragProvided, dragSnapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          style={{
                            ...dragProvided.draggableProps.style,
                            opacity: dragSnapshot.isDragging ? 0.8 : 1,
                            zIndex: dragSnapshot.isDragging ? 100 : undefined,
                          }}
                        >
                          <ActivityRow
                            activity={act}
                            destination={destination}
                            isLast={idx === day.activities.length - 1 && !dragSnapshot.isDragging}
                            dayNumber={day.dayNumber}
                            tripStartDate={tripStartDate}
                            customCategories={customCategories}
                            onEdit={(a) => onEditActivity(day.dayNumber, a)}
                            onDelete={(id) => onDeleteActivity(day.dayNumber, id)}
                            dragHandleProps={dragProvided.dragHandleProps}
                          />
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
    </section>
  );
}
