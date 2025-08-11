import React from "react";
import { minutesToHHMM } from "../utils/dateUtils";

export default function PeriodFreeTimes({ periodFreeTimes, periods }) {
  return (
    <>
      {periodFreeTimes.map((pft) => {
        const period = periods.find((p) => p.index === pft.periodIndex);
        return (
          <div key={pft.periodIndex} className="mb-4">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 transition-colors duration-300">
              Period {pft.periodIndex} ({pft.type}) — {period?.startDateFormatted} to{" "}
              {period?.endDateFormatted}
            </h3>
            <div className="ml-4 mt-1">
              {["Mon", "Tue", "Wed", "Thu", "Fri"].map((day) => {
                const slots = pft.freeTimesByDay[day] || [];
                return (
                  <div key={day} className="text-gray-700 dark:text-gray-300 transition-colors duration-300">
                    <strong>{day}:</strong>{" "}
                    {slots.length === 0 ? (
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        No free time
                      </span>
                    ) : (
                      slots
                        .map(
                          (s) =>
                            `${minutesToHHMM(s.start)} - ${minutesToHHMM(s.end)}`
                        )
                        .join(", ")
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
