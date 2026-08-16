"use client";

import { isSupabaseConfigured } from "@/lib/supabase/client";
import { AlertTriangle } from "lucide-react";

export default function ConfigBanner() {
  if (isSupabaseConfigured) return null;

  return (
    <div className="flex items-start gap-3 border-b border-bronze/30 bg-bronze/10 px-4 py-3 text-sm text-walnut sm:px-8 lg:px-10">
      <AlertTriangle size={18} className="mt-0.5 shrink-0" />
      <p>
        <strong className="font-semibold">A Supabase még nincs csatlakoztatva.</strong>{" "}
        Add hozzá a <code className="rounded bg-white/60 px-1 py-0.5 font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
        és a <code className="rounded bg-white/60 px-1 py-0.5 font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
        környezeti változókat (lásd a README-t), majd tölts be újra. Addig az adatok nem töltődnek be és nem menthetők.
      </p>
    </div>
  );
}
