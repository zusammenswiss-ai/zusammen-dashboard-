export function formatCHF(value: number): string {
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

const TIME_UNITS: [number, string][] = [
  [60, "second"],
  [60, "minute"],
  [24, "hour"],
  [7, "day"],
  [4.345, "week"],
  [12, "month"],
  [Number.POSITIVE_INFINITY, "year"],
];

export function timeAgo(value: string): string {
  const date = new Date(value);
  let amount = Math.floor((Date.now() - date.getTime()) / 1000);
  if (amount < 5) return "just now";

  let unit = "second";
  for (const [range, label] of TIME_UNITS) {
    unit = label;
    if (amount < range) break;
    amount = Math.floor(amount / range);
  }
  return `${amount} ${unit}${amount === 1 ? "" : "s"} ago`;
}
