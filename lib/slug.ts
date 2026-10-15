// Egyszerű, ékezet-eltávolításos slug-generálás — ugyanaz a logika, mint
// a supabase/schema.sql-beli egyszeri induló slug-backfillnél, csak itt
// TypeScriptben, hogy új kampány létrehozásakor a kliens már egy kész
// sluggal küldje be a sort (nem kell külön DB-trigger).
const ACCENT_MAP: Record<string, string> = {
  á: "a", é: "e", í: "i", ó: "o", ö: "o", ő: "o", ú: "u", ü: "u", ű: "u",
  Á: "a", É: "e", Í: "i", Ó: "o", Ö: "o", Ő: "o", Ú: "u", Ü: "u", Ű: "u",
};

export function slugify(input: string): string {
  const deaccented = input.replace(/[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/g, (ch) => ACCENT_MAP[ch] ?? ch);
  return deaccented
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
