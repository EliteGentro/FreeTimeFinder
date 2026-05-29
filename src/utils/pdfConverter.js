// pdfConverter.js
//
// PDF-format detection + structured extraction of schedule entries from the
// two known schedule PDF flavors (Iris and Mitec).
//
// Both extractors return a flat array of ScheduleEntry objects:
//   {
//     name,        // course code, e.g. "TC2007B"
//     title,       // full subject name, e.g. "Integración de seguridad ..."
//     days,        // [day]  (single day per entry, e.g. ["Mon"])
//     startTime,   // "HH:MM"
//     endTime,     // "HH:MM"
//     startDate,   // "DD.MM.YYYY"
//     endDate,     // "DD.MM.YYYY"
//     type,        // "course" | "week"
//     location,    // human-readable, e.g. "MTY | Aulas III | 306"
//   }
//
// Entries without a valid date range, day list, or schedule time are skipped.

import { dayMap } from "./dateUtils";

const IRIS_DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MITEC_DAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

/* ------------------------------------------------------------------ *
 * Shared helpers                                                      *
 * ------------------------------------------------------------------ */

export const detectScheduleFormat = (text) => {
  if (!text) return "unknown";
  if (
    text.includes("Mi horario") ||
    text.includes("Bloques / Materias del plan de estudios")
  ) {
    return "iris";
  }
  if (text.includes("Unidades de Formación") || text.includes("CRN")) {
    return "mitec";
  }
  return "unknown";
};

export const extractStudentName = (text) => {
  if (!text) return null;
  const withId = text.match(/Alumno:\s*([^\n()]+?)\s*\(([A-Z0-9]+)\)/);
  if (withId) return withId[1].replace(/\s+/g, " ").trim();
  const plain = text.match(/Alumno:\s*([^\n]+?)\s+Matricula:/);
  if (plain) return plain[1].replace(/\s+/g, " ").trim();
  const loose = text.match(
    /Alumno:\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]{3,80})/
  );
  if (loose) return loose[1].replace(/\s+/g, " ").trim();
  return null;
};

const splitLines = (block) =>
  block.split(/\n+/).map((l) => l.trim()).filter(Boolean);

const classifyType = (code) => (code.endsWith("S") ? "week" : "course");

const mapDays = (daysStr) =>
  daysStr
    .split(/\s*,\s*/)
    .map((d) => dayMap[d.trim()] || d.trim())
    .filter(Boolean);

/** Mitec records report times shifted by 10 min; round to the nearest half-hour. */
const roundToHalfHour = (timeStr) => {
  const [h, m] = timeStr.split(":").map(Number);
  let totalMin = h * 60 + m;
  const r = totalMin % 30;
  if (r === 0) {
    // no change
  } else if (r < 15) {
    totalMin -= r;
  } else {
    totalMin += 30 - r;
  }
  const hh = Math.floor(totalMin / 60) % 24;
  const mm = totalMin % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

/* ------------------------------------------------------------------ *
 * Iris extractor                                                      *
 * ------------------------------------------------------------------ */

const IRIS_DAYTIME_RE = new RegExp(
  `^((?:${IRIS_DAYS.join("|")})(?:\\s*,\\s*(?:${IRIS_DAYS.join("|")}))*)\\s+(\\d{2}:\\d{2})\\s*-\\s*(\\d{2}:\\d{2})\\s*$`
);
const IRIS_DATE_RE = /^(\d{2}\.\d{2}\.\d{4})\s*-\s*(\d{2}\.\d{2}\.\d{4})$/;
// e.g. "MTY | Aulas III | 306"   "NAL | Edificio Campus Nacional | CNAL"
const IRIS_LOCATION_RE =
  /^([A-Z]{2,5})\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*$/;

export const extractScheduleEntriesIris = (text) => {
  if (!text) return [];
  const startIdx = text.indexOf("Bloques / Materias del plan de estudios");
  if (startIdx === -1) return [];
  const rawSection = text.slice(startIdx);

  // Split into per-course blocks; first chunk before the first marker is preamble.
  const blocks = rawSection.split(/Unidad de formación:/i).slice(1);

  const out = [];

  for (const rawBlock of blocks) {
    const lines = splitLines(rawBlock);
    if (lines.length === 0) continue;

    // Course code is the first non-empty token in the block (Iris places it
    // on its own line, possibly preceded by colons / whitespace already stripped).
    const code = lines[0].split(/\s+/)[0];
    if (!code) continue;

    // Title is the next line that is neither the code nor metadata.
    let title = "";
    for (let i = 1; i < lines.length; i++) {
      const l = lines[i];
      if (
        IRIS_DAYTIME_RE.test(l) ||
        IRIS_DATE_RE.test(l) ||
        IRIS_LOCATION_RE.test(l) ||
        /^Sub-períodos?\b/i.test(l) ||
        /^CRN\b/i.test(l) ||
        /^Sin horario/i.test(l)
      ) {
        break;
      }
      title = l;
      break;
    }

    // Date range
    let startDate = null;
    let endDate = null;
    for (const l of lines) {
      const m = l.match(IRIS_DATE_RE);
      if (m) {
        startDate = m[1];
        endDate = m[2];
        break;
      }
    }
    if (!startDate || !endDate) continue; // no schedule → skip

    // Day-time lines (may be multiple, e.g. "Lun, Mié 13:00 - 17:00" + "Mar, Jue 15:00 - 17:00")
    const dayTimeLines = lines
      .map((l) => l.match(IRIS_DAYTIME_RE))
      .filter(Boolean);
    if (dayTimeLines.length === 0) continue;

    // Location line (optional)
    let location = "";
    for (const l of lines) {
      const m = l.match(IRIS_LOCATION_RE);
      if (m) {
        location = `${m[1]} | ${m[2].trim()} | ${m[3].trim()}`;
        break;
      }
    }

    const type = classifyType(code);

    for (const m of dayTimeLines) {
      const days = mapDays(m[1]);
      const startTime = m[2];
      const endTime = m[3];
      for (const day of days) {
        out.push({
          name: code,
          title,
          days: [day],
          startTime,
          endTime,
          startDate,
          endDate,
          type,
          location,
        });
      }
    }
  }

  return out;
};

/* ------------------------------------------------------------------ *
 * Mitec extractor                                                     *
 * ------------------------------------------------------------------ */

const MITEC_DATE_LINE_RE = /^(\d{2})-(\d{2})-(\d{4})$/;
const MITEC_CODE_RE = /([A-Z]+\d+[A-Z]*)\.(\d{3})/;
const MITEC_DAY_LINE_RE = new RegExp(
  `^(${MITEC_DAYS.join("|")})(?:-(?:${MITEC_DAYS.join("|")}))*$`
);
const MITEC_TIME_LINE_RE =
  /^(\d{2}:\d{2})\s+a\s+(\d{2}:\d{2})(?:\s+hrs)?\s*$/;
const MITEC_ROOM_RE = /^Salón\s+\S+/;

/**
 * Identifies block boundaries in the line-preserved Mitec text: each block
 * starts at a `DD-MM-YYYY` line followed (after possibly blank lines) by
 * `al`, and runs until the next such triplet or end of section.
 */
const sliceMitecBlocks = (lines) => {
  const starts = [];
  for (let i = 0; i < lines.length - 2; i++) {
    if (
      MITEC_DATE_LINE_RE.test(lines[i]) &&
      /^al$/i.test(lines[i + 1]) &&
      MITEC_DATE_LINE_RE.test(lines[i + 2])
    ) {
      starts.push(i);
    }
  }
  const out = [];
  for (let i = 0; i < starts.length; i++) {
    const s = starts[i];
    const e = i + 1 < starts.length ? starts[i + 1] : lines.length;
    out.push(lines.slice(s, e));
  }
  return out;
};

const dotDate = (ddmmYYYY) => ddmmYYYY.replace(/-/g, ".");

export const extractScheduleEntriesMitec = (text) => {
  if (!text) return [];
  const startIdx = text.indexOf("Unidades de Formación");
  if (startIdx === -1) return [];
  const lines = splitLines(text.slice(startIdx));

  const blocks = sliceMitecBlocks(lines);
  const out = [];

  for (const block of blocks) {
    if (block.some((l) => /No Aplica/i.test(l) || /Sin horario/i.test(l))) {
      continue;
    }

    // Dates (lines 0 and 2 of the block by construction).
    const startDate = dotDate(block[0]);
    const endDate = dotDate(block[2]);

    // Locate course-code line.
    let codeLineIdx = -1;
    let code = null;
    let codeLineTitleHead = "";
    for (let i = 3; i < block.length; i++) {
      const m = block[i].match(MITEC_CODE_RE);
      if (m) {
        codeLineIdx = i;
        code = m[1];
        codeLineTitleHead = block[i]
          .slice(block[i].indexOf(m[0]) + m[0].length)
          .trim();
        break;
      }
    }
    if (!code || codeLineIdx === -1) continue;

    // Title spans from the code line (after the code itself) through any
    // subsequent lines up to the first CRN / Profesor / day line.
    const titleParts = [];
    if (codeLineTitleHead) titleParts.push(codeLineTitleHead);
    for (let i = codeLineIdx + 1; i < block.length; i++) {
      const l = block[i];
      if (
        /^CRN\b/i.test(l) ||
        /^Profesor(a)?\b/i.test(l) ||
        /^Co-Titular/i.test(l) ||
        MITEC_DAY_LINE_RE.test(l)
      ) {
        break;
      }
      titleParts.push(l);
    }
    const title = titleParts.join(" ").replace(/\s+/g, " ").trim();

    // Collect (day-line, time-line) pairs.
    const dayTimePairs = [];
    for (let i = codeLineIdx + 1; i < block.length - 1; i++) {
      if (MITEC_DAY_LINE_RE.test(block[i])) {
        const t = block[i + 1].match(MITEC_TIME_LINE_RE);
        if (t) {
          dayTimePairs.push({
            days: block[i].split("-"),
            startTime: roundToHalfHour(t[1]),
            endTime: roundToHalfHour(t[2]),
          });
        }
      }
    }
    if (dayTimePairs.length === 0) continue;

    // Location: building line (between time and Salón) + Salón line.
    let building = "";
    let room = "";
    for (let i = 0; i < block.length; i++) {
      const l = block[i];
      if (MITEC_ROOM_RE.test(l) && !room) room = l.trim();
    }
    // Building is whichever non-empty line sits between any time line and the room.
    for (let i = 0; i < block.length - 1; i++) {
      if (MITEC_TIME_LINE_RE.test(block[i])) {
        for (let j = i + 1; j < block.length; j++) {
          const l = block[j];
          if (MITEC_ROOM_RE.test(l)) break;
          if (/^CRN\b/i.test(l) || /^Profesor/i.test(l) || /^Co-Titular/i.test(l)) {
            continue;
          }
          if (l && !MITEC_DAY_LINE_RE.test(l) && !MITEC_TIME_LINE_RE.test(l)) {
            building = l.trim();
            break;
          }
        }
        if (building) break;
      }
    }
    const location = [building, room].filter(Boolean).join(" | ");

    const type = classifyType(code);

    for (const dt of dayTimePairs) {
      const days = mapDays(dt.days.join(","));
      for (const day of days) {
        out.push({
          name: code,
          title,
          days: [day],
          startTime: dt.startTime,
          endTime: dt.endTime,
          startDate,
          endDate,
          type,
          location,
        });
      }
    }
  }

  return out;
};
