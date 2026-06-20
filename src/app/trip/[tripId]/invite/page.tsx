"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { User } from "@supabase/supabase-js";

// ─── Retro pixel-art helpers ──────────────────────────────────────────────────

const COLOR_POOL = [
  "bg-amber-600 text-white",   "bg-emerald-700 text-white", "bg-rose-700 text-white",
  "bg-teal-700 text-white",    "bg-orange-600 text-white",  "bg-lime-700 text-white",
  "bg-cyan-700 text-white",    "bg-sky-700 text-white",     "bg-red-700 text-white",
  "bg-green-700 text-white",   "bg-yellow-600 text-white",  "bg-indigo-700 text-white",
  "bg-fuchsia-700 text-white", "bg-violet-700 text-white",  "bg-pink-700 text-white",
  "bg-stone-600 text-white",
];

function getAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLOR_POOL[Math.abs(hash) % COLOR_POOL.length];
}

type Status = "loading" | "unauthenticated" | "joining" | "success" | "already_member" | "error";

export default function InvitePage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser]           = useState<User | null>(null);
  const [tripTitle, setTripTitle] = useState<string>("");
  const [status, setStatus]       = useState<Status>("loading");
  const [errorMsg, setErrorMsg]   = useState<string>("");

  // ── 1. Resolve auth session & trip info on mount ──────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);

      // Fetch trip name for display
      const { data: tripData } = await supabase
        .from("trips")
        .select("title")
        .eq("id", tripId)
        .single();

      if (tripData) setTripTitle(tripData.title);

      if (!authUser) {
        setStatus("unauthenticated");
        return;
      }

      // Auto-join immediately once authenticated
      await joinTrip(authUser);
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  // ── 2. Join logic ─────────────────────────────────────────────────────────
  async function joinTrip(authUser: User) {
    setStatus("joining");

    try {
      // Check if user is already a member
      const { data: existing } = await supabase
        .from("trip_members")
        .select("id")
        .eq("trip_id", tripId)
        .eq("user_id", authUser.id)
        .single();

      if (existing) {
        setStatus("already_member");
        setTimeout(() => { window.location.href = `/trip/${tripId}`; }, 1800);
        return;
      }

      // Resolve display name from profiles table, fallback to email prefix
      const { data: profile } = await supabase
        .from("profiles")
        .select("nickname")
        .eq("id", authUser.id)
        .single();

      const displayName =
        profile?.nickname ||
        authUser.email?.split("@")[0] ||
        "New Traveler";

      // Insert new member row
      const { error: insertError } = await supabase
        .from("trip_members")
        .insert({
          trip_id:        tripId,
          user_id:        authUser.id,
          temporary_name: displayName,
        });

      if (insertError) {
        // Unique violation → already joined by a race condition
        if (insertError.code === "23505") {
          setStatus("already_member");
          setTimeout(() => router.push(`/trip/${tripId}`), 1800);
          return;
        }
        throw new Error(insertError.message);
      }

      setStatus("success");
      // Hard redirect (not soft push) so the browser re-fetches with fresh
      // Supabase session cookies and the new trip_members RLS permissions apply.
      setTimeout(() => { window.location.href = `/trip/${tripId}`; }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      setStatus("error");
    }
  }

  // ── 3. Google sign-in (preserves invite URL as redirect destination) ───────
  async function handleGoogleSignIn() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/v1/callback?next=/trip/${tripId}/invite`,
      },
    });
  }

  // ── 4. UI ─────────────────────────────────────────────────────────────────
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4ecd8] dark:bg-[#28211d] p-4">
      <div className="w-full max-w-sm border-4 border-stone-800 bg-[#fdfbf7] shadow-[8px_8px_0_#292524] dark:border-[#54463d] dark:bg-[#362d28] dark:shadow-[8px_8px_0_#1e1815]">

        {/* Header banner */}
        <div className="border-b-4 border-stone-800 dark:border-[#54463d] bg-[#e8dcc4] dark:bg-[#28211d] px-6 py-4 text-center">
          <p className="font-pixel text-[8px] uppercase tracking-widest text-amber-700 dark:text-[#f5ebd5]">
            ❖ Nomadic Journey ❖
          </p>
          <p className="mt-1 font-pixel text-[9px] uppercase tracking-wider text-stone-600 dark:text-stone-400">
            Party Invitation
          </p>
        </div>

        <div className="px-6 py-7 text-center">
          {/* Trip title pill */}
          {tripTitle && (
            <div className="mb-5 inline-block border-2 border-stone-800 dark:border-[#54463d] bg-[#f5eed7] dark:bg-[#1e1815] px-4 py-2 shadow-[3px_3px_0_#292524] dark:shadow-[3px_3px_0_#1e1815]">
              <p className="font-mono text-[9px] uppercase text-stone-500 dark:text-stone-400">You&rsquo;ve been invited to</p>
              <p className="font-pixel text-xs text-stone-800 dark:text-[#fdfbf7] mt-0.5">{tripTitle}</p>
            </div>
          )}

          {/* ── Loading ── */}
          {status === "loading" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="h-8 w-8 border-4 border-stone-800 border-t-transparent dark:border-[#54463d] dark:border-t-transparent animate-spin" />
              <p className="font-pixel text-[9px] uppercase tracking-wider text-stone-500 dark:text-stone-400 animate-pulse">
                Checking credentials...
              </p>
            </div>
          )}

          {/* ── Unauthenticated ── */}
          {status === "unauthenticated" && (
            <div className="flex flex-col items-center gap-5">
              <p className="font-mono text-xs text-stone-600 dark:text-[#f5ebd5]">
                Sign in first to officially join this adventure.
              </p>
              <button
                onClick={handleGoogleSignIn}
                className="group flex w-full items-center justify-center gap-3 border-2 border-stone-800 bg-[#fdfbf7] px-4 py-3 font-pixel text-[10px] uppercase tracking-wider text-stone-800 transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#292524] active:translate-x-0 active:translate-y-0 active:shadow-none dark:border-[#54463d] dark:bg-[#1e1815] dark:text-[#fdfbf7] dark:hover:shadow-[4px_4px_0_#54463d]"
              >
                {/* Google SVG */}
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Sign in with Google
              </button>
            </div>
          )}

          {/* ── Joining ── */}
          {status === "joining" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="h-8 w-8 border-4 border-amber-600 border-t-transparent animate-spin" />
              <p className="font-pixel text-[9px] uppercase tracking-wider text-amber-700 dark:text-amber-400 animate-pulse">
                Joining party...
              </p>
            </div>
          )}

          {/* ── Already member ── */}
          {status === "already_member" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <span className="text-4xl">🗺️</span>
              <p className="font-pixel text-[9px] uppercase tracking-wider text-stone-700 dark:text-[#f5ebd5]">
                Already in the party!
              </p>
              <p className="font-mono text-[10px] text-stone-500">Redirecting to dashboard...</p>
            </div>
          )}

          {/* ── Success ── */}
          {status === "success" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <span className="text-4xl animate-bounce">🎉</span>
              <p className="font-pixel text-[9px] uppercase tracking-wider text-green-700 dark:text-green-400">
                You joined the party!
              </p>
              <p className="font-mono text-[10px] text-stone-500 dark:text-stone-400">Heading to the adventure log...</p>
            </div>
          )}

          {/* ── Error ── */}
          {status === "error" && (
            <div className="flex flex-col items-center gap-4 py-4">
              <span className="text-4xl">⚠️</span>
              <p className="font-pixel text-[9px] uppercase tracking-wider text-red-700 dark:text-red-400">
                Something went wrong
              </p>
              {errorMsg && (
                <p className="font-mono text-[10px] text-stone-500 dark:text-stone-400 break-words max-w-xs">{errorMsg}</p>
              )}
              <button
                onClick={() => user ? joinTrip(user) : handleGoogleSignIn()}
                className="border-2 border-stone-800 dark:border-[#54463d] bg-[#4a7c59] text-white px-4 py-2 font-pixel text-[8px] uppercase shadow-[2px_2px_0_#292524] dark:shadow-[2px_2px_0_#1e1815]"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t-2 border-stone-300 dark:border-[#54463d] px-6 py-3 text-center">
          <p className="font-mono text-[8px] text-stone-400 dark:text-stone-600">
            trip-planner-six-kappa.vercel.app
          </p>
        </div>
      </div>
    </main>
  );
}
