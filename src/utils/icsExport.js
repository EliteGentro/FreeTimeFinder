/**
 * Generates a valid RFC 5545 iCalendar (.ics) file from an owner's schedule entries.
 * Each entry becomes a VEVENT with a weekly RRULE limited to the entry's date range.
 * Timezone defaults to the user's local IANA timezone.
 */

const getUserTimeZone = () => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) return tz;
  } catch {
    // ignore
  }
  return "UTC";
};

const DAY_TO_ICS = {
  Mon: "MO",
  Tue: "TU",
  Wed: "WE",
  Thu: "TH",
  Fri: "FR",
  Sat: "SA",
  Sun: "SU",
};

const DAY_TO_JS = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 0,
};

/** Parse DD.MM.YYYY into a local Date (midnight). */
const parseDotDate = (ddmmyyyy) => {
  const [d, m, y] = ddmmyyyy.split(".").map(Number);
  return new Date(y, m - 1, d);
};

/** Format a Date as YYYYMMDD. */
const fmtDate = (date) =>
  `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate()
  ).padStart(2, "0")}`;

/** Format a Date + HH:MM time string as YYYYMMDDTHHMMSS. */
const fmtDateTime = (date, hhmm) => {
  const [h, m] = hhmm.split(":");
  return `${fmtDate(date)}T${String(h).padStart(2, "0")}${String(m).padStart(
    2,
    "0"
  )}00`;
};

/**
 * Returns the first date on or after `from` whose weekday matches `jsDay`
 * (0 = Sunday … 6 = Saturday).
 */
const firstOccurrence = (from, jsDay) => {
  const d = new Date(from);
  const diff = (jsDay - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
};

/** Escape per RFC 5545 §3.3.11 (TEXT value). */
const escapeText = (s) =>
  String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");

/**
 * Fold long lines per RFC 5545 §3.1 (max 75 octets, continuation with CRLF + space).
 */
const foldLine = (line) => {
  const MAX = 75;
  if (line.length <= MAX) return line;
  const parts = [];
  let pos = 0;
  while (pos < line.length) {
    parts.push(line.slice(pos, pos + MAX));
    pos += MAX;
  }
  return parts.join("\r\n ");
};

/**
 * Generates raw .ics content for the given owner.
 * @param {{ id: string, name: string, entries: Array }} owner
 * @returns {string}
 */
export const generateICS = (owner) => {
  const tzid = getUserTimeZone();
  const dtstamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ScheduleMatch//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  let idx = 0;

  for (const entry of owner.entries) {
    if (!entry.days || entry.days.length === 0) continue;
    if (!entry.startDate || !entry.endDate) continue;
    if (!entry.startTime || !entry.endTime) continue;

    const day = entry.days[0];
    const jsDay = DAY_TO_JS[day];
    const icsByday = DAY_TO_ICS[day];
    if (jsDay === undefined || !icsByday) continue;

    const startDate = parseDotDate(entry.startDate);
    const endDate = parseDotDate(entry.endDate);
    const firstDate = firstOccurrence(startDate, jsDay);
    if (firstDate > endDate) continue;

    const dtstart = fmtDateTime(firstDate, entry.startTime);
    const dtend = fmtDateTime(firstDate, entry.endTime);
    const until = `${fmtDate(endDate)}T235959Z`;

    const code = entry.name || "";
    const title = entry.title || "";
    const summary = title ? `${code} — ${title}` : code;

    const uid = `${owner.id}-${idx++}-${code.replace(/[^A-Za-z0-9]/g, "")}@schedulematch`;

    const eventLines = [
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;TZID=${tzid}:${dtstart}`,
      `DTEND;TZID=${tzid}:${dtend}`,
      `SUMMARY:${escapeText(summary)}`,
      ...(entry.location ? [`LOCATION:${escapeText(entry.location)}`] : []),
      `RRULE:FREQ=WEEKLY;BYDAY=${icsByday};UNTIL=${until}`,
      "END:VEVENT",
    ];

    for (const l of eventLines) lines.push(foldLine(l));
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
};

/**
 * Triggers a browser download of the owner's schedule as an .ics file.
 */
export const downloadICS = (owner) => {
  const content = generateICS(owner);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${owner.name.replace(/\s+/g, "_")}_schedule.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
