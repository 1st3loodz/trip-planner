"use client";

import { ActivityItem, ActivityCategory } from "@/types/trip";
import { ACTIVITY_CATEGORY_META } from "@/lib/utils";

interface ActivityRowProps {
  activity: ActivityItem;
  destination: string;
  isLast: boolean;
  onEdit: (activity: ActivityItem) => void;
  onDelete: (id: string) => void;
  customCategories?: { id: string; label: string; emoji: string }[];
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

export default function ActivityRow({ activity, destination, isLast, onEdit, onDelete, customCategories = [] }: ActivityRowProps) {
  const customCat = customCategories.find((c) => c.id === activity.category);
  const meta      = ACTIVITY_CATEGORY_META[activity.category] || { label: customCat?.label || activity.category, emoji: customCat?.emoji || "✨" };
  const cozyStyle = COZY_CATEGORY_STYLE[activity.category] || { bg: "#f3f4f6", border: "#d1d5db", text: "#374151" }; // neutral gray fallback for custom

  const destLower = destination?.toLowerCase() || "";
  const showAmap = ["china", "cn", "จีน", "beijing", "shanghai", "guangzhou", "shenzhen", "chengdu", "chongqing", "mainland"].some(str => destLower.includes(str));

  return (
    <div className="group relative flex gap-4 py-4">
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
            {activity.time}
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
        </div>

        <h3 className="mb-1 font-mono text-sm font-semibold leading-snug text-stone-800 dark:text-[#fdfbf7]">
          {activity.title}
        </h3>
        {activity.description && (
          <p className="mb-1.5 font-mono text-xs leading-relaxed text-stone-600 dark:text-[#f5ebd5]">{activity.description}</p>
        )}
        {activity.location && (
          <div className="mb-1.5">
            <div className="flex items-start gap-1.5">
              <span className="mt-px text-[10px]">📍</span>
              <span className="font-mono text-[10px] leading-tight text-stone-600 dark:text-[#f5ebd5]">{activity.location}</span>
            </div>
            
            {/* Inline Map Action Links */}
            <div className="mt-1.5 flex flex-wrap gap-2 ml-[18px]">
              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.location)}`}
                target="_blank" rel="noopener noreferrer"
                className="game-btn flex items-center gap-1 border-2 border-stone-800 bg-[#fdfbf7] px-2 py-1 font-pixel text-[7px] uppercase tracking-wider text-stone-800 hover:bg-[#e8dcc4] dark:border-[#54463d] dark:bg-[#1e1815] dark:text-[#fdfbf7] dark:hover:bg-[#362d28]"
              >
                🗺 Google Maps
              </a>
              {showAmap && (
                <a 
                  href={`https://uri.amap.com/search?keyword=${encodeURIComponent(activity.location)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="game-btn flex items-center gap-1 border-2 border-stone-800 bg-[#fdfbf7] px-2 py-1 font-pixel text-[7px] uppercase tracking-wider text-stone-800 hover:bg-[#e8dcc4] dark:border-[#54463d] dark:bg-[#1e1815] dark:text-[#fdfbf7] dark:hover:bg-[#362d28]"
                >
                  📍 Amap
                </a>
              )}
            </div>
          </div>
        )}
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

      {/* Edit / Delete — revealed on hover */}
      <div className="flex shrink-0 items-start gap-1 pt-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
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
