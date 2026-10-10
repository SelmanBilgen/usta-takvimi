import { ResultSetHeader } from "mysql2";

import { dbPool } from "../../shared/db/pool.js";
import { fallbackState, getNextRequestId, isDatabaseAvailable } from "../../shared/fallback-store.js";

interface CreateRequestInput {
  clientId?: number;
  expertiseId: number;
  startDate: string;
  endDate: string;
  description?: string;
  estimatedWorkerCount: number;
  contact?: { name: string; phone: string; email?: string };
}

export async function createRequest(input: CreateRequestInput): Promise<number> {
  if (!(await isDatabaseAvailable())) {
    let clientId = input.clientId;
    if (!clientId && input.contact) {
      clientId = Math.max(0, ...fallbackState.clients.map((client) => client.id)) + 1;
      fallbackState.clients.push({
        id: clientId,
        company_or_name: input.contact.name,
        contact_info: { phone: input.contact.phone, email: input.contact.email }
      });
    }
    const nextId = getNextRequestId();
    fallbackState.requests.push({
      id: nextId,
      client_id: clientId!,
      expertise_id: input.expertiseId,
      start_date: input.startDate,
      end_date: input.endDate,
      status: "PENDING",
      description: input.description ?? null,
      estimated_worker_count: input.estimatedWorkerCount
    });
    return nextId;
  }

  let clientId = input.clientId;
  if (!clientId && input.contact) {
    const [clientResult] = await dbPool.execute<ResultSetHeader>(
      "INSERT INTO clients (company_or_name, contact_info) VALUES (?, JSON_OBJECT('phone', ?, 'email', ?))",
      [input.contact.name, input.contact.phone, input.contact.email || null]
    );
    clientId = clientResult.insertId;
  }

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
      clientId!,
      input.expertiseId,
      input.startDate,
      input.endDate,
      input.description ?? null,
      input.estimatedWorkerCount
    ]
  );

  return result.insertId;
}
