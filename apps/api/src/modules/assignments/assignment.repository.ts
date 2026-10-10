import { ResultSetHeader, RowDataPacket } from "mysql2";

import { dbPool } from "../../shared/db/pool.js";

interface PendingRequestRow extends RowDataPacket {
  id: number;
  clientName: string;
  expertiseName: string;
  startDate: string;
  endDate: string;
  estimatedWorkerCount: number;
  status: string;
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

export async function listPendingRequests() {
  const [rows] = await dbPool.query<PendingRequestRow[]>(
    `
    SELECT
      r.id,
      c.company_or_name AS clientName,
      e.name AS expertiseName,
      DATE_FORMAT(r.start_date, '%Y-%m-%d') AS startDate,
      DATE_FORMAT(r.end_date, '%Y-%m-%d') AS endDate,
      r.estimated_worker_count AS estimatedWorkerCount,
      r.status
    FROM requests r
    JOIN clients c ON c.id = r.client_id
    JOIN expertises e ON e.id = r.expertise_id
    WHERE r.status = 'PENDING'
    ORDER BY r.created_at ASC
    `
  );

  return rows;
}

export async function getRequestDetail(requestId: number): Promise<RequestDetailRow | null> {
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

export async function findWorkerConflicts(workerIds: number[], startDate: string, endDate: string): Promise<WorkerConflictRow[]> {
  if (workerIds.length === 0) {
    return [];
  }

  const placeholders = workerIds.map(() => "?").join(",");
  const [rows] = await dbPool.query<WorkerConflictRow[]>(
    `
    SELECT a.worker_id AS workerId, DATE_FORMAT(a.assignment_date, '%Y-%m-%d') AS date
    FROM assignments a
    WHERE a.worker_id IN (${placeholders})
      AND a.assignment_date BETWEEN ? AND ?
    ORDER BY a.worker_id, a.assignment_date
    `,
    [...workerIds, startDate, endDate]
  );

  return rows;
}

function createDateSpan(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  for (let cursor = start; cursor <= end; cursor = new Date(cursor.getTime() + 86400000)) {
    dates.push(cursor.toISOString().slice(0, 10));
  }

  return dates;
}

export async function assignWorkersToRequestTransactional(requestId: number, workerIds: number[]) {
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
