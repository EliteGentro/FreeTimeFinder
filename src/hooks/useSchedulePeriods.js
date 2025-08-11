import { useMemo } from "react";
import {
    createPeriods,
    assignSchedulesToPeriods,
    computeSharedFreeTimesPerPeriod,
} from "../utils/scheduleHelpers";

export default function useSchedulePeriods(mainSchedule, friendsSchedules) {
    // Memoize periods, recompute only when schedules change
    const periods = useMemo(() => {
        const all = [...mainSchedule, ...friendsSchedules];
        const p = createPeriods(all);
        return p;
    }, [mainSchedule, friendsSchedules]);

    const mainPeriods = useMemo(() => {
        const assigned = assignSchedulesToPeriods(periods, mainSchedule);
        return assigned;
    }, [periods, mainSchedule]);

    const friendPeriods = useMemo(() => {
        const assigned = assignSchedulesToPeriods(periods, friendsSchedules);
        return assigned;
    }, [periods, friendsSchedules]);

    // Memoize computation of shared free times
    const periodFreeTimes = useMemo(() => {
        if (mainPeriods.length === 0) {
            return [];
        }
        return computeSharedFreeTimesPerPeriod(mainPeriods, friendPeriods);
    }, [mainPeriods, friendPeriods]);

    return { periods, periodFreeTimes };
}
