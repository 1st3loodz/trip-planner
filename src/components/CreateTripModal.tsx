"use client";

import { useState, useEffect, useRef } from "react";
import { TripStatus, Currency, CURRENCY_META } from "@/types/trip";

interface CreateTripModalProps {
  status: TripStatus;
  onSave: (data: { title: string; destination: string; startDate: string; endDate: string; travelType: "solo" | "group"; baseCurrency: Currency; friends: string[] }) => void;
  onClose: () => void;
}

export default function CreateTripModal({ status, onSave, onClose }: CreateTripModalProps) {
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [travelType, setTravelType] = useState<"solo" | "group">("solo");
  const [friends, setFriends] = useState<string[]>([""]);
  const [baseCurrency, setBaseCurrency] = useState<Currency>("THB");
  const [error, setError] = useState("");
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef   = useRef<HTMLInputElement>(null);

  // Format ISO date string ("2026-06-20") → "dd/mm/yyyy" display
  function formatDisplayDate(iso: string): string {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }

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
    const filteredFriends = friends.map(f => f.trim()).filter(Boolean);
    onSave({ title: title.trim(), destination: destination.trim(), startDate, endDate, travelType, baseCurrency, friends: filteredFriends });
  }

  const titleForStatus = {
    next: "Next Expedition",
    past: "Completed Saga",
    bucket: "Wanderlist Dream",
  };

  const inputStyle = {
    borderRadius: 0,
    fontFamily: "monospace",
    fontSize: "0.75rem",
    padding: "10px 14px",
    width: "100%",
    outline: "none",
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
        {/* Inner border */}
        <div className="absolute inset-1 border-2 border-stone-300 dark:border-stone-600 pointer-events-none" />

        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 bg-stone-800 dark:bg-[#1e1815] border-b-2 border-stone-800 dark:border-[#54463d]"
        >
          <div>
            <h2 className="font-pixel text-[#fdfbf7] text-[9px] uppercase">✦ New Adventure ✦</h2>
            <p className="font-mono text-stone-400 dark:text-stone-500 text-[10px] mt-1">
              Adding to: <strong className="text-[#fdfbf7]">{titleForStatus[status]}</strong>
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
            <div
              className="px-3 py-2 font-mono text-xs bg-red-100 text-red-800 border-2 border-red-800 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800"
            >
              ⚠ {error}
            </div>
          )}

          <div>
            <label className="block font-pixel text-[8px] uppercase text-stone-700 dark:text-[#f5ebd5] mb-1.5">Trip Title</label>
            <input
              type="text"
              placeholder="e.g. Summer in Tokyo"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(""); }}
              style={inputStyle}
              className="bg-[#f5eed7] dark:bg-[#1e1815] border-2 border-stone-800 dark:border-[#54463d] text-stone-800 dark:text-[#fdfbf7]"
            />
          </div>

          <div>
            <label className="block font-pixel text-[8px] uppercase text-stone-700 dark:text-[#f5ebd5] mb-1.5">Destination</label>
            <input
              type="text"
              placeholder="e.g. Japan"
              value={destination}
              onChange={(e) => { setDestination(e.target.value); setError(""); }}
              style={inputStyle}
              className="bg-[#f5eed7] dark:bg-[#1e1815] border-2 border-stone-800 dark:border-[#54463d] text-stone-800 dark:text-[#fdfbf7]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* ── Start Date ── */}
            <div>
              <label className="block font-pixel text-[8px] uppercase text-stone-700 dark:text-[#f5ebd5] mb-1.5">Start Date</label>
              <div
                onClick={() => startDateRef.current?.showPicker()}
                className="relative w-full border-2 border-stone-800 dark:border-[#54463d] bg-[#f5eed7] dark:bg-[#1e1815] cursor-pointer flex items-center px-3.5 py-2.5 gap-2 select-none"
              >
                {/* Calendar icon */}
                <span className="text-stone-500 dark:text-stone-400 shrink-0 text-sm">📅</span>
                {/* Display text */}
                <span className={`font-mono text-sm flex-1 ${startDate ? "text-stone-900 dark:text-[#fdfbf7]" : "text-stone-400 dark:text-stone-500"}`}>
                  {startDate ? formatDisplayDate(startDate) : "dd/mm/yyyy"}
                </span>
                {/* Visually-hidden native date input */}
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-pixel text-[8px] uppercase text-stone-700 dark:text-[#f5ebd5] mb-1.5">Travel Type</label>
              <div className="flex border-2 border-stone-800 dark:border-[#54463d] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setTravelType("solo")}
                  className={`flex-1 py-2 font-pixel text-[8px] uppercase transition-colors ${travelType === "solo" ? "bg-stone-800 text-[#fdfbf7] dark:bg-[#1e1815]" : "bg-[#fdfbf7] text-stone-500 dark:bg-[#28211d] dark:text-stone-400"}`}
                >
                  Solo
                </button>
                <div className="w-0.5 bg-stone-800 dark:bg-[#54463d]" />
                <button
                  type="button"
                  onClick={() => setTravelType("group")}
                  className={`flex-1 py-2 font-pixel text-[8px] uppercase transition-colors ${travelType === "group" ? "bg-stone-800 text-[#fdfbf7] dark:bg-[#1e1815]" : "bg-[#fdfbf7] text-stone-500 dark:bg-[#28211d] dark:text-stone-400"}`}
                >
                  Group
                </button>
              </div>
            </div>
            <div>
              <label className="block font-pixel text-[8px] uppercase text-stone-700 dark:text-[#f5ebd5] mb-1.5">Base Currency</label>
              <select
                value={baseCurrency}
                onChange={(e) => setBaseCurrency(e.target.value as Currency)}
                className="w-full border-2 bg-[#fdfbf7] px-3.5 py-2 font-mono text-sm text-stone-900 outline-none focus:border-stone-800 dark:bg-[#1e1815] dark:text-[#fdfbf7] border-stone-800 dark:border-[#54463d] h-[35px]"
              >
                {(Object.keys(CURRENCY_META) as Currency[]).map((c) => (
                  <option key={c} value={c}>{CURRENCY_META[c].flag} {c}</option>
                ))}
              </select>
            </div>
          </div>

          {travelType === "group" && (
            <div className="pt-2 border-t-2 border-stone-300 dark:border-stone-700 border-dashed">
              <label className="block font-pixel text-[8px] uppercase text-stone-700 dark:text-[#f5ebd5] mb-2">Companions (Friends)</label>
              <div className="space-y-2">
                {friends.map((friend, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      placeholder={`Friend ${idx + 1} Name`}
                      value={friend}
                      onChange={(e) => {
                        const newFriends = [...friends];
                        newFriends[idx] = e.target.value;
                        setFriends(newFriends);
                      }}
                      className="flex-1 bg-[#fdfbf7] dark:bg-[#1e1815] border-2 border-stone-400 focus:border-stone-800 dark:border-stone-600 px-3 py-1.5 outline-none font-mono text-xs text-stone-900 dark:text-[#fdfbf7]"
                    />
                    {friends.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setFriends(friends.filter((_, i) => i !== idx))}
                        className="w-8 border-2 border-red-300 bg-red-50 text-red-500 font-mono text-xs dark:border-red-900/50 dark:bg-red-900/20"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setFriends([...friends, ""])}
                  className="game-btn px-3 py-1.5 font-pixel text-[8px] uppercase bg-[#e8dcc4] text-stone-800 border-2 border-stone-400 dark:bg-[#28211d] dark:text-[#f5ebd5] dark:border-stone-600"
                >
                  + Add Friend
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 border-t-2 border-stone-800 dark:border-[#54463d] bg-stone-100 dark:bg-[#28211d]"
        >
          <button
            onClick={handleSave}
            className="game-btn w-full py-3 font-pixel text-[9px] uppercase tracking-wider bg-[#4a7c59] text-amber-100 dark:bg-[#2d5a3d]"
          >
            ✦ Begin the Journey ✦
          </button>
        </div>
      </div>
    </div>
  );
}
