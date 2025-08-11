export const extractScheduleEntries = (text) => {
    const dayAbbr = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

    // Normalize whitespace to single spaces for easier regex matching
    const normalized = text.replace(/\s+/g, " ");

    // Find bloques section boundaries
    const classesStart = normalized.indexOf("Bloques / Materias del plan de estudios");
    if (classesStart === -1) return ""; // No relevant section found

    let classesEnd = normalized.length;

    const bloquesText = normalized.slice(classesStart, classesEnd).trim();

    function parseBlocks(sectionText) {
        const entries = [];

        // Split by "Unidad de formación:" and skip the first empty element
        const blocks = sectionText.split("Unidad de formación:").slice(1);

        for (const block of blocks) {
            const trimmedBlock = block.trim();

            // Extract course code: first token after Unidad de formación:
            const courseCodeMatch = trimmedBlock.match(/^(\S+)/);
            if (!courseCodeMatch) continue;
            const courseCode = courseCodeMatch[1];

            // Find the date range: DD.MM.YYYY - DD.MM.YYYY
            const dateRangeRegex = /(\d{2}\.\d{2}\.\d{4})\s*-\s*(\d{2}\.\d{2}\.\d{4})/;
            const dateRangeMatch = trimmedBlock.match(dateRangeRegex);
            if (!dateRangeMatch) continue;

            const startDate = dateRangeMatch[1];
            const endDate = dateRangeMatch[2];

            // Find the index where the date range starts
            const idxDateRangeStart = dateRangeMatch.index;

            // Substring after course code and before date range
            const idxCourseCodeEnd = trimmedBlock.indexOf(courseCode) + courseCode.length;
            let betweenText = trimmedBlock.slice(idxCourseCodeEnd, idxDateRangeStart).trim();

            let earliestIndex = -1;
            for (const day of dayAbbr) {
                const regex = new RegExp(`\\b${day}\\b`, "g");
                const match = regex.exec(betweenText);
                if (match) {
                    const idx = match.index;
                    if (earliestIndex === -1 || idx < earliestIndex) {
                        earliestIndex = idx;
                    }
                }
            }
            if (earliestIndex === -1) continue; // no valid day abbreviation found

            const dayTimeSection = betweenText.slice(earliestIndex);

            // Regex to find all day/time entries, e.g. "Lun, Mar 09:00 - 11:00"
            const pattern = `(?:${dayAbbr.join("|")})(?:[ ,]+(?:${dayAbbr.join("|")}))*\\s+\\d{2}:\\d{2} - \\d{2}:\\d{2}`;
            const dayTimeRegex = new RegExp(pattern, "g");

            const dayTimeMatches = dayTimeSection.match(dayTimeRegex);
            if (!dayTimeMatches) continue;

            for (const dt of dayTimeMatches) {
                const parts = dt.match(/^([A-Za-záéíóúñ, ]+) (\d{2}:\d{2} - \d{2}:\d{2})$/);
                if (!parts) continue;
                const days = parts[1].replace(/\s*,\s*/g, ", ").trim();
                const timeRange = parts[2];
                entries.push(`${courseCode} | ${days} ${timeRange} | ${startDate}-${endDate}`);
            }
        }

        return entries;
    }

    // Capture returned arrays from both sections
    const classEntries = parseBlocks(bloquesText);
    console.log(classEntries.join("\n"));
    return classEntries.join("\n");
}