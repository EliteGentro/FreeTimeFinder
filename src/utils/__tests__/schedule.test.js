/**
 * Test suite for ScheduleMatch parsing utilities.
 *
 * Coverage:
 *  - detectScheduleFormat
 *  - extractStudentName
 *  - extractScheduleEntriesIris    (per-field + full-parser assertions)
 *  - extractScheduleEntriesMitec   (per-field + full-parser assertions)
 *  - roundToHalfHour  (via Mitec time output)
 *  - scheduleHelpers: mergeIntervals, createPeriods, computePeriodSlotData,
 *                     sharedFreeRangesPerDay
 *  - dateUtils: all exports
 *  - icsExport: generateICS (structure, RFC 5545 fields, escaping, folding)
 *
 * Fixtures use the actual text shapes extracted from the four example PDFs
 * (Main.pdf / Resumen_proceso.pdf → Iris; Horario.pdf / Roberto Horario.pdf → Mitec).
 */

import { describe, it, expect } from "vitest";

import {
  detectScheduleFormat,
  extractStudentName,
  extractScheduleEntriesIris,
  extractScheduleEntriesMitec,
} from "../pdfConverter.js";

import {
  mergeIntervals,
  createPeriods,
  computePeriodSlotData,
  sharedFreeRangesPerDay,
  WORK_DAYS,
  DAY_START_MIN,
  DAY_END_MIN,
} from "../scheduleHelpers.js";

import {
  dayMap,
  timeToMinutes,
  minutesToHHMM,
  parseDate,
  formatDateDot,
} from "../dateUtils.js";

import { generateICS } from "../icsExport.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build an Iris-format text fixture (line-preserved, from Main.pdf shape). */
const buildIrisText = (...blocks) =>
  `Mi horario\nBloques / Materias del plan de estudios\n${blocks.join("\n")}`;

const irisBlock = ({
  code = "TC2007B",
  title = "Integración de seguridad informática en redes y sistemas de software",
  professors = "Elvia Itzamná Rosas Herrera",
  daytimes = ["Lun, Mié, Jue, Vie 11:00 - 15:00"],
  dates = "22.09.2025 - 05.12.2025",
  location = "MTY | Aulas III | 306",
  extra = "Sub-período 5 | 501 | CRN 54692\nPresencial",
} = {}) =>
  `Unidad de formación: ${code}\n${title}\n${professors}\n${daytimes.join("\n")}\n${dates}\n${location}\n${extra}`;

/** Build a Mitec-format text fixture (line-preserved, from Horario.pdf shape). */
const buildMitecText = (...blocks) =>
  `Horarios\nUnidades de Formación\n${blocks.join("\n")}`;

const mitecBlock = ({
  startDateLine = "11-08-2025",
  endDateLine = "14-09-2025",
  codeLine = "TC1028.454 Pensamiento computacional para ingeniería",
  crn = "CRN 70397",
  professor = "Profesor Titular: Jesús Carlos Morón García",
  dayLine = "Lu-Ju",
  timeLine = "07:10 a 08:50 hrs",
  building = "Aulas III",
  room = "Salón 205",
  attrs = "Atributos: Curso Oficial",
} = {}) =>
  `${startDateLine}\nal\n${endDateLine}\n${codeLine}\n${crn}\n${professor}\n${dayLine}\n${timeLine}\n${building}\n${room}\n${attrs}`;

// ---------------------------------------------------------------------------
// 1. detectScheduleFormat
// ---------------------------------------------------------------------------

describe("detectScheduleFormat", () => {
  it("returns 'iris' for text containing 'Mi horario'", () => {
    expect(detectScheduleFormat("Mi horario\nresto")).toBe("iris");
  });

  it("returns 'iris' for text containing the section header", () => {
    expect(
      detectScheduleFormat("Bloques / Materias del plan de estudios")
    ).toBe("iris");
  });

  it("returns 'mitec' for text containing 'Unidades de Formación'", () => {
    expect(detectScheduleFormat("Unidades de Formación")).toBe("mitec");
  });

  it("returns 'mitec' for text containing 'CRN' marker", () => {
    expect(detectScheduleFormat("CRN 12345")).toBe("mitec");
  });

  it("returns 'unknown' for null", () => {
    expect(detectScheduleFormat(null)).toBe("unknown");
  });

  it("returns 'unknown' for empty string", () => {
    expect(detectScheduleFormat("")).toBe("unknown");
  });

  it("returns 'unknown' for unrecognised content", () => {
    expect(detectScheduleFormat("Lorem ipsum dolor sit amet")).toBe("unknown");
  });

  it("Iris takes precedence over CRN when both markers are present", () => {
    // In practice an Iris PDF can also contain 'CRN'
    expect(detectScheduleFormat("Mi horario\nCRN 12345")).toBe("iris");
  });
});

// ---------------------------------------------------------------------------
// 2. extractStudentName
// ---------------------------------------------------------------------------

describe("extractStudentName", () => {
  it("extracts name from Iris format (name + student ID in parens)", () => {
    expect(
      extractStudentName("Alumno: Humberto Genaro Cisneros Salinas (A01723264)")
    ).toBe("Humberto Genaro Cisneros Salinas");
  });

  it("extracts name from Mitec format (name + Matricula: label)", () => {
    expect(
      extractStudentName("Alumno: Roberto Ochoa\nMatricula: A00843882")
    ).toBe("Roberto Ochoa");
  });

  it("extracts name from loose format (just Alumno: Name)", () => {
    expect(extractStudentName("Alumno: Mario Franco")).toBe("Mario Franco");
  });

  it("collapses extra whitespace in the name (all internal runs collapsed)", () => {
    // The impl uses .replace(/\s+/g, " ") which collapses ALL whitespace,
    // including runs inside the name.
    expect(
      extractStudentName("Alumno:   Humberto  Genaro   Cisneros (A01)")
    ).toBe("Humberto Genaro Cisneros");
    const name = extractStudentName(
      "Alumno:    Humberto Genaro Cisneros (A01723264)"
    );
    expect(name).toBe("Humberto Genaro Cisneros");
  });

  it("returns null for null input", () => {
    expect(extractStudentName(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractStudentName("")).toBeNull();
  });

  it("returns null when no Alumno: marker is present", () => {
    expect(extractStudentName("Horarios\nPeriodo: Semestral")).toBeNull();
  });

  it("handles accented characters in the name", () => {
    const result = extractStudentName(
      "Alumno: Mario Alejandro Franco González (A00843594)"
    );
    expect(result).toBe("Mario Alejandro Franco González");
  });
});

// ---------------------------------------------------------------------------
// 3. extractScheduleEntriesIris — individual field assertions
// ---------------------------------------------------------------------------

describe("extractScheduleEntriesIris — field extraction", () => {
  const text = buildIrisText(
    irisBlock({
      code: "TC2007B",
      title: "Integración de seguridad informática en redes y sistemas de software",
      daytimes: ["Lun, Mié, Jue, Vie 11:00 - 15:00"],
      dates: "22.09.2025 - 05.12.2025",
      location: "MTY | Aulas III | 306",
    })
  );
  const entries = extractScheduleEntriesIris(text);

  it("produces one entry per (course, day) combination", () => {
    // Lun, Mié, Jue, Vie → 4 days
    expect(entries).toHaveLength(4);
  });

  it("extracts course code correctly", () => {
    expect(entries[0].name).toBe("TC2007B");
  });

  it("extracts full subject title", () => {
    expect(entries[0].title).toBe(
      "Integración de seguridad informática en redes y sistemas de software"
    );
  });

  it("maps Spanish day abbreviations to English", () => {
    const days = entries.map((e) => e.days[0]);
    expect(days).toContain("Mon");
    expect(days).toContain("Wed");
    expect(days).toContain("Thu");
    expect(days).toContain("Fri");
  });

  it("each entry has exactly one day", () => {
    for (const e of entries) {
      expect(e.days).toHaveLength(1);
    }
  });

  it("extracts start time", () => {
    expect(entries[0].startTime).toBe("11:00");
  });

  it("extracts end time", () => {
    expect(entries[0].endTime).toBe("15:00");
  });

  it("extracts start date in DD.MM.YYYY format", () => {
    expect(entries[0].startDate).toBe("22.09.2025");
  });

  it("extracts end date in DD.MM.YYYY format", () => {
    expect(entries[0].endDate).toBe("05.12.2025");
  });

  it("classifies non-S-ending code as 'course'", () => {
    expect(entries[0].type).toBe("course");
  });

  it("extracts location in pipe-delimited Iris format", () => {
    expect(entries[0].location).toBe("MTY | Aulas III | 306");
  });
});

// ---------------------------------------------------------------------------
// 4. extractScheduleEntriesIris — type classification
// ---------------------------------------------------------------------------

describe("extractScheduleEntriesIris — type: week", () => {
  const text = buildIrisText(
    irisBlock({
      code: "WKVP3002S",
      title: "A un clic de tu vida profesional",
      daytimes: ["Lun, Mié, Jue, Vie 08:00 - 11:00"],
      dates: "15.09.2025 - 19.09.2025",
      location: "MTY | Aulas IV | 304",
    })
  );
  const entries = extractScheduleEntriesIris(text);

  it("classifies S-ending code as 'week'", () => {
    expect(entries[0].type).toBe("week");
  });
});

// ---------------------------------------------------------------------------
// 5. extractScheduleEntriesIris — multiple day-time groups
// ---------------------------------------------------------------------------

describe("extractScheduleEntriesIris — multiple day-time lines", () => {
  // TC2008B has two day-time lines: Mon/Wed/Fri AND Tue/Thu
  const text = buildIrisText(
    irisBlock({
      code: "TC2008B",
      title: "Modelación de sistemas multiagentes",
      daytimes: ["Lun, Mié, Vie 13:00 - 17:00", "Mar, Jue 15:00 - 17:00"],
      dates: "11.08.2025 - 11.09.2025",
      location: "MTY | Aulas III | 203",
    })
  );
  const entries = extractScheduleEntriesIris(text);

  it("produces 5 entries (3 + 2 days)", () => {
    expect(entries).toHaveLength(5);
  });

  it("Mon entry has correct times from first group", () => {
    const mon = entries.find((e) => e.days[0] === "Mon");
    expect(mon).toBeDefined();
    expect(mon.startTime).toBe("13:00");
    expect(mon.endTime).toBe("17:00");
  });

  it("Tue entry has correct times from second group", () => {
    const tue = entries.find((e) => e.days[0] === "Tue");
    expect(tue).toBeDefined();
    expect(tue.startTime).toBe("15:00");
    expect(tue.endTime).toBe("17:00");
  });

  it("all entries share the same title", () => {
    const titles = new Set(entries.map((e) => e.title));
    expect(titles.size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 6. extractScheduleEntriesIris — 30-minute class (boundary value)
// ---------------------------------------------------------------------------

describe("extractScheduleEntriesIris — 30-minute class", () => {
  const text = buildIrisText(
    irisBlock({
      code: "WA1057",
      title: "Mi plan de vida en el Tec",
      daytimes: ["Vie 11:00 - 11:30"],
      dates: "15.08.2025 - 05.12.2025",
      location: "MTY | Edificio Indefinido | ESCOLAR35",
    })
  );
  const entries = extractScheduleEntriesIris(text);

  it("produces exactly one entry", () => {
    expect(entries).toHaveLength(1);
  });

  it("start and end time are 30 minutes apart", () => {
    const e = entries[0];
    const diff =
      timeToMinutes(e.endTime) - timeToMinutes(e.startTime);
    expect(diff).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// 7. extractScheduleEntriesIris — 6-hour class (boundary value)
// ---------------------------------------------------------------------------

describe("extractScheduleEntriesIris — 6-hour class", () => {
  const text = buildIrisText(
    irisBlock({
      code: "TC2007B",
      title: "Integración de seguridad",
      daytimes: ["Lun 09:00 - 15:00"],
      dates: "22.09.2025 - 05.12.2025",
      location: "MTY | Aulas III | 306",
    })
  );
  const entries = extractScheduleEntriesIris(text);

  it("produces exactly one entry", () => {
    expect(entries).toHaveLength(1);
  });

  it("start and end time are 6 hours apart", () => {
    const e = entries[0];
    const diff =
      timeToMinutes(e.endTime) - timeToMinutes(e.startTime);
    expect(diff).toBe(360);
  });
});

// ---------------------------------------------------------------------------
// 8. extractScheduleEntriesIris — skip blocks with no date/daytime
// ---------------------------------------------------------------------------

describe("extractScheduleEntriesIris — skip invalid blocks", () => {
  it("skips a block with 'Sin horario asignado'", () => {
    const text = buildIrisText(
      `Unidad de formación: NN2009\nProyectos de vinculación\nKaren Yolanda\nSin horario asignado\n-\nNAL | Edificio Campus Nacional | CNAL`
    );
    expect(extractScheduleEntriesIris(text)).toHaveLength(0);
  });

  it("skips a block missing a date range entirely", () => {
    const text = buildIrisText(
      `Unidad de formación: XX1234\nSome Title\nLun 09:00 - 10:00\n`
    );
    expect(extractScheduleEntriesIris(text)).toHaveLength(0);
  });

  it("skips a block missing day-time lines (date present but no daytime)", () => {
    const text = buildIrisText(
      `Unidad de formación: XX9999\nSome Title\n01.01.2025 - 30.06.2025\nMTY | Aulas I | 101\n`
    );
    expect(extractScheduleEntriesIris(text)).toHaveLength(0);
  });

  it("returns empty array for null input", () => {
    expect(extractScheduleEntriesIris(null)).toEqual([]);
  });

  it("returns empty array for text without section header", () => {
    expect(extractScheduleEntriesIris("Hola mundo")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 9. extractScheduleEntriesIris — location variants
// ---------------------------------------------------------------------------

describe("extractScheduleEntriesIris — location variants", () => {
  it("parses 'MTY | Aulas III | 306'", () => {
    const text = buildIrisText(
      irisBlock({ location: "MTY | Aulas III | 306" })
    );
    expect(extractScheduleEntriesIris(text)[0].location).toBe(
      "MTY | Aulas III | 306"
    );
  });

  it("parses 'MTY | Edificio Indefinido | ESCOLAR35'", () => {
    const text = buildIrisText(
      irisBlock({ location: "MTY | Edificio Indefinido | ESCOLAR35" })
    );
    expect(extractScheduleEntriesIris(text)[0].location).toBe(
      "MTY | Edificio Indefinido | ESCOLAR35"
    );
  });

  it("parses 'NAL | Edificio Campus Nacional | CNAL'", () => {
    const text = buildIrisText(
      irisBlock({
        location: "NAL | Edificio Campus Nacional | CNAL",
        daytimes: ["Lun 09:00 - 10:00"],
        dates: "11.08.2025 - 05.12.2025",
      })
    );
    expect(extractScheduleEntriesIris(text)[0].location).toBe(
      "NAL | Edificio Campus Nacional | CNAL"
    );
  });

  it("leaves location empty string when no location line present", () => {
    // Block without a location line
    const noLocText = `Mi horario\nBloques / Materias del plan de estudios\nUnidad de formación: AB1234\nAlguna materia\nLun 09:00 - 10:00\n11.08.2025 - 14.09.2025\nSub-período 1 | CRN 12345\n`;
    const entries = extractScheduleEntriesIris(noLocText);
    expect(entries[0].location).toBe("");
  });
});

// ---------------------------------------------------------------------------
// 10. extractScheduleEntriesIris — multiple blocks (full parser)
// ---------------------------------------------------------------------------

describe("extractScheduleEntriesIris — full Main.pdf fixture", () => {
  // Condensed but structurally identical fixture derived from actual Main.pdf text.
  const text = buildIrisText(
    irisBlock({
      code: "TC2007B",
      title: "Integración de seguridad informática en redes y sistemas de software",
      daytimes: ["Lun, Mié, Jue, Vie 11:00 - 15:00"],
      dates: "22.09.2025 - 05.12.2025",
      location: "MTY | Aulas III | 306",
    }),
    irisBlock({
      code: "TC2008B",
      title: "Modelación de sistemas multiagentes con gráficas computacionales",
      daytimes: ["Lun, Mié, Vie 13:00 - 17:00", "Mar, Jue 15:00 - 17:00"],
      dates: "11.08.2025 - 11.09.2025",
      location: "MTY | Aulas III | 203",
    }),
    irisBlock({
      code: "TC2038",
      title: "Análisis y diseño de algoritmos avanzados",
      daytimes: ["Lun, Jue 09:00 - 11:00"],
      dates: "11.08.2025 - 04.12.2025",
      location: "MTY | Aulas VII | 105",
    }),
    irisBlock({
      code: "TI2002S",
      title: "Inteligencia artificial para textos científicos",
      daytimes: ["Lun, Mar, Mié, Jue, Vie 10:00 - 13:00"],
      dates: "27.10.2025 - 31.10.2025",
      location: "MTY | Aulas III | 416",
    }),
    irisBlock({
      code: "WKVP3002S",
      title: "A un clic de tu vida profesional",
      daytimes: ["Lun, Mié, Jue, Vie 08:00 - 11:00"],
      dates: "15.09.2025 - 19.09.2025",
      location: "MTY | Aulas IV | 304",
    }),
    // "Sin horario" entries — should be skipped
    `Unidad de formación: NN2009\nProyectos de vinculación\nKaren\nSin horario asignado\n-\nNAL | Edificio Campus Nacional | CNAL\nSub-períodos 1-3\n`
  );

  const entries = extractScheduleEntriesIris(text);

  it("total entry count matches expected days across all courses", () => {
    // TC2007B: 4, TC2008B: 5, TC2038: 2, TI2002S: 5, WKVP3002S: 4 = 20
    expect(entries).toHaveLength(20);
  });

  it("no entry is included for 'Sin horario' block", () => {
    expect(entries.find((e) => e.name === "NN2009")).toBeUndefined();
  });

  it("TI2002S is classified as 'week'", () => {
    const e = entries.find((e) => e.name === "TI2002S");
    expect(e.type).toBe("week");
  });

  it("TC2007B is classified as 'course'", () => {
    const e = entries.find((e) => e.name === "TC2007B");
    expect(e.type).toBe("course");
  });

  it("every entry has all required fields", () => {
    for (const e of entries) {
      expect(e.name).toBeTruthy();
      expect(e.title).toBeTruthy();
      expect(Array.isArray(e.days)).toBe(true);
      expect(e.days).toHaveLength(1);
      expect(e.startTime).toMatch(/^\d{2}:\d{2}$/);
      expect(e.endTime).toMatch(/^\d{2}:\d{2}$/);
      expect(e.startDate).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
      expect(e.endDate).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
      expect(["course", "week"]).toContain(e.type);
      expect(typeof e.location).toBe("string");
    }
  });
});

// ---------------------------------------------------------------------------
// 11. extractScheduleEntriesMitec — individual field assertions
// ---------------------------------------------------------------------------

describe("extractScheduleEntriesMitec — field extraction", () => {
  const text = buildMitecText(
    mitecBlock({
      startDateLine: "11-08-2025",
      endDateLine: "14-09-2025",
      codeLine: "TC1028.454 Pensamiento computacional para ingeniería",
      crn: "CRN 70397",
      professor: "Profesor Titular: Jesús Carlos Morón García",
      dayLine: "Lu-Ju",
      timeLine: "07:10 a 08:50 hrs",
      building: "Aulas III",
      room: "Salón 205",
    })
  );
  const entries = extractScheduleEntriesMitec(text);

  it("produces one entry per day (Lu and Ju → Mon and Thu)", () => {
    expect(entries).toHaveLength(2);
  });

  it("extracts course code stripping section number", () => {
    expect(entries[0].name).toBe("TC1028");
  });

  it("extracts title after the code", () => {
    expect(entries[0].title).toContain("Pensamiento computacional");
  });

  it("maps 'Lu' to 'Mon'", () => {
    const mon = entries.find((e) => e.days[0] === "Mon");
    expect(mon).toBeDefined();
  });

  it("maps 'Ju' to 'Thu'", () => {
    const thu = entries.find((e) => e.days[0] === "Thu");
    expect(thu).toBeDefined();
  });

  it("rounds 07:10 start down to 07:00", () => {
    expect(entries[0].startTime).toBe("07:00");
  });

  it("rounds 08:50 end up to 09:00", () => {
    expect(entries[0].endTime).toBe("09:00");
  });

  it("extracts date in DD.MM.YYYY format", () => {
    expect(entries[0].startDate).toBe("11.08.2025");
    expect(entries[0].endDate).toBe("14.09.2025");
  });

  it("extracts building", () => {
    expect(entries[0].location).toContain("Aulas III");
  });

  it("extracts room", () => {
    expect(entries[0].location).toContain("Salón 205");
  });

  it("separates building and room with ' | '", () => {
    expect(entries[0].location).toBe("Aulas III | Salón 205");
  });
});

// ---------------------------------------------------------------------------
// 12. extractScheduleEntriesMitec — roundToHalfHour exhaustive
// ---------------------------------------------------------------------------

describe("extractScheduleEntriesMitec — time rounding", () => {
  const makeText = (timeLine) =>
    buildMitecText(
      mitecBlock({ dayLine: "Lu", timeLine, startDateLine: "11-08-2025", endDateLine: "14-09-2025" })
    );

  const getTime = (timeLine) => {
    const entries = extractScheduleEntriesMitec(makeText(timeLine));
    return entries.length > 0
      ? { start: entries[0].startTime, end: entries[0].endTime }
      : null;
  };

  it("exact half-hour boundaries are unchanged (07:00 a 08:00)", () => {
    const t = getTime("07:00 a 08:00 hrs");
    expect(t?.start).toBe("07:00");
    expect(t?.end).toBe("08:00");
  });

  it("rounds :10 → :00 (< 15 min threshold)", () => {
    expect(getTime("07:10 a 08:00 hrs")?.start).toBe("07:00");
  });

  it("rounds :20 → :30 (≥ 15 min, < 45 min threshold)", () => {
    expect(getTime("07:20 a 08:00 hrs")?.start).toBe("07:30");
  });

  it("rounds :50 → :00 next hour (≥ 45 min threshold)", () => {
    expect(getTime("07:50 a 09:00 hrs")?.start).toBe("08:00");
  });

  it("rounds :45 → :00 next half (r=15 is ≥ 15 so ceils)", () => {
    // 7*60+45=465, r=465%30=15.
    // r===0? no. r<15? 15<15 is false → else branch: totalMin += 30-15 = 480 → 08:00.
    // The threshold is strictly < 15, so :45 (r=15) rounds UP, not down.
    expect(getTime("07:45 a 09:00 hrs")?.start).toBe("08:00");
  });

  it("rounds :14 → :00 (< 15 threshold)", () => {
    expect(getTime("07:14 a 09:00 hrs")?.start).toBe("07:00");
  });

  it("rounds :15 → :30 (= 15 threshold uses ≥15 branch)", () => {
    expect(getTime("07:15 a 09:00 hrs")?.start).toBe("07:30");
  });
});

// ---------------------------------------------------------------------------
// 13. extractScheduleEntriesMitec — 30-minute class (boundary)
// ---------------------------------------------------------------------------

describe("extractScheduleEntriesMitec — 30-minute class", () => {
  const text = buildMitecText(
    mitecBlock({
      dayLine: "Vi",
      timeLine: "11:00 a 11:30 hrs",
      startDateLine: "11-08-2025",
      endDateLine: "14-09-2025",
    })
  );
  const entries = extractScheduleEntriesMitec(text);

  it("produces exactly one entry", () => {
    expect(entries).toHaveLength(1);
  });

  it("class is 30 minutes long", () => {
    const e = entries[0];
    expect(timeToMinutes(e.endTime) - timeToMinutes(e.startTime)).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// 14. extractScheduleEntriesMitec — 6-hour class (boundary)
// ---------------------------------------------------------------------------

describe("extractScheduleEntriesMitec — 6-hour class", () => {
  const text = buildMitecText(
    mitecBlock({
      dayLine: "Lu",
      timeLine: "09:00 a 15:00 hrs",
      startDateLine: "11-08-2025",
      endDateLine: "14-09-2025",
    })
  );
  const entries = extractScheduleEntriesMitec(text);

  it("produces exactly one entry", () => {
    expect(entries).toHaveLength(1);
  });

  it("class is 6 hours (360 min) long", () => {
    const e = entries[0];
    expect(timeToMinutes(e.endTime) - timeToMinutes(e.startTime)).toBe(360);
  });
});

// ---------------------------------------------------------------------------
// 15. extractScheduleEntriesMitec — skip blocks
// ---------------------------------------------------------------------------

describe("extractScheduleEntriesMitec — skip invalid blocks", () => {
  it("skips block with 'No Aplica'", () => {
    const t2 = buildMitecText(
      `11-08-2025\nal\n14-09-2025\nTC1028.454 Pensamiento\nCRN 1234\nProfesor T\nLu\n07:00 a 08:00 hrs\nNo Aplica\nSalón 101\nAtributos`
    );
    expect(extractScheduleEntriesMitec(t2)).toHaveLength(0);
  });

  it("skips block with 'Sin horario'", () => {
    const t = buildMitecText(
      `11-08-2025\nal\n14-09-2025\nTC1028.454 Pensamiento\nCRN 1234\nProfesor T\nSin horario\n-\nNo Aplica\nAtributos`
    );
    expect(extractScheduleEntriesMitec(t)).toHaveLength(0);
  });

  it("returns empty array for null input", () => {
    expect(extractScheduleEntriesMitec(null)).toEqual([]);
  });

  it("returns empty array for text without section marker", () => {
    expect(extractScheduleEntriesMitec("Mi horario")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 16. extractScheduleEntriesMitec — multiple blocks (full parser)
// ---------------------------------------------------------------------------

describe("extractScheduleEntriesMitec — full Horario.pdf fixture", () => {
  const text = buildMitecText(
    mitecBlock({
      startDateLine: "11-08-2025",
      endDateLine: "14-09-2025",
      codeLine: "TC1028.454 Pensamiento computacional para ingeniería",
      crn: "CRN 70397",
      professor: "Profesor Titular: Jesús Carlos Morón García",
      dayLine: "Lu-Ju",
      timeLine: "07:10 a 08:50 hrs",
      building: "Aulas III",
      room: "Salón 205",
    }),
    mitecBlock({
      startDateLine: "11-08-2025",
      endDateLine: "14-09-2025",
      codeLine: "F1001B.155 Modelación de la ingeniería y ciencias",
      crn: "CRN 70230",
      professor: "Profesor Titular: José Manuel Pardo Regueiro",
      dayLine: "Ma-Mi-Vi",
      timeLine: "07:10 a 10:50 hrs",
      building: "Edificio CEDES",
      room: "Salón 1107",
    }),
    mitecBlock({
      startDateLine: "15-09-2025",
      endDateLine: "21-09-2025",
      codeLine: "EM1001S.102 Emprende con propósito",
      crn: "CRN 55781",
      professor: "Profesor Titular: Luis Portales",
      dayLine: "Lu-Ma-Mi-Ju-Vi",
      timeLine: "08:10 a 10:50 hrs",
      building: "Aulas III",
      room: "Salón 109",
    })
  );

  const entries = extractScheduleEntriesMitec(text);

  it("total entry count: TC1028(2) + F1001B(3) + EM1001S(5) = 10", () => {
    expect(entries).toHaveLength(10);
  });

  it("EM1001S is classified as 'week'", () => {
    const e = entries.find((e) => e.name === "EM1001S");
    expect(e.type).toBe("week");
  });

  it("TC1028 is classified as 'course'", () => {
    const e = entries.find((e) => e.name === "TC1028");
    expect(e.type).toBe("course");
  });

  it("F1001B has building 'Edificio CEDES'", () => {
    const e = entries.find((e) => e.name === "F1001B");
    expect(e.location).toContain("Edificio CEDES");
  });

  it("every entry has all required fields", () => {
    for (const e of entries) {
      expect(e.name).toBeTruthy();
      expect(e.title).toBeTruthy();
      expect(e.days).toHaveLength(1);
      expect(e.startTime).toMatch(/^\d{2}:\d{2}$/);
      expect(e.endTime).toMatch(/^\d{2}:\d{2}$/);
      expect(e.startDate).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
      expect(e.endDate).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
      expect(["course", "week"]).toContain(e.type);
      expect(typeof e.location).toBe("string");
    }
  });
});

// ---------------------------------------------------------------------------
// 17. extractScheduleEntriesMitec — location variants
// ---------------------------------------------------------------------------

describe("extractScheduleEntriesMitec — location variants", () => {
  const mkText = (building, room) =>
    buildMitecText(
      mitecBlock({
        dayLine: "Lu",
        timeLine: "09:00 a 10:00 hrs",
        building,
        room,
        startDateLine: "11-08-2025",
        endDateLine: "14-09-2025",
      })
    );

  it("'Edificio CIAP' + 'Salón 313'", () => {
    const e = extractScheduleEntriesMitec(mkText("Edificio CIAP", "Salón 313"))[0];
    expect(e.location).toBe("Edificio CIAP | Salón 313");
  });

  it("'Aulas IV' + 'Salón 320'", () => {
    const e = extractScheduleEntriesMitec(mkText("Aulas IV", "Salón 320"))[0];
    expect(e.location).toBe("Aulas IV | Salón 320");
  });

  it("'Aulas III' + 'Salón CNAL'", () => {
    const e = extractScheduleEntriesMitec(mkText("Aulas III", "Salón CNAL"))[0];
    expect(e.location).toBe("Aulas III | Salón CNAL");
  });

  it("'Edificio CEDES' + 'Salón 506'", () => {
    const e = extractScheduleEntriesMitec(mkText("Edificio CEDES", "Salón 506"))[0];
    expect(e.location).toBe("Edificio CEDES | Salón 506");
  });
});

// ---------------------------------------------------------------------------
// 18. Mixed Iris + Mitec format — same logical week cluster
// ---------------------------------------------------------------------------

describe("Cross-format compatibility — week clustering", () => {
  // Iris encodes Semana Tec as Mon–Fri, Mitec as Mon–Sun.
  const irisWeek = {
    name: "TI2002S",
    title: "Semana",
    days: ["Mon"],
    startTime: "10:00",
    endTime: "13:00",
    startDate: "27.10.2025",
    endDate: "31.10.2025",
    type: "week",
    location: "MTY | Aulas III | 416",
  };
  const mitecWeek = {
    name: "EM1001S",
    title: "Semana",
    days: ["Mon"],
    startTime: "08:00",
    endTime: "11:00",
    startDate: "27.10.2025",
    endDate: "02.11.2025",  // Mitec extends to Sunday
    type: "week",
    location: "Aulas III | Salón 109",
  };
  const course = {
    name: "TC2007B",
    title: "Course",
    days: ["Mon"],
    startTime: "11:00",
    endTime: "15:00",
    startDate: "22.09.2025",
    endDate: "05.12.2025",
    type: "course",
    location: "MTY | Aulas III | 306",
  };

  const periods = createPeriods([irisWeek, mitecWeek, course]);

  it("produces exactly 3 periods (course + week + course) from overlapping weeks", () => {
    expect(periods).toHaveLength(3);
    expect(periods.filter((p) => p.type === "week")).toHaveLength(1);
  });

  it("the week period spans the broader of the two overlapping ranges", () => {
    const wk = periods.find((p) => p.type === "week");
    // Mitec end date is 02.11 (Sun), which is later than 31.10 (Fri)
    expect(formatDateDot(wk.end)).toBe("02.11.2025");
  });
});

// ---------------------------------------------------------------------------
// 19. mergeIntervals
// ---------------------------------------------------------------------------

describe("mergeIntervals", () => {
  it("returns empty array for empty input", () => {
    expect(mergeIntervals([])).toEqual([]);
  });

  it("single interval is returned unchanged", () => {
    expect(mergeIntervals([{ start: 60, end: 120 }])).toEqual([
      { start: 60, end: 120 },
    ]);
  });

  it("merges two overlapping intervals", () => {
    expect(
      mergeIntervals([
        { start: 60, end: 120 },
        { start: 100, end: 150 },
      ])
    ).toEqual([{ start: 60, end: 150 }]);
  });

  it("merges two adjacent (touching) intervals", () => {
    expect(
      mergeIntervals([
        { start: 60, end: 120 },
        { start: 120, end: 150 },
      ])
    ).toEqual([{ start: 60, end: 150 }]);
  });

  it("keeps two disjoint intervals separate", () => {
    const result = mergeIntervals([
      { start: 60, end: 90 },
      { start: 120, end: 150 },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ start: 60, end: 90 });
    expect(result[1]).toEqual({ start: 120, end: 150 });
  });

  it("handles unsorted input", () => {
    const result = mergeIntervals([
      { start: 120, end: 150 },
      { start: 60, end: 90 },
    ]);
    expect(result[0].start).toBe(60);
  });

  it("merges when one interval is fully contained in another", () => {
    expect(
      mergeIntervals([
        { start: 60, end: 180 },
        { start: 90, end: 120 },
      ])
    ).toEqual([{ start: 60, end: 180 }]);
  });

  it("merges three overlapping intervals into one", () => {
    expect(
      mergeIntervals([
        { start: 60, end: 120 },
        { start: 100, end: 150 },
        { start: 140, end: 200 },
      ])
    ).toEqual([{ start: 60, end: 200 }]);
  });
});

// ---------------------------------------------------------------------------
// 20. createPeriods
// ---------------------------------------------------------------------------

describe("createPeriods", () => {
  it("returns empty for null/undefined input", () => {
    expect(createPeriods(null)).toEqual([]);
    expect(createPeriods(undefined)).toEqual([]);
    expect(createPeriods([])).toEqual([]);
  });

  it("returns empty for schedules with unparseable dates", () => {
    expect(
      createPeriods([
        { name: "X", days: ["Mon"], startTime: "09:00", endTime: "10:00", startDate: "bad", endDate: "also-bad", type: "course", location: "" },
      ])
    ).toEqual([]);
  });

  it("returns single course period when no week schedules present", () => {
    const entries = [
      {
        name: "TC2007B", title: "T", days: ["Mon"], startTime: "11:00",
        endTime: "15:00", startDate: "22.09.2025", endDate: "05.12.2025",
        type: "course", location: "",
      },
    ];
    const periods = createPeriods(entries);
    expect(periods).toHaveLength(1);
    expect(periods[0].type).toBe("course");
  });

  it("returns 3 periods for one week cluster", () => {
    const entries = [
      { name: "A", title: "", days: ["Mon"], startTime: "09:00", endTime: "10:00", startDate: "11.08.2025", endDate: "14.09.2025", type: "course", location: "" },
      { name: "WS", title: "", days: ["Mon"], startTime: "08:00", endTime: "10:00", startDate: "15.09.2025", endDate: "19.09.2025", type: "week", location: "" },
      { name: "B", title: "", days: ["Mon"], startTime: "09:00", endTime: "10:00", startDate: "22.09.2025", endDate: "04.12.2025", type: "course", location: "" },
    ];
    const periods = createPeriods(entries);
    expect(periods).toHaveLength(3);
    expect(periods.map((p) => p.type)).toEqual(["course", "week", "course"]);
  });

  it("returns 5 periods for two week clusters", () => {
    const entries = [
      { name: "A", title: "", days: ["Mon"], startTime: "09:00", endTime: "10:00", startDate: "11.08.2025", endDate: "14.09.2025", type: "course", location: "" },
      { name: "W1", title: "", days: ["Mon"], startTime: "08:00", endTime: "10:00", startDate: "15.09.2025", endDate: "19.09.2025", type: "week", location: "" },
      { name: "B", title: "", days: ["Mon"], startTime: "09:00", endTime: "10:00", startDate: "22.09.2025", endDate: "26.10.2025", type: "course", location: "" },
      { name: "W2", title: "", days: ["Mon"], startTime: "08:00", endTime: "10:00", startDate: "27.10.2025", endDate: "31.10.2025", type: "week", location: "" },
      { name: "C", title: "", days: ["Mon"], startTime: "09:00", endTime: "10:00", startDate: "03.11.2025", endDate: "07.12.2025", type: "course", location: "" },
    ];
    const periods = createPeriods(entries);
    expect(periods).toHaveLength(5);
    expect(periods.map((p) => p.type)).toEqual([
      "course", "week", "course", "week", "course",
    ]);
  });

  it("trims to 2 week clusters when more than 2 exist", () => {
    const mkWeek = (start, end) => ({
      name: "WS", title: "", days: ["Mon"], startTime: "08:00", endTime: "10:00",
      startDate: start, endDate: end, type: "week", location: "",
    });
    const entries = [
      { name: "A", title: "", days: ["Mon"], startTime: "09:00", endTime: "10:00", startDate: "01.01.2025", endDate: "31.12.2025", type: "course", location: "" },
      mkWeek("03.03.2025", "07.03.2025"),
      mkWeek("05.05.2025", "09.05.2025"),
      mkWeek("07.07.2025", "11.07.2025"),
      mkWeek("01.09.2025", "05.09.2025"),
    ];
    const periods = createPeriods(entries);
    expect(periods.filter((p) => p.type === "week")).toHaveLength(2);
  });

  it("period labels are human-readable", () => {
    const entries = [
      { name: "A", title: "", days: ["Mon"], startTime: "09:00", endTime: "10:00", startDate: "11.08.2025", endDate: "14.09.2025", type: "course", location: "" },
      { name: "W1", title: "", days: ["Mon"], startTime: "08:00", endTime: "10:00", startDate: "15.09.2025", endDate: "19.09.2025", type: "week", location: "" },
      { name: "B", title: "", days: ["Mon"], startTime: "09:00", endTime: "10:00", startDate: "22.09.2025", endDate: "04.12.2025", type: "course", location: "" },
    ];
    const periods = createPeriods(entries);
    expect(periods[0].label).toBe("Course Period 1");
    expect(periods[1].label).toBe("Week Period 1");
    expect(periods[2].label).toBe("Course Period 2");
  });

  it("period indices are sequential starting at 1", () => {
    const entries = [
      { name: "A", title: "", days: ["Mon"], startTime: "09:00", endTime: "10:00", startDate: "11.08.2025", endDate: "14.09.2025", type: "course", location: "" },
    ];
    const periods = createPeriods(entries);
    expect(periods[0].index).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 21. computePeriodSlotData
// ---------------------------------------------------------------------------

describe("computePeriodSlotData", () => {
  const period = {
    index: 1,
    type: "course",
    start: new Date(2025, 7, 11),
    end: new Date(2025, 8, 14),
    label: "Course Period 1",
    startDateFormatted: "11.08.2025",
    endDateFormatted: "14.09.2025",
  };

  it("returns empty array for empty periods", () => {
    expect(computePeriodSlotData([], [])).toEqual([]);
  });

  it("returns empty array for empty owners", () => {
    expect(computePeriodSlotData([period], [])).toEqual([]);
  });

  it("produces 28 slots per day (07:00–21:00 at 30-min intervals)", () => {
    const owners = [{ id: "u1", name: "User", entries: [] }];
    const data = computePeriodSlotData([period], owners);
    expect(data[0].freeByDay["Mon"]).toHaveLength((21 - 7) * 2);
  });

  it("all slots are free when owner has no classes", () => {
    const owners = [{ id: "u1", name: "User", entries: [] }];
    const data = computePeriodSlotData([period], owners);
    for (const slot of data[0].freeByDay["Mon"]) {
      expect(slot.freeOwnerIds).toContain("u1");
    }
  });

  it("marks slot as busy when it overlaps a class", () => {
    const owners = [
      {
        id: "u1",
        name: "User",
        entries: [
          {
            name: "TC1",
            title: "",
            days: ["Mon"],
            startTime: "09:00",
            endTime: "11:00",
            startDate: "11.08.2025",
            endDate: "14.09.2025",
            type: "course",
            location: "",
          },
        ],
      },
    ];
    const data = computePeriodSlotData([period], owners);
    // 09:00–09:30 slot → index (9*60-7*60)/30 = (540-420)/30 = 4
    const slot09 = data[0].freeByDay["Mon"].find(
      (s) => s.start === timeToMinutes("09:00")
    );
    expect(slot09?.freeOwnerIds).not.toContain("u1");
  });

  it("slot just before the class is free", () => {
    const owners = [
      {
        id: "u1",
        name: "User",
        entries: [
          {
            name: "TC1", title: "", days: ["Mon"],
            startTime: "09:00", endTime: "11:00",
            startDate: "11.08.2025", endDate: "14.09.2025",
            type: "course", location: "",
          },
        ],
      },
    ];
    const data = computePeriodSlotData([period], owners);
    const slot0830 = data[0].freeByDay["Mon"].find(
      (s) => s.start === timeToMinutes("08:30")
    );
    expect(slot0830?.freeOwnerIds).toContain("u1");
  });

  it("slot just after the class is free", () => {
    const owners = [
      {
        id: "u1",
        name: "User",
        entries: [
          {
            name: "TC1", title: "", days: ["Mon"],
            startTime: "09:00", endTime: "11:00",
            startDate: "11.08.2025", endDate: "14.09.2025",
            type: "course", location: "",
          },
        ],
      },
    ];
    const data = computePeriodSlotData([period], owners);
    const slot11 = data[0].freeByDay["Mon"].find(
      (s) => s.start === timeToMinutes("11:00")
    );
    expect(slot11?.freeOwnerIds).toContain("u1");
  });

  it("with two owners, both appear in freeOwnerIds when both are free", () => {
    const owners = [
      { id: "u1", name: "A", entries: [] },
      { id: "u2", name: "B", entries: [] },
    ];
    const data = computePeriodSlotData([period], owners);
    const slot = data[0].freeByDay["Mon"][0];
    expect(slot.freeOwnerIds).toContain("u1");
    expect(slot.freeOwnerIds).toContain("u2");
  });

  it("30-minute class occupies exactly 1 slot", () => {
    const owners = [
      {
        id: "u1", name: "User",
        entries: [
          {
            name: "X", title: "", days: ["Tue"],
            startTime: "10:00", endTime: "10:30",
            startDate: "11.08.2025", endDate: "14.09.2025",
            type: "course", location: "",
          },
        ],
      },
    ];
    const data = computePeriodSlotData([period], owners);
    const busySlots = data[0].freeByDay["Tue"].filter(
      (s) => !s.freeOwnerIds.includes("u1")
    );
    expect(busySlots).toHaveLength(1);
    expect(busySlots[0].start).toBe(timeToMinutes("10:00"));
  });

  it("6-hour class occupies exactly 12 slots", () => {
    const owners = [
      {
        id: "u1", name: "User",
        entries: [
          {
            name: "X", title: "", days: ["Wed"],
            startTime: "09:00", endTime: "15:00",
            startDate: "11.08.2025", endDate: "14.09.2025",
            type: "course", location: "",
          },
        ],
      },
    ];
    const data = computePeriodSlotData([period], owners);
    const busySlots = data[0].freeByDay["Wed"].filter(
      (s) => !s.freeOwnerIds.includes("u1")
    );
    expect(busySlots).toHaveLength(12);
  });
});

// ---------------------------------------------------------------------------
// 22. sharedFreeRangesPerDay
// ---------------------------------------------------------------------------

describe("sharedFreeRangesPerDay", () => {
  const mkPeriodSlot = (freeByDay) => ({
    periodIndex: 1,
    label: "Course Period 1",
    type: "course",
    freeByDay,
  });

  it("returns empty ranges when no owners selected", () => {
    const slot = mkPeriodSlot({
      Mon: [{ start: 420, end: 450, freeOwnerIds: ["u1"] }],
    });
    const result = sharedFreeRangesPerDay(slot, []);
    expect(result.Mon).toEqual([]);
  });

  it("returns a range when a single owner is free", () => {
    const slot = mkPeriodSlot({
      Mon: [{ start: 420, end: 450, freeOwnerIds: ["u1"] }],
      Tue: [],
      Wed: [],
      Thu: [],
      Fri: [],
    });
    const result = sharedFreeRangesPerDay(slot, ["u1"]);
    expect(result.Mon).toEqual([{ start: 420, end: 450 }]);
  });

  it("merges consecutive free slots into a single range", () => {
    const slot = mkPeriodSlot({
      Mon: [
        { start: 420, end: 450, freeOwnerIds: ["u1"] },
        { start: 450, end: 480, freeOwnerIds: ["u1"] },
      ],
      Tue: [], Wed: [], Thu: [], Fri: [],
    });
    const result = sharedFreeRangesPerDay(slot, ["u1"]);
    expect(result.Mon).toEqual([{ start: 420, end: 480 }]);
  });

  it("does not merge non-consecutive free slots (busy slot interrupts)", () => {
    // In a real slot grid every 30-min cell is present. A busy slot in the
    // middle breaks the consecutive run, so the result should be two ranges.
    const slot = mkPeriodSlot({
      Mon: [
        { start: 420, end: 450, freeOwnerIds: ["u1"] },
        { start: 450, end: 480, freeOwnerIds: [] },        // u1 busy here
        { start: 480, end: 510, freeOwnerIds: ["u1"] },
      ],
      Tue: [], Wed: [], Thu: [], Fri: [],
    });
    const result = sharedFreeRangesPerDay(slot, ["u1"]);
    expect(result.Mon).toHaveLength(2);
    expect(result.Mon[0]).toEqual({ start: 420, end: 450 });
    expect(result.Mon[1]).toEqual({ start: 480, end: 510 });
  });

  it("two owners: only returns slot where both are free", () => {
    const slot = mkPeriodSlot({
      Mon: [
        { start: 420, end: 450, freeOwnerIds: ["u1"] },          // only u1
        { start: 450, end: 480, freeOwnerIds: ["u1", "u2"] },    // both
        { start: 480, end: 510, freeOwnerIds: ["u2"] },           // only u2
      ],
      Tue: [], Wed: [], Thu: [], Fri: [],
    });
    const result = sharedFreeRangesPerDay(slot, ["u1", "u2"]);
    expect(result.Mon).toEqual([{ start: 450, end: 480 }]);
  });

  it("returns empty for all days when no slot satisfies the selection", () => {
    const slot = mkPeriodSlot({
      Mon: [{ start: 420, end: 450, freeOwnerIds: ["u1"] }],
      Tue: [], Wed: [], Thu: [], Fri: [],
    });
    const result = sharedFreeRangesPerDay(slot, ["u1", "u2"]);
    expect(result.Mon).toEqual([]);
  });

  it("covers all WORK_DAYS keys in result", () => {
    const freeByDay = {};
    for (const d of WORK_DAYS) freeByDay[d] = [];
    const result = sharedFreeRangesPerDay(mkPeriodSlot(freeByDay), ["u1"]);
    for (const d of WORK_DAYS) expect(result[d]).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 23. dateUtils
// ---------------------------------------------------------------------------

describe("dateUtils", () => {
  describe("timeToMinutes", () => {
    it("converts '07:00' → 420", () => {
      expect(timeToMinutes("07:00")).toBe(420);
    });
    it("converts '21:00' → 1260", () => {
      expect(timeToMinutes("21:00")).toBe(1260);
    });
    it("converts '00:00' → 0", () => {
      expect(timeToMinutes("00:00")).toBe(0);
    });
    it("converts '23:59' → 1439", () => {
      expect(timeToMinutes("23:59")).toBe(1439);
    });
    it("converts '09:30' → 570", () => {
      expect(timeToMinutes("09:30")).toBe(570);
    });
  });

  describe("minutesToHHMM", () => {
    it("0 → '00:00'", () => {
      expect(minutesToHHMM(0)).toBe("00:00");
    });
    it("420 → '07:00'", () => {
      expect(minutesToHHMM(420)).toBe("07:00");
    });
    it("570 → '09:30'", () => {
      expect(minutesToHHMM(570)).toBe("09:30");
    });
    it("1260 → '21:00'", () => {
      expect(minutesToHHMM(1260)).toBe("21:00");
    });
  });

  describe("parseDate", () => {
    it("parses '11.08.2025' correctly", () => {
      const d = parseDate("11.08.2025");
      expect(d).toBeInstanceOf(Date);
      expect(d.getFullYear()).toBe(2025);
      expect(d.getMonth()).toBe(7); // 0-indexed
      expect(d.getDate()).toBe(11);
    });
    it("returns null for null", () => {
      expect(parseDate(null)).toBeNull();
    });
    it("returns null for empty string", () => {
      expect(parseDate("")).toBeNull();
    });
    it("returns null for malformed string", () => {
      expect(parseDate("2025-08-11")).toBeNull();
    });
    it("returns null for year < 1900", () => {
      expect(parseDate("01.01.1899")).toBeNull();
    });
    it("returns null for month 0", () => {
      expect(parseDate("01.00.2025")).toBeNull();
    });
    it("returns null for day 0", () => {
      expect(parseDate("00.01.2025")).toBeNull();
    });
  });

  describe("formatDateDot", () => {
    it("formats Date to DD.MM.YYYY", () => {
      expect(formatDateDot(new Date(2025, 7, 11))).toBe("11.08.2025");
    });
    it("pads single-digit day and month", () => {
      expect(formatDateDot(new Date(2025, 0, 5))).toBe("05.01.2025");
    });
    it("returns empty string for null", () => {
      expect(formatDateDot(null)).toBe("");
    });
  });

  describe("dayMap", () => {
    it("maps 'Lun' → 'Mon'", () => {
      expect(dayMap["Lun"]).toBe("Mon");
    });
    it("maps 'Mié' → 'Wed'", () => {
      expect(dayMap["Mié"]).toBe("Wed");
    });
    it("maps 'Mie' (accent-less) → 'Wed'", () => {
      expect(dayMap["Mie"]).toBe("Wed");
    });
    it("maps 'Lu' (Mitec) → 'Mon'", () => {
      expect(dayMap["Lu"]).toBe("Mon");
    });
    it("maps 'Vi' (Mitec) → 'Fri'", () => {
      expect(dayMap["Vi"]).toBe("Fri");
    });
    it("maps 'Sáb' → 'Sat'", () => {
      expect(dayMap["Sáb"]).toBe("Sat");
    });
    it("maps 'Sab' (accent-less) → 'Sat'", () => {
      expect(dayMap["Sab"]).toBe("Sat");
    });
  });
});

// ---------------------------------------------------------------------------
// 24. generateICS — structure and per-field assertions
// ---------------------------------------------------------------------------

describe("generateICS", () => {
  const baseEntry = (overrides = {}) => ({
    name: "TC2007B",
    title: "Integración de seguridad informática en redes y sistemas de software",
    days: ["Mon"],
    startTime: "11:00",
    endTime: "15:00",
    startDate: "22.09.2025",
    endDate: "05.12.2025",
    type: "course",
    location: "MTY | Aulas III | 306",
    ...overrides,
  });

  const owner = (entries = [baseEntry()]) => ({
    id: "test-owner",
    name: "Test User",
    entries,
  });

  it("output begins with BEGIN:VCALENDAR", () => {
    const ics = generateICS(owner());
    expect(ics).toMatch(/^BEGIN:VCALENDAR/);
  });

  it("output ends with END:VCALENDAR", () => {
    const ics = generateICS(owner());
    expect(ics.trim()).toMatch(/END:VCALENDAR$/);
  });

  it("contains VERSION:2.0", () => {
    expect(generateICS(owner())).toContain("VERSION:2.0");
  });

  it("contains BEGIN:VEVENT and END:VEVENT pair", () => {
    const ics = generateICS(owner());
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
  });

  it("contains DTSTART with TZID", () => {
    expect(generateICS(owner())).toMatch(/DTSTART;TZID=/);
  });

  it("contains DTEND with TZID", () => {
    expect(generateICS(owner())).toMatch(/DTEND;TZID=/);
  });

  it("datetime format is YYYYMMDDTHHMMSS", () => {
    const ics = generateICS(owner());
    // Find the DTSTART value after the TZID=...: portion
    expect(ics).toMatch(/DTSTART;TZID=[^:]+:\d{8}T\d{6}/);
  });

  it("RRULE uses FREQ=WEEKLY", () => {
    expect(generateICS(owner())).toMatch(/RRULE:FREQ=WEEKLY/);
  });

  it("RRULE has BYDAY matching the day", () => {
    expect(generateICS(owner())).toMatch(/BYDAY=MO/);
  });

  it("RRULE has UNTIL with end date", () => {
    // 05.12.2025 → 20251205T235959Z
    expect(generateICS(owner())).toMatch(/UNTIL=20251205T235959Z/);
  });

  it("SUMMARY includes course code", () => {
    expect(generateICS(owner())).toMatch(/SUMMARY:TC2007B/);
  });

  it("SUMMARY includes title when title is present", () => {
    expect(generateICS(owner())).toContain("Integración de seguridad");
  });

  it("SUMMARY falls back to code only when title is empty", () => {
    const ics = generateICS(owner([baseEntry({ title: "" })]));
    const summaryLine = ics.split(/\r?\n/).find((l) => /^SUMMARY/.test(l));
    expect(summaryLine).toContain("TC2007B");
    expect(summaryLine).not.toContain("—");
  });

  it("LOCATION is present when location is non-empty", () => {
    expect(generateICS(owner())).toMatch(/^LOCATION:/m);
  });

  it("LOCATION is omitted when location is empty string", () => {
    const ics = generateICS(owner([baseEntry({ location: "" })]));
    expect(ics).not.toContain("LOCATION:");
  });

  it("escapes commas in SUMMARY", () => {
    const ics = generateICS(
      owner([baseEntry({ name: "TC1", title: "Math, Science" })])
    );
    const summaryLine = ics
      .split(/\r?\n/)
      .find((l) => l.startsWith("SUMMARY"));
    expect(summaryLine).toContain("\\,");
  });

  it("escapes semicolons in LOCATION", () => {
    const ics = generateICS(
      owner([baseEntry({ location: "Room A; Room B" })])
    );
    expect(ics).toContain("\\;");
  });

  it("escapes backslashes in text fields", () => {
    const ics = generateICS(
      owner([baseEntry({ title: "Path\\File" })])
    );
    expect(ics).toContain("\\\\");
  });

  it("lines are at most 75 characters before folding continuation", () => {
    const ics = generateICS(owner());
    for (const line of ics.split(/\r\n/)) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
  });

  it("folded lines have continuation whitespace prefix", () => {
    // A very long title will definitely trigger folding
    const longTitle = "X".repeat(200);
    const ics = generateICS(owner([baseEntry({ title: longTitle })]));
    const lines = ics.split(/\r\n/);
    const foldedIdx = lines.findIndex(
      (l, i) => i > 0 && lines[i - 1].length === 75 && l.startsWith(" ")
    );
    expect(foldedIdx).toBeGreaterThan(-1);
  });

  it("UID is unique across multiple events", () => {
    const ics = generateICS(
      owner([baseEntry(), baseEntry({ days: ["Tue"] })])
    );
    const uids = ics
      .split(/\r\n/)
      .filter((l) => l.startsWith("UID:"))
      .map((l) => l.slice(4));
    expect(new Set(uids).size).toBe(uids.length);
  });

  it("produces no VEVENT for entry with empty days array", () => {
    const ics = generateICS(owner([baseEntry({ days: [] })]));
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("produces no VEVENT for entry with missing startTime", () => {
    const ics = generateICS(
      owner([baseEntry({ startTime: null })])
    );
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("produces no VEVENT when firstDate > endDate (impossible recurring window)", () => {
    // Entry where startDate is after endDate
    const ics = generateICS(
      owner([baseEntry({ startDate: "01.12.2025", endDate: "01.01.2025", days: ["Mon"] })])
    );
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("30-minute class: DTSTART and DTEND are 30 minutes apart", () => {
    const ics = generateICS(
      owner([baseEntry({ startTime: "10:00", endTime: "10:30", days: ["Mon"] })])
    );
    const lines = ics.split(/\r\n/).filter((l) => /^DT(START|END);/.test(l));
    // unfold continuation lines
    const unfolded = lines.map((l) => {
      const match = l.match(/:\d{8}T(\d{6})$/);
      return match ? match[1] : l;
    });
    const startSec = parseInt(unfolded[0].slice(0, 2)) * 3600 +
      parseInt(unfolded[0].slice(2, 4)) * 60 +
      parseInt(unfolded[0].slice(4, 6));
    const endSec = parseInt(unfolded[1].slice(0, 2)) * 3600 +
      parseInt(unfolded[1].slice(2, 4)) * 60 +
      parseInt(unfolded[1].slice(4, 6));
    expect(endSec - startSec).toBe(30 * 60);
  });

  it("6-hour class: DTSTART and DTEND are 6 hours apart", () => {
    const ics = generateICS(
      owner([baseEntry({ startTime: "09:00", endTime: "15:00", days: ["Mon"] })])
    );
    const timePart = (line) => {
      const m = line.match(/:(\d{8}T\d{6})$/);
      return m ? m[1] : null;
    };
    const lines = ics.split(/\r\n/).filter((l) => /^DT(START|END);/.test(l));
    const start = timePart(lines[0]);
    const end = timePart(lines[1]);
    if (start && end) {
      const toSec = (s) =>
        parseInt(s.slice(9, 11)) * 3600 + parseInt(s.slice(11, 13)) * 60;
      expect(toSec(end) - toSec(start)).toBe(6 * 3600);
    }
  });

  it("empty entries array → no VEVENT blocks", () => {
    const ics = generateICS({ id: "u1", name: "Empty", entries: [] });
    expect(ics).not.toContain("BEGIN:VEVENT");
    expect(ics).toContain("BEGIN:VCALENDAR");
  });
});
