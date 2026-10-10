import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors/app-error.js";
import {
  assignWorkersToRequestTransactional,
  findWorkerConflicts,
  getRequestDetail,
  listExpertiseWorkers,
  listPendingRequests
} from "./assignment.repository.js";

export async function getPendingRequests() {
  const requests = await listPendingRequests();
  return { requests };
}

export async function getAvailableWorkersForRequest(requestId: number) {
  const request = await getRequestDetail(requestId);
  if (!request) {
    throw new NotFoundError("Request not found");
  }

  const workers = await listExpertiseWorkers(request.expertise_id);
  const conflicts = await findWorkerConflicts(
    workers.map((w) => w.workerId),
    request.start_date,
    request.end_date
  );

  const conflictMap = new Map<number, string[]>();
  for (const conflict of conflicts) {
    const items = conflictMap.get(conflict.workerId) ?? [];
    items.push(conflict.date);
    conflictMap.set(conflict.workerId, items);
  }

  return {
    requestId,
    workers: workers.map((worker) => {
      const conflictingDates = conflictMap.get(worker.workerId) ?? [];
      return {
        workerId: worker.workerId,
        name: worker.name,
        expertiseId: worker.expertiseId,
        fullyAvailable: conflictingDates.length === 0,
        conflictingDates
      };
    })
  };
}

export async function assignWorkers(requestId: number, workerIds: number[]) {
  if (workerIds.length === 0) {
    throw new ValidationError("workerIds cannot be empty");
  }

  const uniqueWorkerIds = Array.from(new Set(workerIds));

  const request = await getRequestDetail(requestId);
  if (!request) {
    throw new NotFoundError("Request not found");
  }

  const conflicts = await findWorkerConflicts(uniqueWorkerIds, request.start_date, request.end_date);
  if (conflicts.length > 0) {
    throw new ConflictError("One or more workers already assigned in the selected date range", conflicts);
  }

  try {
    const result = await assignWorkersToRequestTransactional(requestId, uniqueWorkerIds);
    return {
      requestId,
      status: "ASSIGNED",
      ...result
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "message" in error) {
      const message = String((error as { message: string }).message);
      if (message.includes("Duplicate entry") || message === "ER_DUP_ENTRY") {
        throw new ConflictError("Concurrent assignment conflict detected");
      }
      if (message === "REQUEST_NOT_FOUND") {
        throw new NotFoundError("Request not found");
      }
      if (message === "REQUEST_NOT_ASSIGNABLE") {
        throw new ValidationError("Request is not assignable in current state");
      }
      if (message === "WORKER_EXPERTISE_OR_STATUS_MISMATCH") {
        throw new ValidationError("Some workers are inactive or do not match request expertise");
      }
    }

    throw error;
  }
}
