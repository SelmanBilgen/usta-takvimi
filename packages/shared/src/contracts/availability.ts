export type AvailabilityLevel = "AVAILABLE" | "LIMITED" | "FULL";

export interface AvailabilityDay {
  date: string;
  status: AvailabilityLevel;
  freeCapacity: number;
  totalCapacity: number;
}

export interface AvailabilityResponse {
  expertiseId: number;
  days: AvailabilityDay[];
}
