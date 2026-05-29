// scheduleHelpers.js
//
// Period / free-time computation utilities.
//
// Data model:
//   ScheduleEntry  = { name, days: [day], startTime, endTime, startDate, endDate, type }
//   Owner          = { id, name, entries: ScheduleEntry[] }
//   Period         = { index, type, start, end, label, startDateFormatted, endDateFormatted }
//   PeriodSlotData = {
//     periodIndex, label, type,
//     freeByDay: { Mon: [ { start, end, freeOwnerIds: string[] }, ... ], ... }
//   }
//
// All free-time slots are produced on a fixed 30-minute grid (07:00–21:00).

import { parseDate, formatDateDot, toDateStart, toDateEnd, timeToMinutes } from "./dateUtils";

export const WORK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
export const DAY_START_MIN = timeToMinutes("07:00");
export const DAY_END_MIN = timeToMinutes("21:00");
export const SLOT_MIN = 30;

export const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Groups week-typed schedules into clusters of overlapping date ranges.
 * Handles the case where two PDF formats encode the same logical "semana tec"
 * with slightly different start/end dates (e.g. Mon–Fri vs Mon–Sun).
 */
const clusterWeeks = (weekSchedules) => {
  const items = weekSchedules
    .map((s) => ({ start: parseDate(s.startDate), end: parseDate(s.endDate) }))
    .filter((x) => x.start && x.end)
    .sort((a, b) => a.start - b.start);

  const clusters = [];
  for (const it of items) {
    const c = clusters.find(
      (cluster) => it.start <= cluster.end && it.end >= cluster.start
    );
    if (c) {
      c.start = new Date(Math.min(c.start.getTime(), it.start.getTime()));
      c.end = new Date(Math.max(c.end.getTime(), it.end.getTime()));
      c.count += 1;
    } else {
      clusters.push({ start: it.start, end: it.end, count: 1 });
    }
  }
  return clusters.sort((a, b) => a.start - b.start);
};

/**
 * Builds the canonical sequence of academic periods.
 * Supports 0, 1, or 2 week clusters and produces a coherent course/week
 * alternation around them. When more than 2 week clusters appear, only the
 * two most-populated are kept.
 */
export const createPeriods = (allSchedules) => {
  if (!allSchedules || allSchedules.length === 0) return [];

  const validSchedules = allSchedules.filter(
    (s) => parseDate(s.startDate) && parseDate(s.endDate)
  );
  if (validSchedules.length === 0) return [];

  const weekSchedules = validSchedules.filter((s) => s.type === "week");

  const allStartDates = validSchedules.map((s) => parseDate(s.startDate));
  const allEndDates = validSchedules.map((s) => parseDate(s.endDate));
  const semesterStart = new Date(Math.min(...allStartDates.map((d) => d.getTime())));
  const semesterEnd = new Date(Math.max(...allEndDates.map((d) => d.getTime())));

  let clusters = clusterWeeks(weekSchedules);

  // Keep at most 2 week clusters; prefer those with the highest count
  // (i.e. seen across more uploaded schedules), tie-broken by start date.
  if (clusters.length > 2) {
    clusters = [...clusters]
      .sort((a, b) => b.count - a.count || a.start - b.start)
      .slice(0, 2)
      .sort((a, b) => a.start - b.start);
  }

  const periods = [];
  let pIdx = 1;
  let cursor = semesterStart;

  const pushCourse = (start, end) => {
    if (start > end) return;
    periods.push({ index: pIdx++, type: "course", start, end });
  };
  const pushWeek = (start, end) => {
    periods.push({ index: pIdx++, type: "week", start, end });
  };

  for (const wk of clusters) {
    pushCourse(cursor, addDays(wk.start, -1));
    pushWeek(wk.start, wk.end);
    cursor = addDays(wk.end, 1);
  }
  pushCourse(cursor, semesterEnd);

  // Assign human-friendly labels.
  let courseN = 0;
  let weekN = 0;
  return periods.map((p) => {
    if (p.type === "course") {
      courseN += 1;
      return {
        ...p,
        label: `Course Period ${courseN}`,
        startDateFormatted: formatDateDot(p.start),
        endDateFormatted: formatDateDot(p.end),
      };
    }
    weekN += 1;
    return {
      ...p,
      label: `Week Period ${weekN}`,
      startDateFormatted: formatDateDot(p.start),
      endDateFormatted: formatDateDot(p.end),
    };
  });
};

const overlapsPeriod = (entry, period) => {
  const sStart = toDateStart(entry.startDate).getTime();
  const sEnd = toDateEnd(entry.endDate).getTime();
  const pStart = period.start.getTime();
  const pEnd = period.end.getTime();
  if (period.type !== entry.type) return false;
  return (
    (sStart >= pStart && sStart <= pEnd) ||
    (sEnd >= pStart && sEnd <= pEnd) ||
    (sStart <= pStart && sEnd >= pEnd)
  );
};

/** Merges overlapping [start, end] intervals (values in minutes). */
export const mergeIntervals = (intervals) => {
  if (!intervals.length) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const out = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = out[out.length - 1];
    const it = sorted[i];
    if (it.start <= cur.end) cur.end = Math.max(cur.end, it.end);
    else out.push({ ...it });
  }
  return out;
};

/**
 * Returns, for the given owner and period, a map { day: [{start,end} busy] }
 * with merged busy intervals (in minutes-of-day) clipped to the work-day.
 */
const ownerBusyByDay = (owner, period) => {
  const result = {};
  for (const day of WORK_DAYS) result[day] = [];

  for (const entry of owner.entries) {
    if (!overlapsPeriod(entry, period)) continue;
    if (!entry.days || !entry.startTime || !entry.endTime) continue;
    const s = timeToMinutes(entry.startTime);
    const e = timeToMinutes(entry.endTime);
    if (Number.isNaN(s) || Number.isNaN(e) || e <= s) continue;
    const start = Math.max(s, DAY_START_MIN);
    const end = Math.min(e, DAY_END_MIN);
    if (start >= end) continue;
    for (const day of entry.days) {
      if (result[day]) result[day].push({ start, end });
    }
  }

  for (const day of WORK_DAYS) {
    result[day] = mergeIntervals(result[day]);
  }
  return result;
};

const isFreeAt = (busyIntervals, slotStart, slotEnd) => {
  for (const b of busyIntervals) {
    if (slotStart < b.end && slotEnd > b.start) return false;
  }
  return true;
};

/**
 * For each period, produces a 30-minute grid of slot data:
 *   { freeByDay: { day: [{ start, end, freeOwnerIds }, ...] } }
 *
 * `owners` is the list of all schedule owners (main + friends). Each slot
 * records which owners are free, enabling both shared-mode and heat-map
 * rendering on top of the same precomputed structure.
 */
export const computePeriodSlotData = (periods, owners) => {
  if (!Array.isArray(periods) || periods.length === 0) return [];
  if (!Array.isArray(owners) || owners.length === 0) return [];

  return periods.map((period) => {
    const ownerBusy = owners.map((o) => ({
      id: o.id,
      busy: ownerBusyByDay(o, period),
    }));

    const freeByDay = {};
    for (const day of WORK_DAYS) {
      const slots = [];
      for (let t = DAY_START_MIN; t < DAY_END_MIN; t += SLOT_MIN) {
        const slotEnd = t + SLOT_MIN;
        const freeOwnerIds = [];
        for (const ob of ownerBusy) {
          if (isFreeAt(ob.busy[day] || [], t, slotEnd)) {
            freeOwnerIds.push(ob.id);
          }
        }
        slots.push({ start: t, end: slotEnd, freeOwnerIds });
      }
      freeByDay[day] = slots;
    }

    return {
      periodIndex: period.index,
      label: period.label,
      type: period.type,
      freeByDay,
    };
  });
};

/**
 * From a slot grid, derives shared free-time ranges per day (slots where
 * every owner in `selectedOwnerIds` is free), merging consecutive 30-minute
 * slots into contiguous ranges.
 */
export const sharedFreeRangesPerDay = (periodSlot, selectedOwnerIds) => {
  const out = {};
  const sel = selectedOwnerIds || [];
  for (const day of WORK_DAYS) {
    const slots = periodSlot.freeByDay[day] || [];
    const ranges = [];
    let current = null;
    for (const slot of slots) {
      const allFree =
        sel.length > 0 && sel.every((id) => slot.freeOwnerIds.includes(id));
      if (allFree) {
        if (current) current.end = slot.end;
        else current = { start: slot.start, end: slot.end };
      } else if (current) {
        ranges.push(current);
        current = null;
      }
    }
    if (current) ranges.push(current);
    out[day] = ranges;
  }
  return out;
};
