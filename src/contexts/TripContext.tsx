"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { Trip, Participant } from "@/types/trip";
import { createClient } from "@/utils/supabase/client";

interface TripContextType {
  trips: Trip[];
  isLoaded: boolean;
  addTrip: (trip: Omit<Trip, "id">) => Promise<string | null>;
  updateTrip: (id: string, partialTrip: Partial<Trip>) => void;
  deleteTrip: (id: string) => void;
  getTrip: (id: string) => Trip | undefined;
  addTripMember: (tripId: string, participant: Participant) => Promise<void>;
  removeTripMember: (tripId: string, participantId: string) => Promise<void>;
  refreshTrips: () => void;
}

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

const TripContext = createContext<TripContextType | undefined>(undefined);

function tripToDbRow(trip: Omit<Trip, "id">, createdBy: string) {
  return {
    title:             trip.title,
    destination:       trip.destination,
    start_date:        trip.startDate    || null,
    end_date:          trip.endDate      || null,
    total_days:        trip.days?.length ?? 0,
    status:            trip.status,
    travel_type:       trip.travelType   ?? "solo",
    base_currency:     trip.baseCurrency ?? "THB",
    created_by:        createdBy,
    days:              trip.days             ?? [],
    expenses:          trip.expenses         ?? [],
    custom_categories: trip.customCategories ?? [],
  };
}

function dbRowToTrip(row: any, participants: any[] = []): Trip {
  return {
    id:               row.id,
    title:            row.title,
    destination:      row.destination,
    startDate:        row.start_date      ?? "",
    endDate:          row.end_date        ?? "",
    status:           row.status,
    travelType:       row.travel_type     ?? "solo",
    baseCurrency:     row.base_currency   ?? "THB",
    participants:     participants,
    days:             row.days            ?? [],
    expenses:         row.expenses        ?? [],
    customCategories: row.custom_categories ?? [],
  };
}

export function TripProvider({ children }: { children: React.ReactNode }) {
  const [trips, setTrips]       = useState<Trip[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [userId, setUserId]     = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refreshTrips = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const supabase = useMemo(() => createClient(), []);

  // ── Initial load & auth listener ──────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    async function load(uid: string) {
      if (!mounted) return;
      setUserId(uid);

      // ── Step 1: get all trip_ids this user is a member of ─────────────────
      const { data: memberRows } = await supabase
        .from("trip_members")
        .select("trip_id")
        .eq("user_id", uid);

      const joinedTripIds: string[] = memberRows ? memberRows.map((r: any) => r.trip_id) : [];

      const SELECT_COLS = `id, title, destination, start_date, end_date, total_days, status, travel_type, base_currency, created_by, days, expenses, custom_categories`;

      // ── Step 2a: trips the user created (passes RLS creator filter) ────────
      const { data: createdTrips } = await supabase
        .from("trips")
        .select(SELECT_COLS)
        .eq("created_by", uid)
        .order("start_date", { ascending: false });

      // ── Step 2b: trips the user joined via invite link (fetch by ID list) ──
      // Fetching by explicit ID bypasses the "created_by" RLS ownership check.
      let joinedTrips: any[] = [];
      if (joinedTripIds.length > 0) {
        const { data: joinedData } = await supabase
          .from("trips")
          .select(SELECT_COLS)
          .in("id", joinedTripIds)
          .order("start_date", { ascending: false });
        if (joinedData) joinedTrips = joinedData;
      }

      // ── Step 3: merge & deduplicate by id ─────────────────────────────────
      const allRows = [...(createdTrips || []), ...joinedTrips];
      const seen = new Set<string>();
      const fetchedTrips = allRows.filter((t) => {
        if (seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      });

      if (!mounted) return;

      if (fetchedTrips.length === 0) {
        setTrips([]);
        setIsLoaded(true);
        return;
      }

      const fetchedTripIds = fetchedTrips.map(t => t.id);
      const { data: allMembers } = await supabase
        .from("trip_members")
        .select("id, trip_id, user_id, role, temporary_name")
        .in("trip_id", fetchedTripIds);

      const uniqueUserIds = [...new Set((allMembers || []).filter(m => m.user_id).map(m => m.user_id))];
      let profilesData: any[] = [];
      if (uniqueUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nickname, avatar_url")
          .in("id", uniqueUserIds);
        if (profiles) profilesData = profiles;
      }

      const hydratedTrips = fetchedTrips.map((tripRow) => {
        const members = (allMembers || []).filter(m => m.trip_id === tripRow.id);
        const mappedParticipants = members.map(m => {
          if (!m.user_id) {
            return {
              id: m.id,
              name: m.temporary_name || "Unknown Traveler",
              color: getAvatarColor(m.temporary_name || "Unknown"),
              avatarUrl: undefined
            };
          }
          
          const profile = profilesData.find(p => p.id === m.user_id);
          const avUrl = profile?.avatar_url && profile.avatar_url.trim() !== "" ? profile.avatar_url : undefined;
          return {
            id: m.user_id,
            name: profile?.nickname || "Unknown Explorer",
            color: getAvatarColor(m.user_id),
            avatarUrl: avUrl
          };
        });

        return dbRowToTrip(tripRow, mappedParticipants);
      });

      setTrips(hydratedTrips);
      setIsLoaded(true);
    }

    let currentSessionId: string | null = null;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user.id) {
        currentSessionId = session.user.id;
        load(session.user.id);
      } else {
        setIsLoaded(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (!session) {
        currentSessionId = null;
        setUserId(null);
        setTrips([]);
        setIsLoaded(true);
      } else if (session.user.id !== currentSessionId) {
        currentSessionId = session.user.id;
        load(session.user.id);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, refreshTrigger]);

  // ── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const tripsChannel = supabase
      .channel("trips-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, async (payload) => {
        if (payload.eventType === "INSERT") {
          const { data } = await supabase
            .from("trips")
            .select(`
              id, title, destination, start_date, end_date, total_days, status, travel_type, base_currency, created_by, days, expenses, custom_categories
            `)
            .eq("id", payload.new.id)
            .single();
          if (data) {
            setTrips((prev) => prev.some((x) => x.id === data.id) ? prev : [...prev, dbRowToTrip(data, [])]);
          }
        } else if (payload.eventType === "UPDATE") {
          setTrips((prev) => prev.map((x) => {
            if (x.id === payload.new.id) {
              return dbRowToTrip(payload.new, x.participants);
            }
            return x;
          }));
        } else if (payload.eventType === "DELETE") {
          setTrips((prev) => prev.filter((x) => x.id !== payload.old.id));
        }
      })
      .subscribe();

    const membersChannel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_members' }, (payload) => {
        console.log("[Realtime Sync] Database change captured across tabs:", payload);
        // Explicitly trigger a live context re-fetch query right here to update global arrays
        refreshTrips();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(tripsChannel);
      supabase.removeChannel(membersChannel);
    };
  }, [userId, supabase]);

  // ── CRUD operations ────────────────────────────────────────────────────────

  const addTrip = useCallback(async (trip: Omit<Trip, "id">): Promise<string | null> => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error("[addTrip] User not authenticated.", authError?.message);
        return null;
      }

      const dbRow = tripToDbRow(trip, user.id);

      const { data: insertedTrip, error: insertError } = await supabase
        .from("trips")
        .insert([dbRow])
        .select("id")
        .single();

      if (insertError || !insertedTrip) {
        console.error(
          "[addTrip] Supabase trips insert failed:",
          insertError?.message,
          "Details:", insertError?.details
        );
        return null;
      }

      const realId = insertedTrip.id;

      const memberInserts: any[] = [];
      (trip.participants || []).forEach((p) => {
        if (p.name === "Me" || p.id === user.id) {
          memberInserts.push({
            trip_id: realId,
            user_id: user.id,
            role: "Leader"
          });
        } else {
          memberInserts.push({
            trip_id: realId,
            user_id: null,
            temporary_name: p.name,
            role: "Member"
          });
        }
      });

      let finalParticipants = [...(trip.participants || [])];

      if (memberInserts.length > 0) {
        const { data: insertedMembers, error: memberError } = await supabase
          .from("trip_members")
          .insert(memberInserts)
          .select();

        if (memberError) {
          console.error(
            "[addTrip] Supabase trip_members insert failed for valid users:",
            memberError.message,
            "Details:", memberError.details
          );
        } else if (insertedMembers) {
          finalParticipants = (trip.participants || []).map((p) => {
            if (p.name === "Me" || p.id === user.id) {
              return { ...p, id: user.id };
            } else {
              const match = insertedMembers.find((m: any) => m.temporary_name === p.name);
              return { ...p, id: match ? match.id : p.id };
            }
          });
        }
      }

      const newTrip: Trip = { ...trip, id: realId, participants: finalParticipants };
      setTrips((prev) => [...prev, newTrip]);

      return realId;
    } catch (err) {
      console.error("[addTrip] Unexpected exception during trip creation:", err);
      return null;
    }
  }, [supabase]);

  const updateTrip = useCallback(async (id: string, partialTrip: Partial<Trip>) => {
    setTrips((prev) =>
      prev.map((trip) => (trip.id === id ? { ...trip, ...partialTrip } : trip))
    );
    if (!userId) return;

    const dbPatch: Record<string, any> = { ...partialTrip };
    if ("startDate"        in dbPatch) { dbPatch.start_date        = dbPatch.startDate;        delete dbPatch.startDate;        }
    if ("endDate"          in dbPatch) { dbPatch.end_date           = dbPatch.endDate;          delete dbPatch.endDate;          }
    if ("travelType"       in dbPatch) { dbPatch.travel_type        = dbPatch.travelType;       delete dbPatch.travelType;       }
    if ("baseCurrency"     in dbPatch) { dbPatch.base_currency      = dbPatch.baseCurrency;     delete dbPatch.baseCurrency;     }
    if ("customCategories" in dbPatch) { dbPatch.custom_categories  = dbPatch.customCategories; delete dbPatch.customCategories; }
    if ("days"             in dbPatch) { dbPatch.total_days = (dbPatch.days as any[]).length;   }
    
    delete dbPatch.participants;
    delete dbPatch.id;

    const { error } = await supabase.from("trips").update(dbPatch).eq("id", id);
    if (error) {
      console.error("[updateTrip] Failed:", error.message, error.details);
    }
  }, [userId, supabase]);

  const deleteTrip = useCallback(async (id: string) => {
    if (!userId) return;

    setTrips((prev) => prev.filter((trip) => trip.id !== id));

    const { error } = await supabase
      .from("trips")
      .delete()
      .eq("id", id);
      
    if (error) {
      console.error("[Backend Delete Error]:", error);
    }
  }, [userId, supabase]);

  const addTripMember = useCallback(async (tripId: string, participant: Participant) => {
    // 1. INSTANT Optimistic UI Update!
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const optimisticParticipant = { ...participant, id: tempId, color: getAvatarColor(participant.name) };

    setTrips((prev) => prev.map((t) => {
      if (t.id === tripId) {
        return {
          ...t,
          participants: [...t.participants, optimisticParticipant]
        };
      }
      return t;
    }));

    // 2. Execute Backend Insertion
    const { data, error } = await supabase.from('trip_members').insert({
      trip_id: tripId,
      user_id: null,
      temporary_name: participant.name,
      role: 'Member'
    }).select().single();

    if (error) {
      console.error("[addTripMember] Failed to insert member:", error);
      // Rollback on failure
      setTrips((prev) => prev.map((t) => {
        if (t.id === tripId) {
          return {
            ...t,
            participants: t.participants.filter(p => p.id !== tempId)
          };
        }
        return t;
      }));
      return;
    }

    // 3. Smooth ID Swap on Success
    if (data) {
      setTrips((prev) => prev.map((t) => {
        if (t.id === tripId) {
          // If Realtime listener already appended the verified UUID row:
          const alreadyHasReal = t.participants.some((p) => p.id === data.id);
          return {
            ...t,
            participants: alreadyHasReal
              ? t.participants.filter(p => p.id !== tempId) // Remove temp, keep real
              : t.participants.map(p => p.id === tempId ? { ...p, id: data.id } : p) // Swap temp -> real
          };
        }
        return t;
      }));
    }
  }, [supabase]);

  const removeTripMember = useCallback(async (tripId: string, participantId: string) => {
    // Optimistic UI update
    setTrips((prev) => prev.map((t) => {
      if (t.id === tripId) {
        return {
          ...t,
          participants: t.participants.filter((p) => p.id !== participantId)
        };
      }
      return t;
    }));

    const { error } = await supabase
      .from('trip_members')
      .delete()
      .eq('trip_id', tripId)
      .or(`user_id.eq.${participantId},id.eq.${participantId}`);

    if (error) {
      console.error("[removeTripMember] Failed to delete member:", error);
    }
  }, [supabase]);

  const getTrip = useCallback(
    (id: string) => trips.find((t) => t.id === id),
    [trips]
  );

  return (
    <TripContext.Provider value={{ trips, isLoaded, addTrip, updateTrip, deleteTrip, getTrip, addTripMember, removeTripMember, refreshTrips }}>
      {children}
    </TripContext.Provider>
  );
}

export function useTrips() {
  const context = useContext(TripContext);
  if (!context) {
    throw new Error("useTrips must be used within a TripProvider");
  }
  return context;
}
