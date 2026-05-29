import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { minutesToHHMM } from "../utils/dateUtils";
import {
  WORK_DAYS,
  DAY_START_MIN,
  DAY_END_MIN,
  SLOT_MIN,
  sharedFreeRangesPerDay,
} from "../utils/scheduleHelpers";

const MODES = [
  { id: "shared", label: "Shared" },
  { id: "heatmap", label: "Heat map" },
];

// Discrete heat scale, mapped against the share of selected owners that are
// free in a given 30-minute slot.
const HEAT_LEVELS_LIGHT = [
  "bg-white",
  "bg-emerald-50",
  "bg-emerald-100",
  "bg-emerald-200",
  "bg-emerald-300",
  "bg-emerald-500",
];
const HEAT_LEVELS_DARK = [
  "dark:bg-slate-900",
  "dark:bg-emerald-900/40",
  "dark:bg-emerald-800/60",
  "dark:bg-emerald-700/70",
  "dark:bg-emerald-600/80",
  "dark:bg-emerald-500",
];

const heatClass = (count, total) => {
  if (total === 0 || count === 0) return `${HEAT_LEVELS_LIGHT[0]} ${HEAT_LEVELS_DARK[0]}`;
  const ratio = count / total;
  const idx = Math.min(
    HEAT_LEVELS_LIGHT.length - 1,
    Math.max(1, Math.ceil(ratio * (HEAT_LEVELS_LIGHT.length - 1)))
  );
  return `${HEAT_LEVELS_LIGHT[idx]} ${HEAT_LEVELS_DARK[idx]}`;
};

const buildTimeRows = () => {
  const rows = [];
  for (let t = DAY_START_MIN; t < DAY_END_MIN; t += SLOT_MIN) {
    rows.push({ start: t, end: t + SLOT_MIN });
  }
  return rows;
};

export default function Calendar({
  periods,
  periodSlotData,
  owners,
  mainOwnerId,
}) {
  const [periodIdx, setPeriodIdx] = useState(0);
  const [mode, setMode] = useState("shared");
  const [excludedIds, setExcludedIds] = useState(() => new Set());
  const [hover, setHover] = useState(null); // { day, slotIdx, x, y }

  const safePeriodIdx = Math.min(periodIdx, Math.max(0, periods.length - 1));
  const period = periods[safePeriodIdx];
  const slotData = periodSlotData[safePeriodIdx];

  const timeRows = useMemo(buildTimeRows, []);

  const selectedOwnerIds = useMemo(
    () => owners.filter((o) => !excludedIds.has(o.id)).map((o) => o.id),
    [owners, excludedIds]
  );

  const ownerNameById = useMemo(() => {
    const m = new Map();
    for (const o of owners) m.set(o.id, o.name);
    return m;
  }, [owners]);

  const sharedRanges = useMemo(
    () =>
      slotData ? sharedFreeRangesPerDay(slotData, selectedOwnerIds) : {},
    [slotData, selectedOwnerIds]
  );

  const toggleOwner = (id) =>
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const goPrev = () => setPeriodIdx((i) => Math.max(0, i - 1));
  const goNext = () =>
    setPeriodIdx((i) => Math.min(periods.length - 1, i + 1));

  if (!period || !slotData) return null;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5">
      {/* Header: period nav + mode + filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            disabled={safePeriodIdx === 0}
            className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
            aria-label="Previous period"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="text-sm">
            <span className="font-semibold">{period.label}</span>
            <span className="ml-2 text-slate-500 dark:text-slate-400">
              {period.startDateFormatted} – {period.endDateFormatted}
            </span>
          </div>
          <button
            onClick={goNext}
            disabled={safePeriodIdx === periods.length - 1}
            className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
            aria-label="Next period"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div
          role="tablist"
          className="inline-flex rounded-md border border-slate-200 dark:border-slate-700 overflow-hidden text-xs"
        >
          {MODES.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => setMode(m.id)}
              className={`px-3 py-1.5 ${
                mode === m.id
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Owner filter chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {owners.map((o) => {
          const excluded = excludedIds.has(o.id);
          const isMain = o.id === mainOwnerId;
          return (
            <button
              key={o.id}
              onClick={() => toggleOwner(o.id)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                excluded
                  ? "border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 line-through"
                  : isMain
                  ? "border-slate-900 dark:border-slate-100 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              }`}
              title={excluded ? "Click to include" : "Click to exclude"}
            >
              {o.name}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="relative overflow-x-auto">
        <div className="grid min-w-[640px] grid-cols-[64px_repeat(5,minmax(0,1fr))] border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
          {/* Header row */}
          <div className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700" />
          {WORK_DAYS.map((day) => (
            <div
              key={day}
              className="bg-slate-50 dark:bg-slate-800 border-b border-l border-slate-200 dark:border-slate-700 text-center text-xs font-medium p-2 text-slate-700 dark:text-slate-200"
            >
              {day}
            </div>
          ))}

          {/* Time rows */}
          {timeRows.map((row, idx) => (
            <React.Fragment key={idx}>
              <div className="border-t border-slate-200 dark:border-slate-700 text-[10px] text-right pr-1 flex items-start justify-end pt-0.5 text-slate-500 dark:text-slate-400 h-6">
                {row.start % 60 === 0 ? minutesToHHMM(row.start) : ""}
              </div>
              {WORK_DAYS.map((day) => {
                const slot = slotData.freeByDay[day]?.[idx];
                const freeIds = (slot?.freeOwnerIds || []).filter((id) =>
                  selectedOwnerIds.includes(id)
                );
                const freeCount = freeIds.length;
                const total = selectedOwnerIds.length;
                const allFree = total > 0 && freeCount === total;

                let cellClass = "bg-white dark:bg-slate-900";
                if (mode === "heatmap") {
                  cellClass = heatClass(freeCount, total);
                } else if (allFree) {
                  cellClass = "bg-emerald-300 dark:bg-emerald-600";
                }

                const isHovered =
                  hover && hover.day === day && hover.slotIdx === idx;

                return (
                  <div
                    key={`${day}-${idx}`}
                    className={`relative border-t border-l border-slate-200 dark:border-slate-700 h-6 ${cellClass} ${
                      mode === "heatmap" || allFree
                        ? "cursor-pointer"
                        : ""
                    }`}
                    onMouseEnter={() => setHover({ day, slotIdx: idx })}
                    onMouseLeave={() => setHover(null)}
                  >
                    {isHovered && (
                      <Tooltip
                        day={day}
                        start={row.start}
                        end={row.end}
                        freeIds={freeIds}
                        total={total}
                        ownerNameById={ownerNameById}
                      />
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>

        {/* Legend */}
        {mode === "heatmap" && selectedOwnerIds.length > 0 && (
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span>0 free</span>
            <div className="flex">
              {HEAT_LEVELS_LIGHT.map((_, i) => (
                <div
                  key={i}
                  className={`h-3 w-5 border-r border-white dark:border-slate-900 ${HEAT_LEVELS_LIGHT[i]} ${HEAT_LEVELS_DARK[i]}`}
                />
              ))}
            </div>
            <span>all {selectedOwnerIds.length} free</span>
          </div>
        )}
      </div>

      {/* Per-day summary of shared ranges */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold mb-2 text-slate-800 dark:text-slate-200">
          Shared free time
        </h3>
        <ul className="space-y-1 text-sm">
          {WORK_DAYS.map((day) => {
            const ranges = sharedRanges[day] || [];
            return (
              <li
                key={day}
                className="flex gap-2 text-slate-700 dark:text-slate-300"
              >
                <span className="w-10 font-medium">{day}</span>
                <span className="text-slate-500 dark:text-slate-400">
                  {ranges.length === 0
                    ? "—"
                    : ranges
                        .map(
                          (r) =>
                            `${minutesToHHMM(r.start)}–${minutesToHHMM(r.end)}`
                        )
                        .join(", ")}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Tooltip({ day, start, end, freeIds, total, ownerNameById }) {
  const names = freeIds.map((id) => ownerNameById.get(id) || id);
  return (
    <div className="absolute z-20 left-1/2 -translate-x-1/2 -top-2 -translate-y-full pointer-events-none">
      <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-md px-3 py-2 text-xs text-slate-700 dark:text-slate-200 min-w-[12rem]">
        <div className="font-medium mb-1">
          {day} · {minutesToHHMM(start)}–{minutesToHHMM(end)}
        </div>
        <div className="text-slate-500 dark:text-slate-400 mb-1">
          {freeIds.length}/{total} free
        </div>
        {names.length === 0 ? (
          <div className="text-slate-400">No one is free</div>
        ) : (
          <ul className="space-y-0.5">
            {names.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
