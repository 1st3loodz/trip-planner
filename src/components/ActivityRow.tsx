"use client";

import { ActivityItem, ActivityCategory } from "@/types/trip";
import { ACTIVITY_CATEGORY_META, formatDate } from "@/lib/utils";
import { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";

interface ActivityRowProps {
  activity: ActivityItem;
  destination: string;
  isLast: boolean;
  onEdit: (activity: ActivityItem) => void;
  onDelete: (id: string) => void;
  dayNumber: number;
  date: string;
  customCategories?: { id: string; label: string; emoji: string }[];
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
}

// Muted pastel flat-art category color fills (bg/text) — earthy, no neon
const COZY_CATEGORY_STYLE: Record<ActivityCategory, { bg: string; border: string; text: string }> = {
  flight:      { bg: "#dbeafe", border: "#93c5fd", text: "#1e40af" }, // soft sky blue
  hotel:       { bg: "#fef9c3", border: "#fcd34d", text: "#92400e" }, // warm straw yellow
  food:        { bg: "#fce7f3", border: "#f9a8d4", text: "#9d174d" }, // muted rose
  sightseeing: { bg: "#d1fae5", border: "#6ee7b7", text: "#065f46" }, // sage green
  transport:   { bg: "#ede9fe", border: "#c4b5fd", text: "#5b21b6" }, // lavender mist
  free:        { bg: "#fef3c7", border: "#fde68a", text: "#78350f" }, // harvest gold
  shopping:    { bg: "#fce7f3", border: "#f9a8d4", text: "#9d174d" }, // soft blush
};

export default function ActivityRow({ activity, destination, isLast, onEdit, onDelete, dayNumber, date, customCategories = [], dragHandleProps }: ActivityRowProps) {
  const customCat = customCategories.find((c) => c.id === activity.category);
  const meta      = ACTIVITY_CATEGORY_META[activity.category] || { label: customCat?.label || activity.category, emoji: customCat?.emoji || "✨" };
  const cozyStyle = COZY_CATEGORY_STYLE[activity.category] || { bg: "#f3f4f6", border: "#d1d5db", text: "#374151" }; // neutral gray fallback for custom

  const destLower = destination?.toLowerCase() || "";
  const showAmap = ["china", "cn", "จีน", "beijing", "shanghai", "guangzhou", "shenzhen", "chengdu", "chongqing", "mainland"].some(str => destLower.includes(str));

  return (
    <div className="group relative flex gap-3 py-4 bg-[#fdfbf7] dark:bg-[#28211d] hover:bg-[#f5eed7] dark:hover:bg-[#2d2620] px-2 -mx-2 rounded transition-colors duration-100 items-start">
      {/* Drag handle */}
      {dragHandleProps && (
        <div
          {...dragHandleProps}
          className="mt-1 flex shrink-0 items-center justify-center w-6 h-7 cursor-grab active:cursor-grabbing text-stone-300 hover:text-stone-500 dark:text-stone-600 dark:hover:text-stone-400 touch-none select-none"
          title="Drag to reorder activity"
        >
          <svg width="12" height="20" viewBox="0 0 12 20" fill="currentColor">
            <circle cx="4" cy="4" r="1.5" />
            <circle cx="8" cy="4" r="1.5" />
            <circle cx="4" cy="10" r="1.5" />
            <circle cx="8" cy="10" r="1.5" />
            <circle cx="4" cy="16" r="1.5" />
            <circle cx="8" cy="16" r="1.5" />
          </svg>
        </div>
      )}

      {/* Timeline node */}
      <div className="relative flex shrink-0 flex-col items-center" style={{ width: 40 }}>
        {/* Icon circle — muted pastel with monoline border */}
        <div
          className="z-10 flex h-9 w-9 items-center justify-center text-lg"
          style={{
            background: cozyStyle.bg,
            border: `2px solid ${cozyStyle.border}`,
            boxShadow: `2px 2px 0 ${cozyStyle.border}`,
          }}
        >
          {meta.emoji}
        </div>
        {!isLast && (
          <div
            className="mt-2 min-h-8 w-px flex-1"
            style={{ background: "linear-gradient(180deg, #c8a96e 0%, transparent 100%)" }}
          />
        )}
      </div>

      <div className="flex-1 min-w-0 pb-2">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          {/* Time — earthy monospace */}
          <span className="font-mono text-xs font-semibold tabular-nums text-stone-800 dark:text-[#fdfbf7]">
            {activity.endTime
              ? `${activity.time} – ${activity.endTime}`
              : activity.time}
          </span>
          {/* Category badge — muted pastel flat pill */}
          <span
            className="font-mono text-[9px] px-2 py-0.5 text-stone-800"
            style={{
              background: cozyStyle.bg,
              border: `1.5px solid ${cozyStyle.border}`,
            }}
          >
            {meta.label}
          </span>
          {/* Day/Date badge */}
          <span className="font-mono text-[9px] px-2 py-0.5 text-stone-500 border border-stone-300 dark:border-stone-600 rounded bg-[#f5eed7]/50 dark:bg-[#362d28]/50">
            Day {dayNumber} ({formatDate(date)})
          </span>
        </div>

        <h3 className="mb-1 font-mono text-sm font-semibold leading-snug text-stone-800 dark:text-[#fdfbf7]">
          {activity.title}
        </h3>
        {activity.description && (
          <p className="mb-1.5 whitespace-pre-line font-mono text-xs leading-relaxed text-stone-600 dark:text-[#f5ebd5]">{activity.description}</p>
        )}
        {/* ── Candidate Locations list ─────────────────────────────────── */}
        {(() => {
          // Prefer new locations[] array; fall back to legacy location string
          const locList = (activity.locations && activity.locations.length > 0)
            ? activity.locations
            : activity.location
              ? [{ name: activity.location, map_url: undefined }]
              : [];

          if (locList.length === 0) return null;

          return (
            <div className="mb-1.5 space-y-1.5">
              {locList.map((loc, idx) => {
                // Determine Google Maps href: prefer explicit map_url, else search query
                const hasCustomUrl = loc.map_url && loc.map_url.trim().startsWith("http");
                const googleUrl = hasCustomUrl
                  ? loc.map_url!
                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.name)}`;
                const amapUrl = `https://uri.amap.com/search?keyword=${encodeURIComponent(loc.name)}`;

                return (
                  <div key={idx} className="flex items-start gap-1.5">
                    <span className="mt-px text-[10px] shrink-0">📍</span>
                    <div className="min-w-0">
                      <span className="font-mono text-[10px] leading-tight text-stone-600 dark:text-[#f5ebd5] break-words">
                        {loc.name}
                      </span>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <a
                          href={googleUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="game-btn flex items-center gap-1 border-2 border-stone-800 bg-[#fdfbf7] px-2 py-1 font-pixel text-[7px] uppercase tracking-wider text-stone-800 hover:bg-[#e8dcc4] dark:border-[#54463d] dark:bg-[#1e1815] dark:text-[#fdfbf7] dark:hover:bg-[#362d28]"
                        >
                          🗺 Google Maps
                        </a>
                        {showAmap && (
                          <a
                            href={amapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="game-btn flex items-center gap-1 border-2 border-stone-800 bg-[#fdfbf7] px-2 py-1 font-pixel text-[7px] uppercase tracking-wider text-stone-800 hover:bg-[#e8dcc4] dark:border-[#54463d] dark:bg-[#1e1815] dark:text-[#fdfbf7] dark:hover:bg-[#362d28]"
                          >
                            📍 Amap
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
        {activity.transportationNote && (
          <div
            className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-[10px]"
            style={{ background: "#ede9fe", border: "1.5px solid #c4b5fd", color: "#5b21b6" }}
          >
            <span>🚌</span>
            <span className="text-stone-800">{activity.transportationNote}</span>
          </div>
        )}
      </div>

      {/* Edit / Delete — revealed on hover (desktop), always visible (mobile) */}
      <div className="flex shrink-0 items-start gap-1 pt-1 opacity-100 transition-opacity duration-150 md:opacity-0 md:group-hover:opacity-100">
        <button
          onClick={() => onEdit(activity)}
          title="Edit"
          className="game-btn flex h-7 w-7 items-center justify-center font-mono text-xs bg-[#f5eed7] text-stone-800 border-2 border-stone-800 dark:bg-[#362d28] dark:text-[#fdfbf7] dark:border-[#54463d]"
        >
          ✏
        </button>
        <button
          onClick={() => onDelete(activity.id)}
          title="Delete"
          className="game-btn flex h-7 w-7 items-center justify-center font-mono text-xs bg-red-50 text-red-700 border-2 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
        >
          🗑
        </button>
      </div>
    </div>
  );
}
