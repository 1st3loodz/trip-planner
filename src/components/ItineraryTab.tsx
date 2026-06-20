"use client";

import { useState } from "react";
import { Trip, ActivityItem, ActivityCategory } from "@/types/trip";
import { ACTIVITY_CATEGORY_META } from "@/lib/utils";
import DayCard from "@/components/DayCard";
import AddActivityModal from "@/components/AddActivityModal";
import ActualLogTab from "@/components/ActualLogTab";

interface ItineraryTabProps {
  trip: Trip;
  onAddActivity:    (dayNumber: number, activity: ActivityItem) => Promise<void> | void;
  onEditActivity:   (dayNumber: number, activity: ActivityItem) => Promise<void> | void;
  onDeleteActivity: (dayNumber: number, activityId: string) => void;
  customCategories: { id: string; label: string; emoji: string }[];
  onAddCustomCategory: (cat: { id: string; label: string; emoji: string }) => void;
  setRefreshToggle?: React.Dispatch<React.SetStateAction<number>>;
}

type Filter = ActivityCategory | "all";
type ModalState = null | { mode: "add" } | { mode: "edit"; activity: ActivityItem; dayNumber: number };

export default function ItineraryTab({ trip, onAddActivity, onEditActivity, onDeleteActivity, customCategories, onAddCustomCategory, setRefreshToggle }: ItineraryTabProps) {
  const [filter,         setFilter]         = useState<Filter>("all");
  const [modalState,     setModalState]     = useState<ModalState>(null);
  const [showActualLog,  setShowActualLog]  = useState<boolean>(false);

  const allActivities = trip.days.flatMap((d) => d.activities);
  const counts: Partial<Record<Filter, number>> = { all: allActivities.length };
  allActivities.forEach((a) => { counts[a.category] = (counts[a.category] ?? 0) + 1; });
  const presentCats = (Object.keys(ACTIVITY_CATEGORY_META) as ActivityCategory[]).filter((c) => counts[c]);
  const presentCustomCats = customCategories.filter((c) => counts[c.id]);

  const visibleDays = trip.days
    .map((day) => ({ ...day, activities: filter === "all" ? day.activities : day.activities.filter((a) => a.category === filter) }))
    .filter((day) => day.activities.length > 0 || filter === "all");

  function handleSave(dayNumber: number, activity: ActivityItem) {
    if (modalState?.mode === "edit") onEditActivity(dayNumber, activity);
    else onAddActivity(dayNumber, activity);
  }

  return (
    <div>
      {/* ── Sub-Icon Toggle: Actual Log (Above Add Entry) ────────────────── */}
      <div className="mb-4 flex">
        <button
          onClick={() => setShowActualLog(prev => !prev)}
          title="Toggle Actual Log"
          className={`game-btn flex w-12 h-12 items-center justify-center border-2 border-stone-800 dark:border-[#54463d] shadow-[3px_3px_0_#292524] dark:shadow-[3px_3px_0_#1e1815] transition-colors ${
            showActualLog
              ? "bg-[#5a4e3d] text-amber-100 dark:bg-[#362d28] dark:text-[#f5ebd5]"
              : "bg-[#e8dcc4] text-stone-800 hover:bg-[#d8ccb4] dark:bg-[#28211d] dark:text-[#fdfbf7] dark:hover:bg-[#362d28]"
          }`}
        >
          <span className="text-xl">📜</span>
        </button>
      </div>

      {showActualLog && (
        <div className="mb-8 animate-in slide-in-from-top-2 fade-in duration-200">
          <ActualLogTab tripId={trip.id} days={trip.days} />
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setModalState({ mode: "add" })}
          className="game-btn flex items-center gap-1.5 px-4 py-2 font-pixel text-[8px] uppercase tracking-wider bg-[#4a7c59] text-[#fdfbf7] dark:bg-[#2d5a3d]"
        >
          <span className="text-base leading-none">+</span> Add Entry
        </button>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-1.5 ml-auto">
          <FilterPill label={`All · ${counts.all}`} active={filter === "all"} onClick={() => setFilter("all")} />
          {presentCats.map((cat) => {
            const m = ACTIVITY_CATEGORY_META[cat];
            return <FilterPill key={cat} label={`${m.emoji} ${m.label} · ${counts[cat]}`} active={filter === cat} onClick={() => setFilter(cat)} />;
          })}
          {presentCustomCats.map((cat) => (
            <FilterPill key={cat.id} label={`${cat.emoji} ${cat.label} · ${counts[cat.id]}`} active={filter === cat.id} onClick={() => setFilter(cat.id)} />
          ))}
        </div>
      </div>

      {visibleDays.length > 0 ? (
        visibleDays.map((day, idx) => (
          <DayCard
            key={day.dayNumber}
            day={day}
            destination={trip.destination}
            defaultOpen={false}
            customCategories={customCategories}
            onEditActivity={(dayNumber, activity) => setModalState({ mode: "edit", activity, dayNumber })}
            onDeleteActivity={onDeleteActivity}
          />
        ))
      ) : (
        <div
          className="py-16 text-center border-2 border-dashed border-stone-400 bg-stone-200/50 dark:border-stone-600 dark:bg-stone-800/30"
        >
          <div className="mb-2 text-4xl">🔍</div>
          <p className="font-mono text-xs text-stone-600 dark:text-[#f5ebd5]">No entries match this filter.</p>
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      {modalState !== null && (
        <AddActivityModal
          days={trip.days}
          startDate={trip.startDate}
          endDate={trip.endDate}
          initialActivity={modalState.mode === "edit" ? { ...modalState.activity, dayNumber: modalState.dayNumber } : undefined}
          onSave={handleSave}
          onClose={() => setModalState(null)}
          customCategories={customCategories}
          onAddCustomCategory={onAddCustomCategory}
          setRefreshToggle={setRefreshToggle}
        />
      )}
    </div>
  );
}

// Earthy pill filter — harvest gold active, parchment inactive
function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`font-mono text-[10px] px-3 py-1.5 border-2 transition-colors ${
        active
          ? "bg-stone-800 text-[#fdfbf7] border-stone-800 shadow-[2px_2px_0_#292524] dark:bg-[#1e1815] dark:border-[#54463d] dark:shadow-[2px_2px_0_#54463d]"
          : "bg-[#f5eed7] text-stone-800 border-stone-400 dark:bg-[#28211d] dark:text-[#f5ebd5] dark:border-[#54463d]"
      }`}
    >
      {label}
    </button>
  );
}
