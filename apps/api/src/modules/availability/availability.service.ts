import { AvailabilityDay, AvailabilityResponse } from "@ustatakvimi/shared";

import { ValidationError } from "../../shared/errors/app-error.js";
import { getDailyCapacities } from "./availability.repository.js";

function toStatus(totalCapacity: number, usedCapacity: number): AvailabilityDay["status"] {
  if (totalCapacity <= 0) {
    return "FULL";
  }

  const ratio = usedCapacity / totalCapacity;

  if (ratio >= 1) {
    return "FULL";
  }

  if (ratio >= 0.5) {
    return "LIMITED";
  }

  return "AVAILABLE";
}

export async function getAvailability(expertiseId: number, startDate: string, endDate: string): Promise<AvailabilityResponse> {
  if (expertiseId <= 0) {
    throw new ValidationError("Invalid expertiseId");
  }

  const rows = await getDailyCapacities(expertiseId, startDate, endDate);

  const days: AvailabilityDay[] = rows.map((row) => {
    const totalCapacity = Number(row.totalCapacity);
    const usedCapacity = Number(row.usedCapacity);
    return {
      date: row.date,
      status: toStatus(totalCapacity, usedCapacity),
      freeCapacity: Math.max(totalCapacity - usedCapacity, 0),
      totalCapacity
    };
  });

  return {
    expertiseId,
    days
  };
}
