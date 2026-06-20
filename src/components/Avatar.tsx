"use client";

import { getInitials } from "@/lib/utils";

interface AvatarProps {
  name: string;
  colorClass: string;
  avatarUrl?: string;
  size?: "xs" | "sm" | "md" | "lg";
  tooltip?: boolean;
}

const SIZE_MAP = {
  xs: "h-5 w-5 text-[9px]",
  sm: "h-7 w-7 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
};

export default function Avatar({
  name,
  colorClass,
  avatarUrl,
  size = "md",
  tooltip = true,
}: AvatarProps) {
  // Strict Conditional Guard: Ensure it's a non-empty string that resembles a valid path or URL
  const isValidUrl = typeof avatarUrl === "string" && avatarUrl.trim().length > 0 && (avatarUrl.startsWith("http") || avatarUrl.startsWith("/"));

  return (
    <div className="relative group/av">
      <div
        className={`
          ${SIZE_MAP[size]} ${!isValidUrl ? colorClass : "bg-stone-200"}
          rounded-full flex items-center justify-center font-bold text-[#fdfbf7]
          ring-2 ring-black/20 shrink-0 overflow-hidden
          transition-transform duration-200 group-hover/av:scale-110
        `}
      >
        {isValidUrl ? (
          <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="font-pixel leading-none translate-y-[1px]">
            {name?.[0]?.toUpperCase() || "?"}
          </span>
        )}
      </div>
      {tooltip && (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-gray-900 px-2 py-1 text-[11px] font-medium text-gray-100 opacity-0 shadow-xl transition-opacity duration-150 group-hover/av:opacity-100">
          {name}
        </div>
      )}
    </div>
  );
}
