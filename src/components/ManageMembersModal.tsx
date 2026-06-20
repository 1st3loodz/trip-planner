"use client";

import { useState, useEffect } from "react";
import { Participant, Expense } from "@/types/trip";
import { generateId } from "@/lib/utils";
import Avatar from "@/components/Avatar";
import { createClient } from "@/utils/supabase/client";

const COLOR_POOL = [
  "bg-amber-600 text-white",   "bg-emerald-700 text-white", "bg-rose-700 text-white",    "bg-teal-700 text-white",
  "bg-orange-600 text-white",  "bg-lime-700 text-white",    "bg-cyan-700 text-white",    "bg-sky-700 text-white",
  "bg-red-700 text-white",     "bg-green-700 text-white",   "bg-yellow-600 text-white",  "bg-indigo-700 text-white",
  "bg-fuchsia-700 text-white", "bg-violet-700 text-white",  "bg-pink-700 text-white",    "bg-stone-600 text-white",
];

function getAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLOR_POOL[Math.abs(hash) % COLOR_POOL.length];
}

interface ManageMembersModalProps {
  tripId:       string;
  participants: Participant[];
  expenses:     Expense[];
  onAdd:        (p: Participant) => Promise<void> | void;
  onRemove:     (id: string) => Promise<void> | void;
  onClose:      () => void;
  setRefreshToggle?: React.Dispatch<React.SetStateAction<number>>;
}

export default function ManageMembersModal({
  tripId, participants, expenses, onAdd, onRemove, onClose, setRefreshToggle
}: ManageMembersModalProps) {
  const [name,     setName]     = useState("");
  const [error,    setError]    = useState("");
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  function getMemberExpenseCount(id: string) {
    return expenses.filter(
      (e) => e.paidById === id || e.splits.some((s) => s.participantId === id)
    ).length;
  }

  async function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) { setError("Please enter a name."); return; }
    if (participants.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(`"${trimmed}" is already in your party.`);
      return;
    }
    const color = getAvatarColor(trimmed);
    await onAdd({ id: `member-${generateId()}`, name: trimmed, color });
    
    console.log("[Debug Modal] Database insertion completed for trip ID:", tripId);
    console.log("[Debug Modal] Executing refresh toggle flip...");

    // Explicitly trigger the global layout refetch!
    if (setRefreshToggle) {
      setRefreshToggle(prev => prev + 1);
    }

    setName("");
    setError("");
  }

  async function handleRemoveConfirmed(id: string) {
    const supabase = createClient();
    
    // Genuine Supabase Member Deletion explicitly inside the modal
    await supabase.from("trip_members").delete().eq("trip_id", tripId).or(`user_id.eq.${id},id.eq.${id}`);
    
    // Cascade expenses via parent callback
    await onRemove(id);
    
    setRemoving(null);
    
    // Post-Delete Instant Refresh: fire the state refresher pipeline
    if (setRefreshToggle) {
      setRefreshToggle(prev => prev + 1);
    }
  }

  const inputStyle: React.CSSProperties = {
    borderRadius: 0,
    fontFamily: "monospace",
    fontSize: "0.75rem",
    padding: "8px 12px",
    outline: "none",
    flex: 1,
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-stone-900/60 dark:bg-black/70" />

      <div
        className="relative flex flex-col w-full max-w-md max-h-[90vh] bg-[#fdfbf7] dark:bg-[#362d28] border-2 border-stone-800 dark:border-[#54463d] shadow-[6px_6px_0_#292524] dark:shadow-[6px_6px_0_#54463d]"
      >
        {/* Inner gold accent border */}
        <div className="absolute inset-1 border-2 border-stone-300 dark:border-stone-600 pointer-events-none z-0" />

        {/* Header */}
        <div
          className="relative flex items-center justify-between px-6 py-4 bg-stone-800 dark:bg-[#1e1815] border-b-2 border-stone-800 dark:border-[#54463d]"
        >
          <div>
            <h2 className="font-pixel text-[#fdfbf7] text-[9px] uppercase">👥 Party Members</h2>
            <p className="font-mono text-stone-400 dark:text-stone-500 text-[10px] mt-1">
              {participants.length} member{participants.length !== 1 ? "s" : ""} on this trip
            </p>
          </div>
          <button
            onClick={onClose}
            className="game-btn w-8 h-8 flex items-center justify-center font-mono text-sm bg-[#f5eed7] text-stone-800 dark:bg-[#362d28] dark:text-[#fdfbf7] dark:border-[#54463d]"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="relative overflow-y-auto px-6 py-5 space-y-5" style={{ flex: 1 }}>

          {/* Add new member */}
          <div>
            <label className="block font-pixel text-[8px] uppercase text-stone-700 dark:text-[#f5ebd5] mb-2">
              Add Party Member
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter name (e.g. Sarah)"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                style={inputStyle}
                className={`bg-[#f5eed7] dark:bg-[#1e1815] text-stone-800 dark:text-[#fdfbf7] border-2 ${error ? "border-red-600 dark:border-red-500" : "border-stone-800 dark:border-[#54463d]"}`}
              />
              <button
                onClick={handleAdd}
                className="game-btn shrink-0 px-4 py-2 font-pixel text-[8px] uppercase tracking-wider bg-[#4a7c59] text-[#fdfbf7] dark:bg-[#2d5a3d]"
              >
                + Add
              </button>
            </div>
            {error && (
              <p className="mt-1.5 font-mono text-[10px] text-red-700">⚠ {error}</p>
            )}
          </div>

          {/* Member list */}
          <div>
            <label className="block font-pixel text-[8px] uppercase text-stone-700 dark:text-[#f5ebd5] mb-2">
              Current Party ({participants.length})
            </label>

            {participants.length === 0 ? (
              <p className="py-4 text-center font-mono text-xs text-stone-600 dark:text-stone-400">
                No members yet. Add someone above!
              </p>
            ) : (
              <ul className="space-y-2">
                {participants.map((p) => {
                  const expCount  = getMemberExpenseCount(p.id);
                  const isPending = removing === p.id;
                  return (
                    <li
                      key={p.id}
                      className={`flex items-center gap-3 px-3 py-2.5 border-2 ${
                        isPending
                          ? "border-red-600 bg-red-50 dark:border-red-800 dark:bg-red-900/30"
                          : "border-stone-400 bg-[#f5eed7] dark:border-stone-600 dark:bg-[#28211d]"
                      }`}
                    >
                      <Avatar name={p.name} colorClass={p.color} size="sm" tooltip={false} />

                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs font-semibold text-stone-800 dark:text-[#fdfbf7] truncate">{p.name}</p>
                        {expCount > 0 && (
                          <p className="font-mono text-[10px] text-stone-600 dark:text-stone-400">
                            {expCount} expense{expCount > 1 ? "s" : ""}
                          </p>
                        )}
                      </div>

                      {isPending ? (
                        <div className="flex items-center gap-2 shrink-0">
                          {expCount > 0 && (
                            <span className="font-mono text-[9px] text-red-700 dark:text-red-400">⚠ Has {expCount}</span>
                          )}
                          <button
                            onClick={() => handleRemoveConfirmed(p.id)}
                            className="game-btn px-2 py-1 font-pixel text-[7px] uppercase bg-red-600 text-[#fdfbf7] dark:bg-red-800"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setRemoving(null)}
                            className="game-btn px-2 py-1 font-pixel text-[7px] uppercase bg-stone-300 text-stone-800 dark:bg-[#362d28] dark:text-[#fdfbf7] dark:border-[#54463d]"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setRemoving(p.id)}
                          title={`Remove ${p.name}`}
                          className="game-btn flex h-7 w-7 shrink-0 items-center justify-center font-mono text-xs bg-stone-300 text-stone-600 dark:bg-[#362d28] dark:text-[#fdfbf7] dark:border-[#54463d]"
                        >
                          ✕
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Info note */}
          <div
            className="px-4 py-3 font-mono text-[10px] text-stone-700 dark:text-stone-300 leading-relaxed bg-[#f5eed7] border-2 border-stone-400 dark:bg-[#28211d] dark:border-stone-600"
          >
            <strong>Note:</strong> Removing a member automatically removes them from any expense splits and recalculates the remaining shares.
          </div>
        </div>

        {/* Footer */}
        <div
          className="relative px-6 py-4 bg-stone-100 border-t-2 border-stone-800 dark:bg-[#28211d] dark:border-[#54463d]"
        >
          <button
            onClick={onClose}
            className="game-btn w-full py-3 font-pixel text-[9px] uppercase tracking-wider bg-[#4a7c59] text-amber-100 dark:bg-[#2d5a3d]"
          >
            ✦ Done ✦
          </button>
        </div>
      </div>
    </div>
  );
}
