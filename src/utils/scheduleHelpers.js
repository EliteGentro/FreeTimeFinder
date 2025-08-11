// periodUtils.js

import { parseDate, formatDateDot, toDateStart, toDateEnd, timeToMinutes } from "./dateUtils";

// Helper to add days to a Date object
export const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Creates exactly 5 periods:
 * Course Period 1: semester start → day before Week 1 start
 * Week Period 1: Week 1 start → Week 1 end
 * Course Period 2: day after Week 1 end → day before Week 2 start
 * Week Period 2: Week 2 start → Week 2 end
 * Course Period 3: day after Week 2 end → semester end
 *
 * Assumes exactly two unique week periods exist.
 */
export const createPeriods = (allSchedules) => {
  if (!allSchedules || allSchedules.length === 0) return [];

  const validSchedules = allSchedules.filter(
    (s) => parseDate(s.startDate) && parseDate(s.endDate)
  );
  if (validSchedules.length === 0) return [];

  const courseSchedules = validSchedules.filter((s) => s.type === "course");
  const weekSchedules = validSchedules.filter((s) => s.type === "week");

  // Semester boundaries (overall min start and max end date)
  const allStartDates = validSchedules.map((s) => parseDate(s.startDate));
  const allEndDates = validSchedules.map((s) => parseDate(s.endDate));
  const semesterStart = new Date(Math.min(...allStartDates.map((d) => d.getTime())));
  const semesterEnd = new Date(Math.max(...allEndDates.map((d) => d.getTime())));

  // Unique week periods by startDate|endDate
  const uniqueWeekMap = new Map();
  for (const s of weekSchedules) {
    const key = `${s.startDate}|${s.endDate}`;
    if (!uniqueWeekMap.has(key)) uniqueWeekMap.set(key, s);
  }
  const uniqueWeeks = Array.from(uniqueWeekMap.values()).sort(
    (a, b) => parseDate(a.startDate) - parseDate(b.startDate)
  );

if (uniqueWeeks.length !== 2) {
  return [];
}

  const week1Start = parseDate(uniqueWeeks[0].startDate);
  const week1End = parseDate(uniqueWeeks[0].endDate);
  const week2Start = parseDate(uniqueWeeks[1].startDate);
  const week2End = parseDate(uniqueWeeks[1].endDate);

  // Calculate course period boundaries with day adjustments
  const course1End = addDays(week1Start, -1);
  const course2Start = addDays(week1End, 1);
  const course2End = addDays(week2Start, -1);
  const course3Start = addDays(week2End, 1);

  const periods = [
    {
      index: 1,
      type: "course",
      start: semesterStart,
      end: course1End >= semesterStart ? course1End : semesterStart,
      label: "Course Period 1",
    },
    {
      index: 2,
      type: "week",
      start: week1Start,
      end: week1End,
      label: "Week Period 1",
    },
    {
      index: 3,
      type: "course",
      start: course2Start <= course2End ? course2Start : course2End,
      end: course2End >= course2Start ? course2End : course2Start,
      label: "Course Period 2",
    },
    {
      index: 4,
      type: "week",
      start: week2Start,
      end: week2End,
      label: "Week Period 2",
    },
    {
      index: 5,
      type: "course",
      start: course3Start <= semesterEnd ? course3Start : semesterEnd,
      end: semesterEnd,
      label: "Course Period 3",
    },
  ];

  return periods.map((p) => ({
    ...p,
    startDateFormatted: formatDateDot(p.start),
    endDateFormatted: formatDateDot(p.end),
  }));
};

/**
 * Assigns schedules to the given periods by checking if the schedule's date range overlaps
 * the period date range.
 * Courses only go to course periods; weeks only to week periods.
 * Includes schedules that fully or partially overlap.
 */
export const assignSchedulesToPeriods = (periods, schedules) => {
  if (!periods || periods.length === 0) return [];

  return periods.map((p) => {
    const entries = (schedules || []).filter((s) => {
      const sStart = toDateStart(s.startDate).getTime();
      const sEnd = toDateEnd(s.endDate).getTime();
      const pStart = p.start.getTime();
      const pEnd = p.end.getTime();

      if (p.type === "course") {
        if (s.type !== "course") return false;
      } else if (p.type === "week") {
        if (s.type !== "week") return false;
      } else {
        return false;
      }

      // Overlapping intervals:
      return (
        (sStart >= pStart && sStart <= pEnd) ||
        (sEnd >= pStart && sEnd <= pEnd) ||
        (sStart <= pStart && sEnd >= pEnd)
      );
    });

    return { ...p, schedules: entries };
  });
};

/**
 * Merges overlapping intervals (in minutes).
 * Example input: [{start: 60, end: 120}, {start: 110, end: 150}]
 * Output: [{start: 60, end: 150}]
 */
export const mergeIntervals = (intervals) => {
  if (!intervals.length) return [];
  intervals.sort((a, b) => a.start - b.start);
  const res = [];
  let cur = { ...intervals[0] };
  for (let i = 1; i < intervals.length; i++) {
    const it = intervals[i];
    if (it.start <= cur.end) {
      cur.end = Math.max(cur.end, it.end);
    } else {
      res.push(cur);
      cur = { ...it };
    }
  }
  res.push(cur);
  return res;
};

/**
 * Computes shared free times per period for main and friend schedules.
 * Workdays are Monday to Friday 07:00-21:00 by default.
 * Returns array with freeTimesByDay per period.
 */
export const computeSharedFreeTimesPerPeriod = (mainPeriods, friendPeriods) => {
  try {
    if (!Array.isArray(mainPeriods) || !Array.isArray(friendPeriods)) {
      return [];
    }

    const workDays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const startOfDay = timeToMinutes("07:00");
    const endOfDay = timeToMinutes("21:00");

    const results = [];

    // Build friend periods lookup by label
    const friendPeriodMap = new Map();
    for (const fp of friendPeriods) {
      if (fp.label) friendPeriodMap.set(fp.label, fp);
    }

    for (const pMain of mainPeriods) {
      if (!pMain || !pMain.label || !Array.isArray(pMain.schedules)) {
        continue;
      }
      const pFriend = friendPeriodMap.get(pMain.label) || { schedules: [] };

      // Defensive: check schedules arrays
      if (!Array.isArray(pFriend.schedules)) {
        pFriend.schedules = [];
      }

      const combined = [...pMain.schedules, ...pFriend.schedules];

      const freeTimesByDay = {};

      for (const day of workDays) {
        const intervals = [];

        for (const cls of combined) {
          if (!cls.days || !cls.days.includes(day)) continue;
          if (!cls.startTime || !cls.endTime) continue;

          const s = timeToMinutes(cls.startTime);
          const e = timeToMinutes(cls.endTime);

          if (isNaN(s) || isNaN(e)) continue;
          if (e <= s) continue;

          const start = Math.max(s, startOfDay);
          const end = Math.min(e, endOfDay);
          if (start < end) intervals.push({ start, end });
        }

        const merged = mergeIntervals(intervals);

        const frees = [];
        let cursor = startOfDay;

        for (const it of merged) {
          if (it.start > cursor) {
            frees.push({ start: cursor, end: it.start });
          }
          cursor = Math.max(cursor, it.end);
        }
        if (cursor < endOfDay) {
          frees.push({ start: cursor, end: endOfDay });
        }

        freeTimesByDay[day] = frees;
      }

      results.push({
        periodIndex: pMain.index,
        type: pMain.type,
        label: pMain.label,
        freeTimesByDay,
      });
    }

    return results;
  } catch (error) {
    console.error("Error in computeSharedFreeTimesPerPeriod:", error);
    return [];
  }
};
