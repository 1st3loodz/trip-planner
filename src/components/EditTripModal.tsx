"use client";

import { useState, useEffect, useRef } from "react";
import { Trip } from "@/types/trip";

interface EditTripModalProps {
  trip: Trip;
  onSave: (data: { title: string; destination: string; startDate: string; endDate: string }) => void;
  onClose: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Tokenizes both ISO ("2026-06-20") and DD/MM/YY or DD/MM/YYYY strings into a
 * reliable Date object, padding 2-digit years to the 2000s century.
 */
function safeParseDate(dateString: string): Date | null {
  if (!dateString) return null;
  // Slash-delimited: DD/MM/YY or DD/MM/YYYY
  if (dateString.includes("/")) {
    const [d, m, y] = dateString.split("/").map(Number);
    const year = y < 100 ? y + 2000 : y;
    return new Date(year, m - 1, d);
  }
  // ISO format: YYYY-MM-DD (what <input type="date"> returns)
  const d = new Date(dateString);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Converts any accepted date string into the ISO "YYYY-MM-DD" format that
 * <input type="date"> requires as its value.
 */
function toISOValue(dateString: string): string {
  if (!dateString) return "";
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
  const d = safeParseDate(dateString);
  if (!d) return "";
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day   = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Formats an ISO date string ("2026-06-20") into display text "20/06/2026".
 */
function formatDisplayDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function EditTripModal({ trip, onSave, onClose }: EditTripModalProps) {
  const [title,       setTitle]       = useState(trip.title);
  const [destination, setDestination] = useState(trip.destination);
  // Pre-populate by normalising the incoming date string (may be DD/MM/YY or ISO)
  const [startDate,   setStartDate]   = useState(() => toISOValue(trip.startDate));
  const [endDate,     setEndDate]     = useState(() => toISOValue(trip.endDate));
  const [error,       setError]       = useState("");

  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef   = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleSave() {
    if (!title.trim() || !destination.trim() || !startDate || !endDate) {
      setError("Fill in all fields, adventurer!");
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setError("End date must be after start date.");
      return;
    }
    // Pass dates back in DD/MM/YYYY format to match the rest of the app
    const fmt = (iso: string) => {
      const [y, m, d] = iso.split("-");
      return `${d}/${m}/${y}`;
    };
    onSave({
      title:       title.trim(),
      destination: destination.trim(),
      startDate:   fmt(startDate),
      endDate:     fmt(endDate),
    });
  }

  const inputStyle = {
    borderRadius: 0,
    fontFamily:   "monospace",
    fontSize:     "0.75rem",
    padding:      "10px 14px",
    width:        "100%",
    outline:      "none",
  } as React.CSSProperties;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-stone-900/60 dark:bg-black/70" />

      <div
        className="relative w-full max-w-md bg-[#fdfbf7] dark:bg-[#362d28] border-2 border-stone-800 dark:border-[#54463d] shadow-[8px_8px_0_#292524] dark:shadow-[8px_8px_0_#54463d]"
      >
        {/* Inner border accent */}
        <div className="absolute inset-1 border-2 border-stone-300 dark:border-stone-600 pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-stone-800 dark:bg-[#1e1815] border-b-2 border-stone-800 dark:border-[#54463d]">
          <div>
            <h2 className="font-pixel text-[#fdfbf7] text-[9px] uppercase">✏ Edit Adventure</h2>
            <p className="font-mono text-stone-400 dark:text-stone-500 text-[10px] mt-1">
              Updating: <strong className="text-[#fdfbf7]">{trip.title}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="game-btn w-8 h-8 flex items-center justify-center font-pixel text-[10px] uppercase bg-[#f5eed7] text-stone-800 dark:bg-[#362d28] dark:text-[#fdfbf7] dark:border-[#54463d]"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="relative px-6 py-5 space-y-4">
          {error && (
            <div className="px-3 py-2 font-mono text-xs bg-red-100 text-red-800 border-2 border-red-800 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">
              ⚠ {error}
            </div>
          )}

          {/* Trip Title */}
          <div>
            <label className="block font-pixel text-[8px] uppercase text-stone-700 dark:text-[#f5ebd5] mb-1.5">Trip Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(""); }}
              style={inputStyle}
              className="bg-[#f5eed7] dark:bg-[#1e1815] border-2 border-stone-800 dark:border-[#54463d] text-stone-800 dark:text-[#fdfbf7]"
            />
          </div>

          {/* Destination */}
          <div>
            <label className="block font-pixel text-[8px] uppercase text-stone-700 dark:text-[#f5ebd5] mb-1.5">Destination</label>
            <input
              type="text"
              value={destination}
              onChange={(e) => { setDestination(e.target.value); setError(""); }}
              style={inputStyle}
              className="bg-[#f5eed7] dark:bg-[#1e1815] border-2 border-stone-800 dark:border-[#54463d] text-stone-800 dark:text-[#fdfbf7]"
            />
          </div>

          {/* Date Row */}
          <div className="grid grid-cols-2 gap-4">

            {/* ── Start Date ── */}
            <div>
              <label className="block font-pixel text-[8px] uppercase text-stone-700 dark:text-[#f5ebd5] mb-1.5">Start Date</label>
              {/*
                Full-box clickable wrapper:
                  – The styled <div> is the visual face users interact with.
                  – showPicker() programmatically opens the native calendar on any click.
                  – The real <input type="date"> sits opacity-0 / absolute so it still
                    receives native change events and is form-accessible.
              */}
              <div
                onClick={() => startDateRef.current?.showPicker()}
                className="relative w-full border-2 border-stone-800 dark:border-[#54463d] bg-[#f5eed7] dark:bg-[#1e1815] cursor-pointer flex items-center px-3.5 py-2.5 gap-2 select-none"
              >
                <span className="text-stone-500 dark:text-stone-400 shrink-0 text-sm">📅</span>
                <span className={`font-mono text-sm flex-1 ${startDate ? "text-stone-900 dark:text-[#fdfbf7]" : "text-stone-400 dark:text-stone-500"}`}>
                  {startDate ? formatDisplayDate(startDate) : "dd/mm/yyyy"}
                </span>
                <input
                  ref={startDateRef}
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setError(""); }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  tabIndex={-1}
                />
              </div>
            </div>

            {/* ── End Date ── */}
            <div>
              <label className="block font-pixel text-[8px] uppercase text-stone-700 dark:text-[#f5ebd5] mb-1.5">End Date</label>
              <div
                onClick={() => endDateRef.current?.showPicker()}
                className="relative w-full border-2 border-stone-800 dark:border-[#54463d] bg-[#f5eed7] dark:bg-[#1e1815] cursor-pointer flex items-center px-3.5 py-2.5 gap-2 select-none"
              >
                <span className="text-stone-500 dark:text-stone-400 shrink-0 text-sm">📅</span>
                <span className={`font-mono text-sm flex-1 ${endDate ? "text-stone-900 dark:text-[#fdfbf7]" : "text-stone-400 dark:text-stone-500"}`}>
                  {endDate ? formatDisplayDate(endDate) : "dd/mm/yyyy"}
                </span>
                <input
                  ref={endDateRef}
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setError(""); }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  tabIndex={-1}
                />
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t-2 border-stone-800 dark:border-[#54463d] bg-stone-100 dark:bg-[#28211d]">
          <button
            onClick={handleSave}
            className="game-btn w-full py-3 font-pixel text-[9px] uppercase tracking-wider bg-[#f5eed7] text-stone-800 dark:bg-[#1e1815] dark:text-[#fdfbf7] dark:border-[#54463d]"
          >
            ✦ Save Changes ✦
          </button>
        </div>
      </div>
    </div>
  );
}
