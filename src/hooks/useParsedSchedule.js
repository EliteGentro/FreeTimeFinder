import { useMemo } from "react";
import { parseScheduleText } from "../utils/parseSchedule";

export default function useParsedSchedule(rawText) {
  return useMemo(() => {
    if (!rawText) return [];
    return parseScheduleText(rawText);
  }, [rawText]);
}
