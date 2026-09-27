"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/supabase/types";

/**
 * A bejelentkezett felhasználó szerepe (Founder/Viewer) — jelenleg csak
 * a Jegyzőkönyvek modul szerkesztési/törlési jogát vezérli (lásd
 * supabase/schema.sql user_roles/protocols kommentjeit). Nincs sor a
 * user_roles táblában (pl. egy jövőbeli, még nem besorolt új
 * felhasználónak) → alapértelmezetten "Viewer"-ként kezeljük, a
 * biztonságos, csak-olvasható alapállapot.
 */
export function useUserRole(): { role: UserRole; isFounder: boolean; loading: boolean } {
  const supabase = getSupabaseClient();
  const [role, setRole] = useState<UserRole>("Viewer");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    supabase.auth.getUser().then(async ({ data: userData }) => {
      const userId = userData.user?.id;
      if (!userId) {
        setLoading(false);
        return;
      }
      const { data } = await supabase.from("user_roles").select("role").eq("id", userId).maybeSingle();
      setRole(data?.role ?? "Viewer");
      setLoading(false);
    });
  }, [supabase]);

  return { role, isFounder: role === "Founder", loading };
}
