import { useMemo } from "react";
import { createPeriods, computePeriodSlotData } from "../utils/scheduleHelpers";

/**
 * @param {Object|null} mainOwner    { id, name, entries }
 * @param {Array}       friendOwners [{ id, name, entries }, ...]
 */
export default function useSchedulePeriods(mainOwner, friendOwners) {
  const owners = useMemo(() => {
    const list = [];
    if (mainOwner && mainOwner.entries?.length) list.push(mainOwner);
    for (const f of friendOwners || []) {
      if (f && f.entries?.length) list.push(f);
    }
    return list;
  }, [mainOwner, friendOwners]);

  const periods = useMemo(() => {
    const all = owners.flatMap((o) => o.entries);
    return createPeriods(all);
  }, [owners]);

  const periodSlotData = useMemo(
    () => computePeriodSlotData(periods, owners),
    [periods, owners]
  );

  return { periods, periodSlotData, owners };
}
