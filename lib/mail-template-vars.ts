// Postafiók — gyorsválasz-sablonok változó-helyettesítése (feladat 5/B/i
// pont: "változókkal ({{first_name}}, rendelés száma stb.)"). Kliens- ÉS
// szerveroldalon is importálható (nincs adatbázis-hívás), ezért a
// komponens maga adja át a már betöltött kontextust (jelentkező neve,
// szál tárgya stb.), nem ez a modul tölti be.
export type MailTemplateVars = {
  firstName?: string | null;
  orderNumber?: string | null;
  subject?: string | null;
};

export function fillMailTemplate(body: string, vars: MailTemplateVars): string {
  return body
    .replace(/\{\{\s*first_name\s*\}\}/g, vars.firstName || "")
    .replace(/\{\{\s*order_number\s*\}\}/g, vars.orderNumber || "")
    .replace(/\{\{\s*subject\s*\}\}/g, vars.subject || "");
}
