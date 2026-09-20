import { redirect } from "next/navigation";

// Superseded by app/adatvedelem/page.tsx — see the sibling
// app/landing/impressum/page.tsx redirect for the full reasoning.
export default function LandingDatenschutzRedirect() {
  redirect("/adatvedelem");
}
