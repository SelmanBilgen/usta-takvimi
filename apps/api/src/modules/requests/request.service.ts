import { RequestStatus } from "@ustatakvimi/shared";

import { ValidationError } from "../../shared/errors/app-error.js";
import { createRequest } from "./request.repository.js";

interface NewRequestInput {
  clientId: number;
  expertiseId: number;
  startDate: string;
  endDate: string;
  description?: string;
  estimatedWorkerCount: number;
}

export async function createNewRequest(input: NewRequestInput): Promise<{ requestId: number; status: RequestStatus }> {
  if (input.estimatedWorkerCount < 1) {
    throw new ValidationError("estimatedWorkerCount must be greater than 0");
  }

  if (input.endDate < input.startDate) {
    throw new ValidationError("endDate cannot be before startDate");
  }

  const requestId = await createRequest(input);

  return {
    requestId,
    status: RequestStatus.PENDING
  };
}
