export const A4_WIDTH_IN = 8.27;
export const A4_HEIGHT_IN = 11.69;

/**
 * Otthoni/irodai nyomtatáshoz a kártyát a végleges (cut) méretben kell
 * A4 lapra rácsba rendezni — nem a bleed méretben, mert otthoni
 * nyomtatónál/ollóval vágva nincs értelme a szakmai ráhagyásnak (lásd
 * lib/card-render.ts renderCutCardCanvas). Minden rács-cella a kártya
 * mérete + egy körbefutó "vágásjel-zóna", amiben a sarkokban a négy
 * vágásjel (lásd PrintPanel CropMarks) elfér, és marad hely az olló
 * számára is.
 */
export interface PrintGrid {
  cols: number;
  rows: number;
  cardsPerPage: number;
  cellWidthIn: number;
  cellHeightIn: number;
  marginIn: number;
}

const MARGIN_IN = 0.4;
const MARK_ZONE_IN = 0.24;

export function computePrintGrid(cutWidthIn: number, cutHeightIn: number): PrintGrid {
  const cellWidthIn = cutWidthIn + 2 * MARK_ZONE_IN;
  const cellHeightIn = cutHeightIn + 2 * MARK_ZONE_IN;
  const usableWidthIn = A4_WIDTH_IN - 2 * MARGIN_IN;
  const usableHeightIn = A4_HEIGHT_IN - 2 * MARGIN_IN;
  const cols = Math.max(1, Math.floor(usableWidthIn / cellWidthIn));
  const rows = Math.max(1, Math.floor(usableHeightIn / cellHeightIn));
  return { cols, rows, cardsPerPage: cols * rows, cellWidthIn, cellHeightIn, marginIn: MARGIN_IN };
}

export function paginate<T>(items: T[], perPage: number): T[][] {
  if (perPage <= 0) return [items];
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
  return pages;
}
