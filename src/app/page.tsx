"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTrips } from "@/contexts/TripContext";
import { Trip, TripStatus, Currency } from "@/types/trip";
import { generateId, formatDate } from "@/lib/utils";
import CreateTripModal from "@/components/CreateTripModal";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";

export default function DashboardPage() {
  const { trips, isLoaded, userId, addTrip, deleteTrip, leaveTrip } = useTrips();
  const router = useRouter();
  const [tripToDelete, setTripToDelete] = useState<Trip | null>(null);
  const [modalStatus, setModalStatus] = useState<TripStatus | null>(null);

  if (!isLoaded) {
    return (
      <main className="min-h-screen px-4 py-10 sm:px-8 sm:py-14 bg-[#f4ecd8] dark:bg-[#28211d]">
        <header className="mb-12 text-center animate-pulse">
          <div className="mx-auto h-3 w-32 bg-stone-300 dark:bg-stone-700 mb-3"></div>
          <div className="mx-auto h-8 w-64 bg-stone-400 dark:bg-stone-600"></div>
          <div className="mx-auto mt-4 h-3 w-48 bg-stone-300 dark:bg-stone-700"></div>
        </header>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-10 max-w-6xl mx-auto">
          {[1, 2, 3].map((col) => (
            <div key={col} className="flex flex-col animate-pulse">
              <div className="h-24 w-full bg-stone-300 dark:bg-stone-700 mb-6 border-2 border-stone-800 dark:border-[#54463d]"></div>
              <div className="h-32 w-full bg-[#fdfbf7] dark:bg-[#362d28] mb-4 border-2 border-stone-800 dark:border-[#54463d]"></div>
              <div className="h-32 w-full bg-[#fdfbf7] dark:bg-[#362d28] mb-4 border-2 border-stone-800 dark:border-[#54463d]"></div>
            </div>
          ))}
        </div>
      </main>
    );
  }

  const nextTrips   = trips.filter((t) => t.status === "next");
  const pastTrips   = trips.filter((t) => t.status === "past");
  const bucketTrips = trips.filter((t) => t.status === "bucket");

  async function handleCreateTrip(data: { title: string; destination: string; startDate: string; endDate: string; travelType: "solo" | "group"; baseCurrency: Currency; friends: string[] }) {
    if (!modalStatus) return;

    const me = { id: `p-${generateId()}`, name: "Me", color: "bg-red-200 text-red-800 border-red-300 dark:bg-[#362d28] dark:text-[#fdfbf7] dark:border-[#54463d]" };
    const participants = [me];
    
    if (data.travelType === "group") {
      data.friends.forEach((friend, i) => {
        const colors = [
          "bg-blue-200 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
          "bg-green-200 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
          "bg-amber-200 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
          "bg-purple-200 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
        ];
        participants.push({
          id: `p-${generateId()}`,
          name: friend,
          color: colors[i % colors.length]
        });
      });
    }

    // addTrip no longer takes an id — Supabase generates the UUID.
    // It returns the real UUID on success, or null on failure.
    const realId = await addTrip({
      title: data.title,
      destination: data.destination,
      startDate: data.startDate,
      endDate: data.endDate,
      status: modalStatus,
      participants,
      days: [],
      expenses: [],
      travelType: data.travelType,
      baseCurrency: data.baseCurrency,
    });

    setModalStatus(null);

    if (realId) {
      router.push(`/trip/${realId}`);
    }
  }

  const columns: { status: TripStatus; icon: string; heading: string; sub: string }[] = [
    {
      status: "next",
      icon: "🗺️",
      heading: "Next EXPEDITIONS",
      sub: "Gear up and prepare your strategy. The next grand adventure is already on the horizon.",
    },
    {
      status: "past",
      icon: "📜",
      heading: "Completed SAGAS",
      sub: "Tales of conquered lands and unforgettable memories. The chronicles of our journey.",
    },
    {
      status: "bucket",
      icon: "⭐",
      heading: "THE WANDERLIST",
      sub: "Dreams waiting to become reality. Wild destinations calling our names.",
    },
  ];

  const tripsByStatus: Record<TripStatus, typeof trips> = {
    next: nextTrips,
    past: pastTrips,
    bucket: bucketTrips,
  };

  return (
    <main
      className="min-h-screen px-4 py-10 sm:px-8 sm:py-14 bg-[#f4ecd8] dark:bg-[#28211d]"
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="mb-12 text-center">
        <div className="mb-3 inline-block">
          <p className="font-pixel text-amber-700 dark:text-[#f5ebd5] text-[10px] tracking-widest mb-3 uppercase">
          ❖ Adventure Log ❖
        </p>
          <h1
          className="font-pixel text-stone-800 dark:text-[#fdfbf7] leading-tight"
          style={{ fontSize: "clamp(1rem, 4vw, 1.75rem)", textShadow: "3px 3px 0 #c8a96e, 5px 5px 0 #a08040" }}
        >
          Nomadic Journey
        </h1>
        </div>
        <p className="mt-4 text-amber-700 dark:text-[#f5ebd5] text-xs font-mono max-w-md mx-auto leading-relaxed">
          A minimalist command capsule to chart raw horizons and secure your expedition logs.
        </p>
      </header>

      {/* ── 3-Column Layout ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-10 max-w-6xl mx-auto">
        {columns.map(({ status, icon, heading, sub }) => (
          <section key={status} className="flex flex-col">
            {/* Column header as a wooden signboard */}
            <div
              className="mb-6 px-4 py-4 text-center bg-[#fdfbf7] dark:bg-[#362d28] border-2 border-stone-800 dark:border-[#54463d] shadow-[3px_3px_0_#292524] dark:shadow-[3px_3px_0_#54463d]"
            >
              <p className="text-2xl mb-2">{icon}</p>
              <h2 className="font-pixel text-stone-800 dark:text-[#fdfbf7] text-[10px] leading-relaxed uppercase">
                {heading}
              </h2>
              <p className="mt-2 text-amber-800 dark:text-[#f5ebd5] text-[9px] font-mono leading-relaxed">
                {sub}
              </p>
            </div>

            {/* Trip cards */}
            <div className="flex-1 space-y-4 mb-6">
              {tripsByStatus[status].map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  isOwner={trip.createdBy === userId || !userId}
                  onDeleteRequest={() => setTripToDelete(trip)}
                  onLeaveRequest={() => leaveTrip(trip.id)}
                />
              ))}

              {tripsByStatus[status].length === 0 && (
                <div className="py-8 text-center bg-[#fdfbf7]/50 dark:bg-[#362d28]/50 border-2 border-dashed border-stone-400 dark:border-stone-600">
                  <p className="text-stone-500 dark:text-[#f5ebd5] font-mono text-[10px]">— Empty —</p>
                </div>
              )}
            </div>

            {/* ➕ Add button */}
            <button
              onClick={() => setModalStatus(status)}
              className="game-btn w-full py-3 font-pixel text-[9px] text-amber-100 uppercase tracking-wider"
              style={{ background: "linear-gradient(180deg, #4a7c59 0%, #2d5a3d 100%)" }}
            >
              ➕ New Trip
            </button>
          </section>
        ))}
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {modalStatus && (
        <CreateTripModal
          status={modalStatus}
          onSave={handleCreateTrip}
          onClose={() => setModalStatus(null)}
        />
      )}

      {tripToDelete && (
        <ConfirmDeleteModal
          title={tripToDelete.title}
          onConfirm={() => { deleteTrip(tripToDelete.id); setTripToDelete(null); }}
          onCancel={() => setTripToDelete(null)}
        />
      )}
    </main>
  );
}

/* ── Trip Card ──────────────────────────────────────────────────────────── */
function TripCard({
  trip,
  isOwner,
  onDeleteRequest,
  onLeaveRequest,
}: {
  trip: Trip;
  isOwner: boolean;
  onDeleteRequest: () => void;
  onLeaveRequest: () => void;
}) {
  const { updateTrip } = useTrips();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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

  const formattedDate = trip.startDate ? formatDate(trip.startDate) : "—";
  
  let totalDaysCount = trip.days?.length || 0;
  if (trip.startDate && trip.endDate) {
    const start = safeParseDate(trip.startDate);
    const end = safeParseDate(trip.endDate);
    if (start && end) {
      totalDaysCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
  }

  const STATUS_OPTIONS: { status: TripStatus; label: string }[] = [
    { status: "next", label: "Next EXPEDITIONS" },
    { status: "past", label: "Completed SAGAS" },
    { status: "bucket", label: "THE WANDERLIST" },
  ];
  const availableMoves = STATUS_OPTIONS.filter((o) => o.status !== trip.status);

  return (
    <div className="group relative bg-[#fdfbf7] dark:bg-[#362d28] border-2 border-stone-800 dark:border-[#54463d] shadow-[4px_4px_0_#292524] dark:shadow-[4px_4px_0_#54463d] transition-all duration-75 hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-[6px_6px_0_#292524] dark:hover:shadow-[6px_6px_0_#54463d]">
      <Link
        href={`/trip/${trip.id}`}
        className="block p-4"
      >
        <div className="flex items-start justify-between mb-2">
          <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 bg-stone-800 text-[#fdfbf7] border-2 border-stone-900 dark:bg-[#1e1815] dark:border-[#54463d]">
            {trip.destination}
          </span>
          <span className="font-mono text-[9px] text-stone-600 dark:text-[#f5ebd5]">{formattedDate}</span>
        </div>
        <h3 className="font-pixel text-stone-800 dark:text-[#fdfbf7] text-[10px] leading-relaxed mt-3 mb-1 pr-6">
          {trip.title}
        </h3>
        <p className="font-mono text-[9px] text-stone-600 dark:text-[#f5ebd5] mb-2">
          {trip.participants.length} travelers · {totalDaysCount} days
        </p>
      </Link>

      {/* Move Dropdown */}
      <div className="absolute bottom-3 right-3 z-20">
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsDropdownOpen(!isDropdownOpen); }}
          className={`font-pixel text-[8px] px-2 py-1.5 uppercase tracking-wider bg-[#e8dcc4] text-stone-800 border-2 border-stone-800 dark:bg-[#28211d] dark:text-[#f5ebd5] dark:border-[#54463d] shadow-[2px_2px_0_#292524] dark:shadow-[2px_2px_0_#1e1815] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center gap-1 ${isDropdownOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'}`}
        >
          <span>🔄 Move</span>
        </button>

        {isDropdownOpen && (
          <>
            <div 
              className="fixed inset-0 z-10" 
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsDropdownOpen(false); }}
            />
            <div className="absolute bottom-full right-0 mb-2 w-44 bg-[#fdfbf7] dark:bg-[#362d28] border-2 border-stone-800 dark:border-[#54463d] shadow-[3px_3px_0_#292524] dark:shadow-[3px_3px_0_#1e1815] z-20">
              <ul className="flex flex-col">
                {availableMoves.map((opt) => (
                  <li key={opt.status} className="border-b-2 last:border-b-0 border-stone-200 dark:border-stone-700">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        updateTrip(trip.id, { status: opt.status });
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 font-mono text-[9px] hover:bg-[#e8dcc4] dark:hover:bg-[#28211d] text-stone-800 dark:text-[#fdfbf7] uppercase transition-colors"
                    >
                      To {opt.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>

      {/* Delete (owner) or Leave (member) button — revealed on hover */}
      {isOwner ? (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDeleteRequest();
          }}
          title="Delete Trip"
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 font-mono text-[10px] px-1.5 py-0.5 game-btn z-10"
          style={{
            background: "#8b1a1a",
            color: "#fde8e8",
            border: "2px solid #1a0f06",
            boxShadow: "2px 2px 0 #1a0f06",
            transition: "opacity 150ms",
          }}
        >
          🗑
        </button>
      ) : (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onLeaveRequest();
          }}
          title="Leave Trip"
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 font-pixel text-[7px] uppercase px-1.5 py-0.5 game-btn z-10"
          style={{
            background: "#7c5c1a",
            color: "#fef3c7",
            border: "2px solid #1a0f06",
            boxShadow: "2px 2px 0 #1a0f06",
            transition: "opacity 150ms",
          }}
        >
          ↩ Leave
        </button>
      )}
    </div>
  );
}
