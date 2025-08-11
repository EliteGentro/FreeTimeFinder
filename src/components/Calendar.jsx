import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Calendar({ periods, periodFreeTimes }) {
  const [currentPeriodIndex, setCurrentPeriodIndex] = useState(0);

  const currentPeriod = periods[currentPeriodIndex];
  const currentFreeTimes = periodFreeTimes[currentPeriodIndex] || {};

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];

  // 30-minute slots from 07:00 to 21:00 → 28 slots
  const timeSlots = Array.from({ length: (21 - 7) * 2 }, (_, i) => {
    const hour = 7 + Math.floor(i / 2);
    const minute = i % 2 === 0 ? "00" : "30";
    return {
      hour,
      minute,
      minutesOfDay: hour * 60 + (i % 2) * 30,
    };
  });

  const handlePrev = () => {
    if (currentPeriodIndex > 0) setCurrentPeriodIndex((prev) => prev - 1);
  };

  const handleNext = () => {
    if (currentPeriodIndex < periods.length - 1)
      setCurrentPeriodIndex((prev) => prev + 1);
  };

  const isFreeTime = (day, minutesOfDay) => {
    if (!currentFreeTimes.freeTimesByDay) return false;
    const blocks = currentFreeTimes.freeTimesByDay[day] || [];
    const start = minutesOfDay;
    const end = minutesOfDay + 30;
    return blocks.some(({ start: s, end: e }) => start < e && end > s);
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 transition-colors duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePrev}
          disabled={currentPeriodIndex === 0}
          className="p-2 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors duration-200"
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 transition-colors duration-300">
          {currentPeriod?.name || `Period ${currentPeriodIndex + 1}`}
        </h2>
        <button
          onClick={handleNext}
          disabled={currentPeriodIndex === periods.length - 1}
          className="p-2 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors duration-200"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-6 border border-gray-300 dark:border-gray-600 transition-colors duration-300">
        {/* Header row */}
        <div className="bg-gray-50 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600" />
        {days.map((day) => (
          <div
            key={day}
            className="bg-gray-50 dark:bg-gray-700 border-b border-l border-gray-300 dark:border-gray-600 text-center font-semibold p-1 text-gray-900 dark:text-gray-100 transition-colors duration-300"
          >
            {day}
          </div>
        ))}

        {/* Time slots */}
        {timeSlots.map((slot, idx) => (
          <React.Fragment key={idx}>
            {/* Time label */}
            <div className="border-t border-gray-300 dark:border-gray-600 text-xs text-right pr-1 flex items-center justify-end text-gray-700 dark:text-gray-300 transition-colors duration-300">
              {slot.minute === "00" ? `${slot.hour}:00` : ""}
            </div>

            {/* Day cells */}
            {days.map((day) => (
              <div
                key={`${day}-${slot.hour}-${slot.minute}`}
                className={`border-t border-l border-gray-300 dark:border-gray-600 h-6 ${
                  isFreeTime(day, slot.minutesOfDay)
                    ? "bg-green-200 dark:bg-green-700"
                    : ""
                } transition-colors duration-300`}
              />
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
