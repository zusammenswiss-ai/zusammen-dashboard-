// Postafiók — megosztott UI-címkék/stílusok a szál-állapothoz és
// prioritáshoz. Ezek (a területekkel ellentétben) rögzített enumok a
// sémában (lásd supabase/schema.sql mail_threads.status/priority check
// constraintjeit), nem adatvezéreltek — a feladat csak a területeket
// kéri explicit "adatként kezelve", a 4 állapotot/3 prioritást nem.
import type { MailThreadStatus, MailThreadPriority } from "@/lib/supabase/types";

export const MAIL_STATUS_LABEL: Record<MailThreadStatus, string> = {
  new: "Új",
  in_progress: "Folyamatban",
  waiting: "Válaszra vár",
  done: "Kész",
};

export const MAIL_STATUS_STYLE: Record<MailThreadStatus, string> = {
  new: "bg-teal/10 text-teal",
  in_progress: "bg-bronze/10 text-bronze",
  waiting: "bg-amber-100 text-amber-800",
  done: "bg-forest/10 text-forest",
};

export const MAIL_PRIORITY_LABEL: Record<MailThreadPriority, string> = {
  low: "Alacsony",
  normal: "Normál",
  urgent: "Sürgős",
};

export const MAIL_PRIORITY_STYLE: Record<MailThreadPriority, string> = {
  low: "bg-ivory-dim text-walnut",
  normal: "bg-ivory-dim text-walnut",
  urgent: "bg-red-100 text-red-700",
};

export const MAIL_ENTITY_TYPE_LABEL: Record<string, string> = {
  campaign: "Kampány",
  signup: "Jelentkező",
  order: "Rendelés",
  support_ticket: "Ügyfélszolgálati eset",
  supplier: "Beszállító",
  product: "Termék",
  document: "Dokumentum",
};
