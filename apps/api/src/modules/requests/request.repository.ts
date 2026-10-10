import { ResultSetHeader } from "mysql2";

import { dbPool } from "../../shared/db/pool.js";

interface CreateRequestInput {
  clientId: number;
  expertiseId: number;
  startDate: string;
  endDate: string;
  description?: string;
  estimatedWorkerCount: number;
}

export async function createRequest(input: CreateRequestInput): Promise<number> {
  const [result] = await dbPool.execute<ResultSetHeader>(
    `
    INSERT INTO requests (
      client_id,
      expertise_id,
      start_date,
      end_date,
      status,
      description,
      estimated_worker_count
    ) VALUES (?, ?, ?, ?, 'PENDING', ?, ?)
    `,
    [
      input.clientId,
      input.expertiseId,
      input.startDate,
      input.endDate,
      input.description ?? null,
      input.estimatedWorkerCount
    ]
  );

  return result.insertId;
}
