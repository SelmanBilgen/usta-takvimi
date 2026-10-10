import { ResultSetHeader, RowDataPacket } from "mysql2";

import { dbPool } from "../../shared/db/pool.js";
import { createDateSpan, fallbackState, getNextAssignmentId, isDatabaseAvailable } from "../../shared/fallback-store.js";

interface PendingRequestRow extends RowDataPacket {
  id: number;
  expertiseId: number;
  clientName: string;
  expertiseName: string;
  startDate: string;
  endDate: string;
  estimatedWorkerCount: number;
  status: string;
  description: string | null;
}

interface RequestDetailRow extends RowDataPacket {
  id: number;
  expertise_id: number;
  start_date: string;
  end_date: string;
  status: string;
}

interface WorkerRow extends RowDataPacket {
  workerId: number;
  name: string;
  expertiseId: number;
}

interface WorkerConflictRow extends RowDataPacket {
  workerId: number;
  date: string;
}

interface RequestAssignmentRow extends RowDataPacket {
  date: string;
  workerId: number;
  workerName: string;
}

interface WorkActivityRow extends RowDataPacket {
  assignmentId: number;
  date: string;
  workerName: string;
  status: "IN_PROGRESS" | "COMPLETED";
  workDescription: string;
  updatedAt: string | null;
}

export async function listPendingRequests() {
  if (!(await isDatabaseAvailable())) {
    return fallbackState.requests
      .map((request) => ({
        id: request.id,
        expertiseId: request.expertise_id,
        clientName: fallbackState.clients.find((client) => client.id === request.client_id)?.company_or_name ?? "Client",
        expertiseName: ["Boyaci", "Tesisatci", "Elektrikci"][request.expertise_id - 1] ?? "Uzmanlık",
        startDate: request.start_date,
        endDate: request.end_date,
        estimatedWorkerCount: request.estimated_worker_count,
        status: request.status,
        description: request.description ?? null
      }));
  }

  const [rows] = await dbPool.query<PendingRequestRow[]>(
    `
    SELECT
      r.id,
      r.expertise_id AS expertiseId,
      c.company_or_name AS clientName,
      e.name AS expertiseName,
      DATE_FORMAT(r.start_date, '%Y-%m-%d') AS startDate,
      DATE_FORMAT(r.end_date, '%Y-%m-%d') AS endDate,
      r.estimated_worker_count AS estimatedWorkerCount,
      r.status,
      r.description
    FROM requests r
    JOIN clients c ON c.id = r.client_id
    JOIN expertises e ON e.id = r.expertise_id
    ORDER BY r.created_at ASC
    `
  );

  return rows;
}

export async function updateAdminRequest(
  requestId: number,
  input: { expertiseId: number; startDate: string; endDate: string; description?: string; estimatedWorkerCount: number }
) {
  if (!(await isDatabaseAvailable())) {
    const request = fallbackState.requests.find((item) => item.id === requestId);
    if (!request) throw new Error("REQUEST_NOT_FOUND");
    const scheduleChanged = request.expertise_id !== input.expertiseId || request.start_date !== input.startDate || request.end_date !== input.endDate;
    if (scheduleChanged) {
      fallbackState.assignments = fallbackState.assignments.filter((item) => item.request_id !== requestId);
      request.status = "PENDING";
    }
    Object.assign(request, {
      expertise_id: input.expertiseId,
      start_date: input.startDate,
      end_date: input.endDate,
      description: input.description ?? null,
      estimated_worker_count: input.estimatedWorkerCount
    });
    return { requestId, assignmentsReset: scheduleChanged };
  }

  const connection = await dbPool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<RequestDetailRow[]>(
      "SELECT id, expertise_id, DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date, DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date, status FROM requests WHERE id = ? FOR UPDATE",
      [requestId]
    );
    if (rows.length === 0) throw new Error("REQUEST_NOT_FOUND");
    const current = rows[0];
    const assignmentsReset = current.expertise_id !== input.expertiseId || current.start_date !== input.startDate || current.end_date !== input.endDate;
    if (assignmentsReset) {
      await connection.execute("DELETE FROM assignments WHERE request_id = ?", [requestId]);
    }
    await connection.execute(
      `UPDATE requests
       SET expertise_id = ?, start_date = ?, end_date = ?, description = ?, estimated_worker_count = ?,
           status = ?
       WHERE id = ?`,
      [input.expertiseId, input.startDate, input.endDate, input.description ?? null, input.estimatedWorkerCount,
        assignmentsReset ? "PENDING" : current.status, requestId]
    );
    await connection.commit();
    return { requestId, assignmentsReset };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteAdminRequest(requestId: number) {
  if (!(await isDatabaseAvailable())) {
    const index = fallbackState.requests.findIndex((item) => item.id === requestId);
    if (index === -1) throw new Error("REQUEST_NOT_FOUND");
    fallbackState.requests.splice(index, 1);
    fallbackState.assignments = fallbackState.assignments.filter((item) => item.request_id !== requestId);
    return;
  }
  const [result] = await dbPool.execute<ResultSetHeader>("DELETE FROM requests WHERE id = ?", [requestId]);
  if (result.affectedRows === 0) throw new Error("REQUEST_NOT_FOUND");
}

export async function getRequestDetail(requestId: number): Promise<RequestDetailRow | null> {
  if (!(await isDatabaseAvailable())) {
    const request = fallbackState.requests.find((item) => item.id === requestId) ?? null;
    if (!request) {
      return null;
    }
    return {
      id: request.id,
      expertise_id: request.expertise_id,
      start_date: request.start_date,
      end_date: request.end_date,
      status: request.status
    } as RequestDetailRow;
  }

  const [rows] = await dbPool.query<RequestDetailRow[]>(
    `
    SELECT id, expertise_id, DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
           DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date, status
    FROM requests
    WHERE id = ?
    LIMIT 1
    `,
    [requestId]
  );

  return rows.length ? rows[0] : null;
}

export async function listExpertiseWorkers(expertiseId: number): Promise<WorkerRow[]> {
  if (!(await isDatabaseAvailable())) {
    return fallbackState.workers
      .filter((worker) => worker.expertise_id === expertiseId && worker.daily_status === "ACTIVE")
      .map((worker) => ({
        workerId: worker.id,
        name: worker.name,
        expertiseId: worker.expertise_id
      })) as unknown as WorkerRow[];
  }

  const [rows] = await dbPool.query<WorkerRow[]>(
    `
    SELECT id AS workerId, name, expertise_id AS expertiseId
    FROM workers
    WHERE expertise_id = ?
      AND daily_status = 'ACTIVE'
    ORDER BY name ASC
    `,
    [expertiseId]
  );

  return rows;
}

export async function findWorkerConflicts(workerIds: number[], startDate: string, endDate: string, excludeRequestId?: number): Promise<WorkerConflictRow[]> {
  if (workerIds.length === 0) {
    return [];
  }

  if (!(await isDatabaseAvailable())) {
    const dates = createDateSpan(startDate, endDate);
    return fallbackState.assignments
      .filter((assignment) => workerIds.includes(assignment.worker_id))
      .filter((assignment) => dates.includes(assignment.assignment_date))
      .filter((assignment) => assignment.request_id !== excludeRequestId)
      .map((assignment) => ({
        workerId: assignment.worker_id,
        date: assignment.assignment_date
      })) as unknown as WorkerConflictRow[];
  }

  const placeholders = workerIds.map(() => "?").join(",");
  const [rows] = await dbPool.query<WorkerConflictRow[]>(
    `
    SELECT a.worker_id AS workerId, DATE_FORMAT(a.assignment_date, '%Y-%m-%d') AS date
    FROM assignments a
    WHERE a.worker_id IN (${placeholders})
      AND a.assignment_date BETWEEN ? AND ?
      AND (? IS NULL OR a.request_id <> ?)
    ORDER BY a.worker_id, a.assignment_date
    `,
    [...workerIds, startDate, endDate, excludeRequestId ?? null, excludeRequestId ?? null]
  );

  return rows;
}

export async function listRequestAssignments(requestId: number): Promise<RequestAssignmentRow[]> {
  if (!(await isDatabaseAvailable())) {
    return fallbackState.assignments
      .filter((assignment) => assignment.request_id === requestId)
      .map((assignment) => ({
        date: assignment.assignment_date,
        workerId: assignment.worker_id,
        workerName: fallbackState.workers.find((worker) => worker.id === assignment.worker_id)?.name ?? ""
      })) as unknown as RequestAssignmentRow[];
  }
  const [rows] = await dbPool.query<RequestAssignmentRow[]>(
    `SELECT DATE_FORMAT(a.assignment_date, '%Y-%m-%d') AS date, w.id AS workerId, w.name AS workerName
     FROM assignments a JOIN workers w ON w.id = a.worker_id
     WHERE a.request_id = ? ORDER BY a.assignment_date, w.name`,
    [requestId]
  );
  return rows;
}

export async function getRequestActivity(requestId: number) {
  if (!(await isDatabaseAvailable())) {
    const request = fallbackState.requests.find((item) => item.id === requestId);
    if (!request) throw new Error("REQUEST_NOT_FOUND");
    const workUpdates = fallbackState.assignments
      .filter((assignment) => assignment.request_id === requestId)
      .map((assignment) => {
        const report = fallbackState.workUpdates.find((item) => item.assignment_id === assignment.id);
        return {
          assignmentId: assignment.id,
          date: assignment.assignment_date,
          workerName: fallbackState.workers.find((worker) => worker.id === assignment.worker_id)?.name ?? "",
          status: report?.status ?? "IN_PROGRESS",
          workDescription: report?.work_description ?? "",
          updatedAt: report?.updated_at ?? null
        };
      });
    const review = fallbackState.reviews.find((item) => item.request_id === requestId);
    return {
      requestId,
      workUpdates,
      review: review ? { rating: review.rating, comment: review.comment, createdAt: review.created_at } : null
    };
  }

  const [requestRows] = await dbPool.query<RowDataPacket[]>("SELECT id FROM requests WHERE id = ? LIMIT 1", [requestId]);
  if (!requestRows.length) throw new Error("REQUEST_NOT_FOUND");
  const [workUpdates] = await dbPool.query<WorkActivityRow[]>(
    `SELECT a.id AS assignmentId, DATE_FORMAT(a.assignment_date, '%Y-%m-%d') AS date,
            w.name AS workerName, COALESCE(u.status, 'IN_PROGRESS') AS status,
            COALESCE(u.work_description, '') AS workDescription,
            DATE_FORMAT(u.updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt
     FROM assignments a JOIN workers w ON w.id = a.worker_id
     LEFT JOIN assignment_work_updates u ON u.assignment_id = a.id
     WHERE a.request_id = ? ORDER BY a.assignment_date, w.name`,
    [requestId]
  );
  const [reviews] = await dbPool.query<RowDataPacket[]>(
    `SELECT rating, comment, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
     FROM request_reviews WHERE request_id = ? LIMIT 1`,
    [requestId]
  );
  return { requestId, workUpdates, review: reviews[0] ?? null };
}

export async function assignWorkersByDateTransactional(
  requestId: number,
  dailyAssignments: Array<{ date: string; workerIds: number[] }>
) {
  if (!(await isDatabaseAvailable())) {
    const request = fallbackState.requests.find((item) => item.id === requestId);
    if (!request) throw new Error("REQUEST_NOT_FOUND");
    if (request.status === "CANCELED" || request.status === "COMPLETED") throw new Error("REQUEST_NOT_ASSIGNABLE");
    const requestDates = new Set(createDateSpan(request.start_date, request.end_date));
    const selectedRows = dailyAssignments.flatMap((daily) => {
      if (!requestDates.has(daily.date) || new Set(daily.workerIds).size !== daily.workerIds.length) {
        throw new Error("INVALID_DAILY_ASSIGNMENT");
      }
      return daily.workerIds.map((workerId) => ({ date: daily.date, workerId }));
    });
    const workerIds = Array.from(new Set(selectedRows.map((row) => row.workerId)));
    const invalidWorkers = workerIds.filter((workerId) => !fallbackState.workers.some(
      (worker) => worker.id === workerId && worker.expertise_id === request.expertise_id && worker.daily_status === "ACTIVE"
    ));
    if (invalidWorkers.length) throw new Error("WORKER_EXPERTISE_OR_STATUS_MISMATCH");
    if (selectedRows.some((row) => fallbackState.assignments.some((assignment) =>
      assignment.request_id !== requestId && assignment.worker_id === row.workerId && assignment.assignment_date === row.date
    ))) throw new Error("DUPLICATE_ASSIGNMENT");

    fallbackState.assignments = fallbackState.assignments.filter((item) => item.request_id !== requestId);
    for (const row of selectedRows) {
      fallbackState.assignments.push({
        id: getNextAssignmentId(), request_id: requestId, worker_id: row.workerId, assignment_date: row.date
      });
    }
    const daysWithAssignments = new Set(selectedRows.map((row) => row.date));
    request.status = requestDates.size > 0 && Array.from(requestDates).every((date) => daysWithAssignments.has(date)) ? "ASSIGNED" : "PENDING";
    return {
      assignedWorkerCount: workerIds.length,
      assignedDatesCount: daysWithAssignments.size,
      totalAssignments: selectedRows.length
    };
  }

  const connection = await dbPool.getConnection();
  try {
    await connection.beginTransaction();
    const [requestRows] = await connection.query<RequestDetailRow[]>(
      `SELECT id, expertise_id, DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
              DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date, status
       FROM requests WHERE id = ? FOR UPDATE`, [requestId]
    );
    if (!requestRows.length) throw new Error("REQUEST_NOT_FOUND");
    const request = requestRows[0];
    if (request.status === "CANCELED" || request.status === "COMPLETED") throw new Error("REQUEST_NOT_ASSIGNABLE");
    const validDates = new Set(createDateSpan(request.start_date, request.end_date));
    const selectedRows = dailyAssignments.flatMap((daily) => {
      if (!validDates.has(daily.date) || new Set(daily.workerIds).size !== daily.workerIds.length) {
        throw new Error("INVALID_DAILY_ASSIGNMENT");
      }
      return daily.workerIds.map((workerId) => ({ date: daily.date, workerId }));
    });
    const workerIds = Array.from(new Set(selectedRows.map((row) => row.workerId)));
    if (workerIds.length) {
      const placeholders = workerIds.map(() => "?").join(",");
      const [workers] = await connection.query<RowDataPacket[]>(
        `SELECT id FROM workers WHERE id IN (${placeholders}) AND expertise_id = ? AND daily_status = 'ACTIVE'`,
        [...workerIds, request.expertise_id]
      );
      if (workers.length !== workerIds.length) throw new Error("WORKER_EXPERTISE_OR_STATUS_MISMATCH");
      for (const row of selectedRows) {
        const [conflicts] = await connection.query<RowDataPacket[]>(
          "SELECT id FROM assignments WHERE worker_id = ? AND assignment_date = ? AND request_id <> ? LIMIT 1",
          [row.workerId, row.date, requestId]
        );
        if (conflicts.length) throw new Error("DUPLICATE_ASSIGNMENT");
      }
    }
    await connection.execute("DELETE FROM assignments WHERE request_id = ?", [requestId]);
    if (selectedRows.length) {
      const placeholders = selectedRows.map(() => "(?, ?, ?)").join(",");
      const values = selectedRows.flatMap((row) => [requestId, row.workerId, row.date]);
      await connection.query(`INSERT INTO assignments (request_id, worker_id, assignment_date) VALUES ${placeholders}`, values);
    }
    const daysWithAssignments = new Set(selectedRows.map((row) => row.date));
    const fullyAssigned = validDates.size > 0 && Array.from(validDates).every((date) => daysWithAssignments.has(date));
    await connection.execute("UPDATE requests SET status = ? WHERE id = ?", [fullyAssigned ? "ASSIGNED" : "PENDING", requestId]);
    await connection.commit();
    return { assignedWorkerCount: workerIds.length, assignedDatesCount: daysWithAssignments.size, totalAssignments: selectedRows.length };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function assignWorkersToRequestTransactional(requestId: number, workerIds: number[]) {
  if (!(await isDatabaseAvailable())) {
    const request = fallbackState.requests.find((item) => item.id === requestId);
    if (!request) {
      throw new Error("REQUEST_NOT_FOUND");
    }
    if (request.status === "CANCELED" || request.status === "COMPLETED") {
      throw new Error("REQUEST_NOT_ASSIGNABLE");
    }

    const unmatched = workerIds.filter(
      (workerId) => !fallbackState.workers.some((worker) => worker.id === workerId && worker.expertise_id === request.expertise_id && worker.daily_status === "ACTIVE")
    );
    if (unmatched.length > 0) {
      throw new Error("WORKER_EXPERTISE_OR_STATUS_MISMATCH");
    }

    const dates = createDateSpan(request.start_date, request.end_date);
    for (const workerId of workerIds) {
      for (const date of dates) {
        if (fallbackState.assignments.some((assignment) => assignment.worker_id === workerId && assignment.assignment_date === date)) {
          throw new Error("DUPLICATE_ASSIGNMENT");
        }
      }
    }

    for (const workerId of workerIds) {
      for (const date of dates) {
        fallbackState.assignments.push({
          id: getNextAssignmentId(),
          request_id: requestId,
          worker_id: workerId,
          assignment_date: date
        });
      }
    }

    const requestIndex = fallbackState.requests.findIndex((item) => item.id === requestId);
    fallbackState.requests[requestIndex].status = "ASSIGNED";

    return {
      assignedWorkerCount: workerIds.length,
      assignedDatesCount: dates.length
    };
  }

  const conn = await dbPool.getConnection();

  try {
    await conn.beginTransaction();

    const [requestRows] = await conn.query<RequestDetailRow[]>(
      `
      SELECT id, expertise_id, DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
             DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date, status
      FROM requests
      WHERE id = ?
      FOR UPDATE
      `,
      [requestId]
    );

    if (requestRows.length === 0) {
      throw new Error("REQUEST_NOT_FOUND");
    }

    const request = requestRows[0];

    if (request.status === "CANCELED" || request.status === "COMPLETED") {
      throw new Error("REQUEST_NOT_ASSIGNABLE");
    }

    const dates = createDateSpan(request.start_date, request.end_date);

    const [workers] = await conn.query<RowDataPacket[]>(
      `
      SELECT id
      FROM workers
      WHERE id IN (${workerIds.map(() => "?").join(",")})
        AND expertise_id = ?
        AND daily_status = 'ACTIVE'
      `,
      [...workerIds, request.expertise_id]
    );

    if (workers.length !== workerIds.length) {
      throw new Error("WORKER_EXPERTISE_OR_STATUS_MISMATCH");
    }

    const values: Array<[number, number, string]> = [];
    for (const workerId of workerIds) {
      for (const date of dates) {
        values.push([requestId, workerId, date]);
      }
    }

    const placeholders = values.map(() => "(?, ?, ?)").join(",");
    const flattened = values.flatMap((v) => v);

    await conn.query(
      `
      INSERT INTO assignments (request_id, worker_id, assignment_date)
      VALUES ${placeholders}
      `,
      flattened
    );

    await conn.execute<ResultSetHeader>(
      `
      UPDATE requests
      SET status = 'ASSIGNED'
      WHERE id = ?
      `,
      [requestId]
    );

    await conn.commit();

    return {
      assignedWorkerCount: workerIds.length,
      assignedDatesCount: dates.length
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
