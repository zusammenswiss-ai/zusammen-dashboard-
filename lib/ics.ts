// Minimal RFC 5545 (iCalendar) writer for the Naptár .ics feed — no
// library, just plain text assembly; the format is small enough that a
// dependency would be more overhead than it saves.
import { SITE_URL } from "@/lib/site-url";
import type { CalendarEventItem } from "@/lib/calendar-events";

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

// RFC 5545 §3.1: lines SHOULD be folded at 75 octets, continuation lines
// start with a single space. Most calendar apps tolerate long lines
// anyway, but folding keeps this correct for the strict ones.
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const CHUNK = 74; // + 1 leading space on each continuation = 75
  let out = line.slice(0, 75);
  let rest = line.slice(75);
  while (rest.length > 0) {
    out += "\r\n " + rest.slice(0, CHUNK);
    rest = rest.slice(CHUNK);
  }
  return out;
}

function dateStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/** `date` is a plain YYYY-MM-DD string — offsetting it as a calendar date, never through a Date's own timezone-sensitive math. */
function addDaysToISODate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const next = new Date(y, m - 1, d + days);
  return `${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, "0")}${String(next.getDate()).padStart(2, "0")}`;
}

export function buildICS(calendarName: string, events: CalendarEventItem[]): string {
  const stamp = dateStamp(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Zusammen Dashboard//Naptár//HU",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ];

  for (const ev of events) {
    const dtstart = ev.date.replace(/-/g, "");
    const dtend = addDaysToISODate(ev.date, 1); // all-day VEVENT: DTEND is exclusive, so +1 day
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${ev.id}@zusammen-dashboard`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;VALUE=DATE:${dtstart}`);
    lines.push(`DTEND;VALUE=DATE:${dtend}`);
    lines.push(`SUMMARY:${escapeText(ev.title)}`);
    if (ev.href) lines.push(`URL:${SITE_URL}${ev.href}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
