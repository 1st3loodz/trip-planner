import { useState, useRef, useEffect } from "react";
import { Trip } from "@/types/trip";
import { formatDate } from "@/lib/utils";
import Avatar from "@/components/Avatar";
import { useTrips } from "@/contexts/TripContext";
import EditTripModal from "@/components/EditTripModal";
import { createClient } from "@/utils/supabase/client";

interface TripHeaderProps {
  trip: Trip;
  activeTab: "itinerary" | "expenses";
  onTabChange: (tab: "itinerary" | "expenses") => void;
  onManageMembers: () => void;
  onRefreshRequest: () => void;
}

export default function TripHeader({ trip, activeTab, onTabChange, onManageMembers, onRefreshRequest }: TripHeaderProps) {
  const [showEditModal,   setShowEditModal]   = useState(false);
  const [isEditingNotice, setIsEditingNotice]  = useState(false);
  const [noticeText,      setNoticeText]       = useState(trip.notice ?? "");
  const [isSavingNotice,  setIsSavingNotice]   = useState(false);
  const [linkCopied,     setLinkCopied]      = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCopyInviteLink = () => {
    const url = `https://trip-planner-six-kappa.vercel.app/trip/${trip.id}/invite`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    });
  };
  const { updateTrip } = useTrips();

  // Sync noticeText whenever the parent trip prop refreshes
  useEffect(() => {
    setNoticeText(trip.notice ?? "");
  }, [trip.notice]);

  const handleSaveTrip = async (data: { title: string; destination: string; startDate: string; endDate: string }) => {
    const formatToISO = (dateStr: string) => {
      if (!dateStr) return dateStr;
      if (dateStr.includes('/')) {
        const [day, month, year] = dateStr.split('/');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      return dateStr;
    };

    await updateTrip(trip.id, {
      ...data,
      startDate: formatToISO(data.startDate),
      endDate: formatToISO(data.endDate),
    });
    setShowEditModal(false);
    onRefreshRequest();
  };

  const handleSaveNotice = async () => {
    setIsSavingNotice(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("trips")
        .update({ notice: noticeText.trim() || null })
        .eq("id", trip.id);

      if (error) {
        console.error("[TripHeader] Supabase update failed for notice:", error);
        alert(`Failed to save notice: ${error.message}`);
        setIsSavingNotice(false);
        return;
      }
      setIsEditingNotice(false);
      onRefreshRequest();
    } catch (err) {
      console.error("[TripHeader] Failed to save notice:", err);
    } finally {
      setIsSavingNotice(false);
    }
  };

  const handleStartEdit = () => {
    setIsEditingNotice(true);
    // Focus textarea on next paint
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const safeParseDate = (dateString: string) => {
    if (!dateString) return null;
    const segments = dateString.split('/');
    if (segments.length === 3) {
      const day = parseInt(segments[0], 10);
      const month = parseInt(segments[1], 10) - 1;
      let year = parseInt(segments[2], 10);
      if (year < 100) year += 2000;
      return new Date(year, month, day);
    }
    return new Date(dateString);
  };

  let totalDaysCount = trip.days?.length || 0;
  if (trip.startDate && trip.endDate) {
    const start = safeParseDate(trip.startDate);
    const end = safeParseDate(trip.endDate);
    if (start && end) {
      totalDaysCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
  }

  return (
    <header className="relative mb-6">
      {/* Main parchment banner */}
      <div
        className="relative bg-[#fdfbf7] dark:bg-[#362d28] border-2 border-stone-800 dark:border-[#54463d] shadow-[6px_6px_0_#292524] dark:shadow-[6px_6px_0_#54463d]"
      >
        {/* Inner border accent */}
        <div className="absolute inset-1 border-2 border-stone-300 dark:border-stone-600 pointer-events-none" />

        <div className="relative px-6 py-6 md:px-8">
          {/* Top row: destination tag + edit button */}
          <div className="mb-4 flex items-center justify-between">
            <span
              className="font-mono text-[9px] uppercase tracking-widest px-2 py-1 bg-stone-800 text-[#fdfbf7] border-2 border-stone-900 dark:bg-[#1e1815] dark:border-[#54463d]"
            >
              📍 {trip.destination}
            </span>

            <button
              onClick={() => setShowEditModal(true)}
              className="game-btn px-3 py-1.5 font-pixel text-[7px] uppercase bg-[#f5eed7] text-stone-800 dark:bg-[#1e1815] dark:text-[#fdfbf7] dark:border-[#54463d]"
            >
              ✏ Edit
            </button>
          </div>

          {/* Trip title */}
          <h1
            className="font-pixel text-stone-800 dark:text-[#fdfbf7] mb-1 leading-relaxed"
            style={{ fontSize: "clamp(0.65rem, 2vw, 0.9rem)", textShadow: "2px 2px 0 #e7e5e4" }}
          >
            {trip.title}
          </h1>
          <p className="font-mono text-stone-600 dark:text-[#f5ebd5] text-xs mb-5">
            {formatDate(trip.startDate)} → {formatDate(trip.endDate)} · {totalDaysCount} days
          </p>

          {/* Stat chips */}
          <div className="mb-5 flex flex-wrap gap-3">
            {[
              { icon: "📅", label: "Days",       value: totalDaysCount },
              { icon: "📌", label: "Activities", value: trip.days.flatMap((d) => d.activities).length },
              { icon: "💰", label: "Expenses",   value: trip.expenses.length },
              { icon: "👥", label: "Travelers",  value: trip.participants.length },
            ].map((s) => (
              <div
                key={s.label}
                className="flex items-center gap-2 px-3 py-2 bg-[#f5eed7] border-2 border-stone-800 dark:bg-[#1e1815] dark:border-[#54463d]"
              >
                <span className="text-base">{s.icon}</span>
                <div>
                  <div className="font-mono text-[8px] uppercase text-stone-600 dark:text-stone-400">{s.label}</div>
                  <div className="font-pixel text-[9px] text-stone-800 dark:text-[#fdfbf7]">{s.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Participants row + Manage button */}
          <div className="flex flex-wrap items-center gap-3 mb-0">
            <span className="font-mono text-[9px] uppercase tracking-widest text-stone-600 dark:text-[#f5ebd5] shrink-0">
              Party:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {trip.participants.map((p) => (
                <Avatar key={p.id} name={p.name} colorClass={p.color} avatarUrl={p.avatarUrl} size="sm" />
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={handleCopyInviteLink}
                className={`game-btn flex items-center gap-1.5 px-3 py-1.5 font-pixel text-[7px] uppercase transition-colors ${
                  linkCopied
                    ? "bg-amber-600 text-white dark:bg-amber-700"
                    : "bg-[#f5eed7] text-stone-800 dark:bg-[#1e1815] dark:text-[#fdfbf7] dark:border-[#54463d]"
                }`}
              >
                {linkCopied ? "✔ Copied!" : "🔗 Invite Link"}
              </button>
              <button
                onClick={onManageMembers}
                className="game-btn flex items-center gap-1.5 px-3 py-1.5 font-pixel text-[7px] uppercase bg-[#4a7c59] text-[#fdfbf7] dark:bg-[#2d5a3d]"
              >
                👥 Manage Party
              </button>
            </div>
          </div>
        </div>

        {/* ── Trip Notes / Announcement Board ──────────────────────────── */}
        <div className="mx-6 mb-5 md:mx-8 border-2 border-stone-800 dark:border-[#54463d] bg-[#f5eed7] dark:bg-[#1e1815] shadow-[3px_3px_0_#292524] dark:shadow-[3px_3px_0_#54463d]">
          {/* Notes header */}
          <div className="flex items-center justify-between border-b-2 border-stone-800 dark:border-[#54463d] bg-[#e8dcc4] dark:bg-[#362d28] px-4 py-2">
            <span className="font-pixel text-[8px] uppercase tracking-widest text-stone-800 dark:text-[#fdfbf7]">
              📝 Trip Notice
            </span>
            <div className="flex items-center gap-2">
              {isEditingNotice ? (
                <>
                  <button
                    onClick={() => { setIsEditingNotice(false); setNoticeText(trip.notice ?? ""); }}
                    disabled={isSavingNotice}
                    className="game-btn px-2.5 py-1 font-pixel text-[7px] uppercase tracking-wider border-2 border-stone-800 bg-[#fdfbf7] text-stone-800 dark:border-[#54463d] dark:bg-[#28211d] dark:text-[#fdfbf7] disabled:opacity-50"
                  >
                    ✕ Cancel
                  </button>
                  <button
                    onClick={handleSaveNotice}
                    disabled={isSavingNotice}
                    className="game-btn px-2.5 py-1 font-pixel text-[7px] uppercase tracking-wider bg-[#4a7c59] text-[#fdfbf7] dark:bg-[#2d5a3d] disabled:opacity-50"
                  >
                    {isSavingNotice ? "Saving..." : "💾 Save"}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleStartEdit}
                  className="game-btn px-2.5 py-1 font-pixel text-[7px] uppercase tracking-wider border-2 border-stone-800 bg-[#fdfbf7] text-stone-800 dark:border-[#54463d] dark:bg-[#28211d] dark:text-[#fdfbf7]"
                >
                  ✎ Edit Note
                </button>
              )}
            </div>
          </div>

          {/* Notes body */}
          <div className="px-4 py-3">
            {isEditingNotice ? (
              <textarea
                ref={textareaRef}
                value={noticeText}
                onChange={(e) => setNoticeText(e.target.value)}
                placeholder="Write a shared announcement, reminders, or notes for your travel crew..."
                rows={4}
                className="w-full resize-y border-2 border-stone-400 bg-[#fdfbf7] px-3 py-2.5 font-mono text-xs text-stone-900 placeholder-stone-400 outline-none focus:border-stone-800 dark:border-stone-600 dark:bg-[#28211d] dark:text-[#fdfbf7] dark:placeholder-stone-500 dark:focus:border-[#f5ebd5]"
              />
            ) : noticeText.trim() ? (
              <p className="font-mono text-xs leading-relaxed text-stone-700 dark:text-[#f5ebd5] whitespace-pre-wrap">{noticeText}</p>
            ) : (
              <p className="font-mono text-[10px] italic text-stone-400 dark:text-stone-500">
                No announcements yet. Click ✎ Edit Note to add a shared message for your crew.
              </p>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-t-2 border-stone-800 dark:border-[#54463d]">
          {([
            { key: "itinerary",  label: "🗓 Journal"    },
            { key: "expenses",   label: "💰 Gold Ledger" },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onTabChange(key)}
              className={`flex-1 py-3 font-pixel text-[8px] uppercase tracking-wider transition-colors ${
                activeTab === key
                  ? "bg-stone-800 text-[#fdfbf7] dark:bg-[#1e1815]"
                  : "bg-[#f5eed7] text-stone-600 dark:bg-[#362d28] dark:text-[#f5ebd5]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {showEditModal && (
        <EditTripModal
          trip={trip}
          onSave={handleSaveTrip}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </header>
  );
}
