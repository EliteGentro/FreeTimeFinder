import { dayMap } from "./dateUtils";

export const parseScheduleText = (llmText) => {
  const dayTimeGroupRegex =
    /([A-Za-záéíóúüñÁÉÍÓÚÜÑ, ]+\s+\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})/g;

  const lines = llmText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const results = [];

  for (const line of lines) {
    const parts = line.split("|").map((s) => s.trim());
    if (parts.length < 3) continue; // now only 3 parts expected

    const [name, daysTimes, dates] = parts;
    const dateParts = dates.split("-").map((s) => s.trim());
    if (dateParts.length !== 2) continue;
    const [startDate, endDate] = dateParts;

    const groups = daysTimes.match(dayTimeGroupRegex);
    if (!groups) continue;

    for (const group of groups) {
      const timeStartIdx = group.search(/\d/);
      if (timeStartIdx === -1) continue;

      const daysPart = group.slice(0, timeStartIdx).trim();
      const timePart = group.slice(timeStartIdx).trim();

      const daysArray = daysPart
        .split(",")
        .map((d) => (dayMap[d.trim()] ? dayMap[d.trim()] : d.trim()));

      const [startTime, endTime] = timePart.split("-").map((s) => s.trim());
      if (!startTime || !endTime) continue;

      // Assign type based on whether course name ends with 'S'
      const type = name.endsWith("S") ? "week" : "course";

      for (const day of daysArray) {
        results.push({
          name,
          days: [day],
          startTime,
          endTime,
          startDate,
          endDate,
          type,
        });
      }
    }
  }

  return results;
};
