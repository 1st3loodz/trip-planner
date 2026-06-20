"use client";

import { useEffect } from "react";

interface ConfirmDeleteModalProps {
  title: string;
  description?: string;
  itemName?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDeleteModal({ title, description, itemName = "adventure", onConfirm, onCancel }: ConfirmDeleteModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="absolute inset-0 bg-stone-900/60 dark:bg-black/70" />

      <div
        className="relative w-full max-w-sm bg-[#fdfbf7] dark:bg-[#362d28] border-2 border-red-800 dark:border-red-900 shadow-[8px_8px_0_#991b1b] dark:shadow-[8px_8px_0_#7f1d1d]"
      >
        {/* Inner border */}
        <div className="absolute inset-1 border-2 border-red-300 dark:border-red-800 pointer-events-none" />

        {/* Header */}
        <div
          className="px-6 py-4 bg-red-700 dark:bg-red-900 border-b-2 border-red-800 dark:border-red-900"
        >
          <h2 className="font-pixel text-[9px] uppercase text-red-100">⚠ Warning!</h2>
        </div>

        {/* Body */}
        <div className="relative px-6 py-6">
          <p className="font-pixel text-stone-800 dark:text-[#fdfbf7] text-[9px] leading-relaxed mb-2">Delete this {itemName}?</p>
          <p className="font-mono text-stone-600 dark:text-[#f5ebd5] text-xs leading-relaxed">
            {description ? description : (
              <>
                Are you sure you want to remove{" "}
                <strong className="text-stone-800 dark:text-red-400">{title}</strong>?
                This cannot be undone. All itinerary, expenses, and party data will be lost.
              </>
            )}
          </p>
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-3 px-6 py-4 bg-stone-100 dark:bg-[#28211d] border-t-2 border-red-800 dark:border-red-900"
        >
          <button
            onClick={onCancel}
            className="game-btn flex-1 py-2.5 font-pixel text-[8px] uppercase bg-[#f5eed7] text-stone-800 dark:bg-[#1e1815] dark:text-[#fdfbf7] dark:border-[#54463d]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="game-btn flex-1 py-2.5 font-pixel text-[8px] uppercase bg-red-600 text-[#fdfbf7] dark:bg-red-800 dark:border-red-900"
          >
            🗑 Delete
          </button>
        </div>
      </div>
    </div>
  );
}
