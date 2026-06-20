"use client";

import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import LoginScreen from "./LoginScreen";

import Sidebar from "./Sidebar";

export default function ClientAuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // Check active session immediately
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };

    checkSession();

    // Listen for state changes (e.g., login, logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4ecd8] dark:bg-[#28211d]">
        <p className="font-pixel text-amber-700 dark:text-[#f5ebd5] text-xs animate-blink">Connecting...</p>
      </main>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="flex min-h-screen w-full bg-[#f4ecd8] dark:bg-[#28211d]">
      <Sidebar user={user} />
      <div className="flex-1 w-full overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
