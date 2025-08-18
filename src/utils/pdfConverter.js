export const extractScheduleEntriesIris = (text) => {
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
    return classEntries.join("\n");
}

export const extractScheduleEntriesMitec = (text) => {
    const dayAbbr = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

    // Normalize whitespace to single spaces for easier regex matching
    const normalized = text.replace(/\s+/g, " ");

    // Find bloques section boundaries
    const classesStart = normalized.indexOf("Unidades de Formación");
    if (classesStart === -1) return ""; // No relevant section found

    let classesEnd = normalized.length;

    const bloquesText = normalized.slice(classesStart, classesEnd).trim();

    function adjustTimeRange(rangeStr) {
        const [start, end] = rangeStr.split(" - ");

        function roundToNearestHalfHour(timeStr) {
            const [h, m] = timeStr.split(":").map(Number);
            const date = new Date(0, 0, 0, h, m);

            // Round minutes to nearest 0 or 30
            const minutes = date.getMinutes();
            const roundedMinutes = minutes < 15 ? 0 : minutes < 45 ? 30 : 60;

            if (roundedMinutes === 60) {
            date.setHours(date.getHours() + 1);
            date.setMinutes(0);
            } else {
            date.setMinutes(roundedMinutes);
            }

            return date.toTimeString().slice(0, 5); // HH:MM
        }

        const newStart = roundToNearestHalfHour(start);
        const newEnd = roundToNearestHalfHour(end);

        return `${newStart} - ${newEnd}`;
    }

    function parseBlocks(sectionText) {
        const entries = [];
        const dateRangePattern = String.raw`\d{2}-\d{2}-\d{4}\s*al\s*\d{2}-\d{2}-\d{4}`;

        const blockRegex = new RegExp(
        `(${dateRangePattern})([\\s\\S]*?)(?=${dateRangePattern}|$)`,
        "g"
        );
        
        // Split by "Dates:"
        const blocks = [...sectionText.matchAll(blockRegex)].map(m => m[1] + m[2] + " ".trim());

        for (const block of blocks) {
            const trimmedBlock = block.trim();
            if(trimmedBlock.indexOf("No Aplica") >= 0) continue; //Classes without schedule
            // Extract course code: first token after Unidad de formación:
            const courseCodeMatch = trimmedBlock.match(/[A-Z]+[0-9]+[A-Z]*\.[0-9]{3}/);
            if (!courseCodeMatch) continue;
            const courseCode = courseCodeMatch[0].split('.')[0];
            

            // Find the date range: DD.MM.YYYY - DD.MM.YYYY
            const dateRangeMatch = trimmedBlock.match(dateRangePattern);
            if (!dateRangeMatch) continue;

            const startDate = dateRangeMatch[0].split("al")[0].trim().replaceAll("-",".");
            const endDate = dateRangeMatch[0].split("al")[1].trim().replaceAll("-",".");

            // Find where the time of the class ends
            const idxTimeEnd = trimmedBlock.indexOf('hrs');

            // Substring after course code and before time end
            const idxCourseCodeEnd = trimmedBlock.indexOf(courseCode) + courseCode.length + 4;
            let betweenText = trimmedBlock.slice(idxCourseCodeEnd, idxTimeEnd).trim();


            let earliestIndex = -1;

            for (const day of dayAbbr) {
                // Replace all dashes with spaces
                const changedText = betweenText.replace(/-/g, " ");
                // Match the day as a separate word
                const regex = new RegExp(`\\b${day}\\b`, "g");
                const match = regex.exec(changedText);
                if (match) {
                    const idx = match.index;
                    if (earliestIndex === -1 || idx < earliestIndex) {
                        earliestIndex = idx;
                    }
                }
            }
            if (earliestIndex === -1) continue; // no valid day abbreviation found

            const dayTimeSection = betweenText.slice(earliestIndex);

            // Regex to find all day/time entries, e.g. "Lu-Ma 09:00 a 11:00"
            const pattern = `(?:${dayAbbr.join("|")})(?:[ -]+(?:${dayAbbr.join("|")}))*\\s+\\d{2}:\\d{2} a \\d{2}:\\d{2}`;
            const dayTimeRegex = new RegExp(pattern, "g");

            const dayTimeMatches = dayTimeSection.match(dayTimeRegex);
            if (!dayTimeMatches) continue;

            for (const dt of dayTimeMatches) {
                const newDate = dt.replaceAll("-", ", ").replace(" a ", " - ");
                const parts = newDate.match(/^([A-Za-záéíóúñ, ]+) (\d{2}:\d{2} - \d{2}:\d{2})$/);
                if (!parts) continue;
                const days = parts[1].replace(/\s*,\s*/g, ", ").trim();
                const timeRange = adjustTimeRange(parts[2]); //Mitec add up to 10 minutes from start and removes 10 from end
                entries.push(`${courseCode} | ${days} ${timeRange} | ${startDate}-${endDate}`);
            }
        }
        return entries;
    }

    // Capture returned arrays from both sections
    const classEntries = parseBlocks(bloquesText);

    return classEntries.join("\n");
}