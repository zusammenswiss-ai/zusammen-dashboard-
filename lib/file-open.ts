// Shared "how should clicking this uploaded file behave" logic — used
// everywhere a document/bundle (not a photo, see Lightbox for those) can
// be opened: Dokumentumok, Kártya-fájlok. A PDF opens straight into the
// browser's own viewer in a new tab (no `download` attribute anywhere in
// this app forces a save), so that already reads as an in-app preview.
// Anything else (docx, zip, csv, odt…) can't be previewed by the browser
// itself, so the label says so up front instead of implying a preview
// that won't happen.
export function isPreviewableInBrowser(nameOrUrl: string | null | undefined): boolean {
  if (!nameOrUrl) return false;
  return /\.pdf(?:[?#].*)?$/i.test(nameOrUrl);
}

export function openFileLabel(nameOrUrl: string | null | undefined): string {
  return isPreviewableInBrowser(nameOrUrl) ? "Megnyitás" : "Megnyitás (letöltés szükséges)";
}

// A generic file upload (Dokumentumok) can itself be a photo — those get
// the same Lightbox treatment as every other uploaded image in the app,
// rather than the PDF/"letöltés szükséges" open-in-new-tab flow below.
export function isImageFile(nameOrUrl: string | null | undefined): boolean {
  if (!nameOrUrl) return false;
  return /\.(png|jpe?g|gif|webp|svg|avif)(?:[?#].*)?$/i.test(nameOrUrl);
}
