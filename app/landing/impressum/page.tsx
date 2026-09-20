import { redirect } from "next/navigation";

// Superseded by app/impresszum/page.tsx, which reads its content live
// from legal_documents (Beállítások → Jogi dokumentumok) instead of the
// hardcoded German placeholder text this file used to carry — kept as a
// redirect so any old /landing/impressum link (bookmarked, printed,
// linked from elsewhere) still resolves.
export default function LandingImpressumRedirect() {
  redirect("/impresszum");
}
