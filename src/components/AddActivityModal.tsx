"use client";

import { useState, useEffect } from "react";
import { ActivityItem, ActivityCategory, DayPlan } from "@/types/trip";
import { ACTIVITY_CATEGORY_META, generateId } from "@/lib/utils";

interface AddActivityModalProps {
  days: DayPlan[];
  startDate: string;
  endDate: string;
  initialActivity?: ActivityItem & { dayNumber: number };
  onSave: (dayNumber: number, activity: ActivityItem) => Promise<void> | void;
  onClose: () => void;
  customCategories: { id: string; label: string; emoji: string }[];
  onAddCustomCategory: (cat: { id: string; label: string; emoji: string }) => void;
  setRefreshToggle?: React.Dispatch<React.SetStateAction<number>>;
}

function parseDateStrict(dateStr: string): Date {
  if (!dateStr) return new Date();
  // Safely trap DD/MM/YY string splits
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const yearStr = parts[2].trim();
      const fullYear = yearStr.length === 2 ? '20' + yearStr : yearStr;
      return new Date(parseInt(fullYear, 10), month, day);
    }
  }
  return new Date(dateStr);
}

function calculateTotalDays(startStr: string, endStr: string): number {
  if (!startStr || !endStr) return 1;
  const start = parseDateStrict(startStr);
  const end = parseDateStrict(endStr);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays === 0 ? 1 : diffDays + 1; // Always at least 1 day
}

const CATEGORIES = Object.keys(ACTIVITY_CATEGORY_META) as ActivityCategory[];

export default function AddActivityModal({ days, startDate, endDate, initialActivity, onSave, onClose, customCategories, onAddCustomCategory, setRefreshToggle }: AddActivityModalProps) {
  const totalDays = calculateTotalDays(startDate, endDate);
  
  const isEdit = !!initialActivity;
  const [dayNumber,    setDayNumber]    = useState(initialActivity?.dayNumber ?? days[0]?.dayNumber ?? 1);
  const [hour,         setHour]         = useState(initialActivity?.time?.split(':')[0] ?? "09");
  const [minute,       setMinute]       = useState(initialActivity?.time?.split(':')[1] ?? "00");
  const [title,        setTitle]        = useState(initialActivity?.title ?? "");
  const [description,  setDescription]  = useState(initialActivity?.description ?? "");
  const [location,     setLocation]     = useState(initialActivity?.location ?? "");
  const [transport,    setTransport]    = useState(initialActivity?.transportationNote ?? "");
  const [category,     setCategory]     = useState<ActivityCategory>(initialActivity?.category ?? "sightseeing");
  const [errors,       setErrors]       = useState<Record<string,string>>({});

  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCatEmoji, setNewCatEmoji] = useState("✨");
  const [newCatLabel, setNewCatLabel] = useState("");

  function handleSaveCustomCategory() {
    if (!newCatLabel.trim()) return;
    const newCat = {
      id: `cat-${generateId()}`,
      label: newCatLabel.trim(),
      emoji: newCatEmoji.trim() || "✨",
    };
    onAddCustomCategory(newCat);
    setCategory(newCat.id);
    setIsAddingCategory(false);
    setNewCatLabel("");
    setNewCatEmoji("✨");
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  async function handleSubmit() {
    const errs: Record<string,string> = {};
    if (!title.trim()) errs.title = "Activity title is required.";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    await onSave(dayNumber, {
      id: initialActivity?.id ?? `act-${generateId()}`,
      time: `${hour}:${minute}`,
      title: title.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      transportationNote: transport.trim() || undefined,
      category,
    });
    setRefreshToggle?.((prev: number) => prev + 1);
    onClose();
  }

  const selectedDay = days.find((d) => d.dayNumber === dayNumber);

  const inputCls = (err?: string) =>
    `w-full border-2 bg-[#fdfbf7] px-3.5 py-2.5 font-mono text-sm text-stone-900 placeholder-stone-400 outline-none focus:border-stone-800 dark:bg-[#1e1815] dark:text-[#fdfbf7] dark:placeholder-stone-500 ${err ? "border-red-400 dark:border-red-500" : "border-stone-400 dark:border-stone-600"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm dark:bg-black/70" />
      <div className="relative w-full max-w-lg overflow-hidden border-4 border-stone-800 bg-[#f4ecd8] shadow-[8px_8px_0_#292524] dark:border-[#54463d] dark:bg-[#28211d] dark:shadow-[8px_8px_0_#1e1815]">

        {/* Header */}
        <div className="flex items-center justify-between border-b-4 border-stone-800 bg-[#e8dcc4] px-6 py-4 dark:border-[#54463d] dark:bg-[#362d28]">
          <div>
            <h2 className="font-pixel text-sm uppercase tracking-wider text-stone-900 dark:text-[#fdfbf7]">{isEdit ? "Edit Activity" : "Add Activity"}</h2>
            <p className="mt-1 font-mono text-[10px] text-stone-600 dark:text-stone-400">{isEdit ? "Update activity details" : "Add a new activity to your itinerary"}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center border-2 border-stone-800 bg-[#fdfbf7] font-pixel text-stone-800 hover:bg-stone-200 dark:border-[#54463d] dark:bg-[#1e1815] dark:text-[#fdfbf7] dark:hover:bg-[#362d28]">✕</button>
        </div>

        {/* Body */}
        <div className="max-h-[75vh] overflow-y-auto px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block font-pixel text-[8px] uppercase tracking-widest text-stone-600 dark:text-stone-400">Day *</label>
              <select value={dayNumber} onChange={(e) => setDayNumber(Number(e.target.value))}
                className="w-full border-2 border-stone-400 bg-[#fdfbf7] px-3.5 py-2.5 font-mono text-sm text-stone-900 outline-none focus:border-stone-800 dark:border-stone-600 dark:bg-[#1e1815] dark:text-[#fdfbf7]">
                {Array.from({ length: totalDays }, (_, i) => i + 1).map(dayNum => {
                  const d = days.find(x => x.dayNumber === dayNum);
                  
                  const baseDate = parseDateStrict(startDate);
                  const itemDate = new Date(baseDate);
                  itemDate.setDate(baseDate.getDate() + (dayNum - 1));
                  const displayDD = String(itemDate.getDate()).padStart(2, '0');
                  const displayMM = String(itemDate.getMonth() + 1).padStart(2, '0');
                  const displayYYYY = itemDate.getFullYear();
                  const formattedStr = `${displayDD}/${displayMM}/${displayYYYY}`;
                  
                  return <option key={dayNum} value={dayNum}>Day {dayNum} ({formattedStr}){d?.label ? ` — ${d.label}` : ""}</option>;
                })}
              </select>
              {selectedDay && <p className="mt-1 font-mono text-[10px] text-stone-400 dark:text-stone-600">{new Date(selectedDay.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>}
            </div>
            <div>
              <label className="mb-1.5 block font-pixel text-[8px] uppercase tracking-widest text-stone-600 dark:text-stone-400">Time *</label>
              <div className="flex gap-2">
                <select 
                  value={hour} 
                  onChange={(e) => setHour(e.target.value)}
                  className="w-full border-2 border-stone-400 bg-[#fdfbf7] px-3.5 py-2.5 font-mono text-sm text-stone-900 outline-none focus:border-stone-800 dark:border-stone-600 dark:bg-[#1e1815] dark:text-[#fdfbf7]"
                >
                  {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')).map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <span className="flex items-center font-pixel text-stone-900 dark:text-[#fdfbf7]">:</span>
                <select 
                  value={minute} 
                  onChange={(e) => setMinute(e.target.value)}
                  className="w-full border-2 border-stone-400 bg-[#fdfbf7] px-3.5 py-2.5 font-mono text-sm text-stone-900 outline-none focus:border-stone-800 dark:border-stone-600 dark:bg-[#1e1815] dark:text-[#fdfbf7]"
                >
                  {Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0')).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block font-pixel text-[8px] uppercase tracking-widest text-stone-600 dark:text-stone-400">Category</label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {CATEGORIES.map((cat) => {
                const m = ACTIVITY_CATEGORY_META[cat];
                const active = category === cat;
                return (
                  <button key={cat} type="button" onClick={() => setCategory(cat)}
                    className={`flex flex-col items-center gap-1 border-2 px-2 py-2.5 text-center transition-all ${active ? "border-stone-800 bg-[#f5eed7] text-stone-900 shadow-[2px_2px_0_#292524] dark:border-[#54463d] dark:bg-[#362d28] dark:text-[#fdfbf7] dark:shadow-[2px_2px_0_#1e1815]" : "border-stone-400 bg-[#fdfbf7] text-stone-500 hover:border-stone-600 dark:border-stone-600 dark:bg-[#28211d] dark:text-stone-400 dark:hover:border-[#54463d]"}`}>
                    <span className="text-xl">{m.emoji}</span>
                    <span className="font-mono text-[10px] font-bold leading-tight">{m.label}</span>
                  </button>
                );
              })}
              {customCategories.map((cat) => {
                const active = category === cat.id;
                return (
                  <button key={cat.id} type="button" onClick={() => setCategory(cat.id)}
                    className={`flex flex-col items-center gap-1 border-2 px-2 py-2.5 text-center transition-all ${active ? "border-stone-800 bg-[#f5eed7] text-stone-900 shadow-[2px_2px_0_#292524] dark:border-[#54463d] dark:bg-[#362d28] dark:text-[#fdfbf7] dark:shadow-[2px_2px_0_#1e1815]" : "border-stone-400 bg-[#fdfbf7] text-stone-500 hover:border-stone-600 dark:border-stone-600 dark:bg-[#28211d] dark:text-stone-400 dark:hover:border-[#54463d]"}`}>
                    <span className="text-xl">{cat.emoji}</span>
                    <span className="font-mono text-[10px] font-bold leading-tight">{cat.label}</span>
                  </button>
                );
              })}
              {isAddingCategory ? (
                <div className="col-span-3 sm:col-span-4 flex items-center gap-2 border-2 border-stone-800 bg-[#e8dcc4] p-2 dark:border-[#54463d] dark:bg-[#362d28] shadow-[2px_2px_0_#292524] dark:shadow-[2px_2px_0_#1e1815]">
                  <input type="text" placeholder="✨" value={newCatEmoji} onChange={(e) => setNewCatEmoji(e.target.value)} title="Pick an emoji"
                    className="w-8 h-8 text-center text-lg bg-[#fdfbf7] dark:bg-[#28211d] border-2 border-stone-400 focus:border-stone-800 dark:border-stone-500 outline-none cursor-pointer hover:bg-[#f5eed7] dark:hover:bg-[#362d28] transition-colors shadow-[1px_1px_0_#a8a29e] dark:shadow-[1px_1px_0_#54463d]" />
                  <input type="text" placeholder="Custom Name" value={newCatLabel} onChange={(e) => setNewCatLabel(e.target.value)} 
                    className="flex-1 h-8 bg-[#fdfbf7] dark:bg-[#1e1815] border-2 border-stone-400 focus:border-stone-800 dark:border-stone-600 px-2 outline-none font-mono text-[10px] text-stone-900 dark:text-[#fdfbf7] placeholder-stone-400" />
                  <button type="button" onClick={handleSaveCustomCategory} disabled={!newCatLabel.trim()} className="h-8 bg-[#4a7c59] text-[#fdfbf7] px-3 font-pixel text-[10px] disabled:opacity-50 border-2 border-stone-800 dark:border-[#2d5a3d]">Save</button>
                  <button type="button" onClick={() => setIsAddingCategory(false)} className="h-8 bg-[#fdfbf7] dark:bg-[#1e1815] text-stone-800 dark:text-[#fdfbf7] px-2 font-pixel text-[10px] border-2 border-stone-800 dark:border-stone-600">✕</button>
                </div>
              ) : (
                <button type="button" onClick={() => setIsAddingCategory(true)}
                  className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-stone-400 bg-[#fdfbf7] px-2 py-2.5 text-center transition-all hover:border-stone-600 dark:border-stone-600 dark:bg-[#28211d] text-stone-500 hover:text-stone-700 dark:hover:text-stone-300">
                  <span className="text-lg">➕</span>
                  <span className="font-mono text-[10px] font-bold leading-tight">Add Custom</span>
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block font-pixel text-[8px] uppercase tracking-widest text-stone-600 dark:text-stone-400">Activity Title *</label>
            <input type="text" placeholder="e.g. Visit Forbidden City" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls(errors.title)} />
            {errors.title && <p className="mt-1 font-mono text-[10px] text-red-600 dark:text-red-400">{errors.title}</p>}
          </div>

          <div>
            <label className="mb-1.5 block font-pixel text-[8px] uppercase tracking-widest text-stone-600 dark:text-stone-400">Details / Notes</label>
            <textarea rows={3} placeholder="Any useful details, tips, or reminders..." value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full resize-none border-2 border-stone-400 bg-[#fdfbf7] px-3.5 py-2.5 font-mono text-sm text-stone-900 placeholder-stone-400 outline-none focus:border-stone-800 dark:border-stone-600 dark:bg-[#1e1815] dark:text-[#fdfbf7] dark:placeholder-stone-500" />
          </div>

          <div>
            <label className="mb-1.5 block font-pixel text-[8px] uppercase tracking-widest text-stone-600 dark:text-stone-400">📍 Location</label>
            <input type="text" placeholder="e.g. 4 Jingshan Front St, Dongcheng" value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls()} />
          </div>

          <div>
            <label className="mb-1.5 block font-pixel text-[8px] uppercase tracking-widest text-stone-600 dark:text-stone-400">🚌 Transportation</label>
            <input type="text" placeholder="e.g. Subway Line 1 → Wangfujing Station" value={transport} onChange={(e) => setTransport(e.target.value)} className={inputCls()} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t-4 border-stone-800 bg-[#e8dcc4] px-6 py-4 dark:border-[#54463d] dark:bg-[#362d28]">
          <button onClick={onClose} className="game-btn flex-1 border-2 border-stone-800 bg-[#fdfbf7] py-2.5 font-pixel text-[10px] uppercase tracking-wider text-stone-800 dark:border-[#54463d] dark:bg-[#28211d] dark:text-[#fdfbf7]">Cancel</button>
          <button onClick={handleSubmit} className="game-btn flex-1 bg-[#4a7c59] py-2.5 font-pixel text-[10px] uppercase tracking-wider text-[#fdfbf7] dark:bg-[#2d5a3d]">
            {isEdit ? "Save Changes" : "Add Activity"}
          </button>
        </div>
      </div>
    </div>
  );
}
