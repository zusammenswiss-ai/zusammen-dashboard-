// A jelentkező listasorának/részletnézetének "tényleges levélállapota" —
// a korábbi statikus "email elküldve" / "nincs visszaigazolás" szöveg
// helyett (lásd components/First20SignupsSection.tsx régi verzióját).
//
// first20_signups.status (DB-mező) a "nagy" állapotokat tárolja
// (Visszajelzett/Megrendelte/Várólista/Számlázva/Kifizetve) — ezeket nem
// kell/nem szabad kitalálni. A két köztes, csak a cronból/kézi küldésből
// adódó mikro-állapotot (Emlékeztető küldve, Visszajelzés kérve) viszont
// NEM státuszértékként tároljuk (nem bővítettük a check constraint-et),
// hanem a már meglévő *_sent_at időbélyegekből vezetjük le — ez a
// függvény a "forrás az igazságra" mindkettőhöz.
import type { First20Signup, First20EmailType } from "@/lib/supabase/types";

export type First20DisplayStatus =
  | "Jelentkezett"
  | "Kit elküldve"
  | "Emlékeztető küldve"
  | "Visszajelzés kérve"
  | "Visszajelzett"
  | "Megrendelte"
  | "Várólista"
  | "Számlázva"
  | "Kifizetve";

export function deriveFirst20DisplayStatus(signup: First20Signup): First20DisplayStatus {
  if (signup.status === "Kifizetve") return "Kifizetve";
  if (signup.status === "Számlázva") return "Számlázva";
  if (signup.status === "Várólista") return "Várólista";
  if (signup.status === "Megrendelte") return "Megrendelte";
  if (signup.status === "Visszajelzett") return "Visszajelzett";
  if (signup.feedback_mail_sent_at) return "Visszajelzés kérve";
  if (signup.reminder_sent_at) return "Emlékeztető küldve";
  if (signup.kit_sent_at || signup.status === "Kit elküldve") return "Kit elküldve";
  return "Jelentkezett";
}

export const FIRST20_DISPLAY_STATUS_STYLES: Record<First20DisplayStatus, string> = {
  Jelentkezett: "bg-ivory-dim text-walnut",
  "Kit elküldve": "bg-bronze/15 text-walnut",
  "Emlékeztető küldve": "bg-bronze/15 text-walnut",
  "Visszajelzés kérve": "bg-forest-light/15 text-forest",
  Visszajelzett: "bg-forest/10 text-forest",
  Megrendelte: "bg-forest/15 text-forest",
  Várólista: "bg-amber-100 text-amber-800",
  Számlázva: "bg-teal/10 text-teal",
  Kifizetve: "bg-forest text-white",
};

export const FIRST20_EMAIL_TYPE_LABEL: Record<First20EmailType, string> = {
  kit: "Készlet",
  reminder: "Emlékeztető",
  feedback: "Visszajelzés kérése",
  order_confirmation: "Rendelés visszaigazolása",
  custom: "Saját levél",
};

/** 24 órás dupla-küldés elleni védelem — lásd lib/first20-send.ts. */
export const FIRST20_RESEND_COOLDOWN_MS = 24 * 60 * 60 * 1000;
