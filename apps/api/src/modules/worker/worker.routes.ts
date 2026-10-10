import { NextFunction, Request, Response, Router } from "express";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { z } from "zod";

import { verifyAccessToken } from "../../shared/auth-token.js";
import { NotFoundError, UnauthorizedError, ValidationError } from "../../shared/errors/app-error.js";
import { createDateSpan, fallbackState, getNextAssignmentId, isDatabaseAvailable } from "../../shared/fallback-store.js";
import { dbPool } from "../../shared/db/pool.js";

const reportSchema = z.object({
  status: z.enum(["IN_PROGRESS", "COMPLETED"]),
  workDescription: z.string().trim().min(3).max(2000)
});

interface WorkerTaskRow extends RowDataPacket {
  assignmentId: number;
  requestId: number;
  date: string;
  expertiseName: string;
  clientName: string;
  requestDescription: string | null;
  estimatedWorkerCount: number;
  requestStatus: string;
  workStatus: "IN_PROGRESS" | "COMPLETED";
  workDescription: string;
  workUpdatedAt: string | null;
}

export const workerRouter = Router();

export function requireWorkerAuth(req: Request, _res: Response, next: NextFunction) {
  const authorization = req.headers.authorization;
  const identity = authorization?.startsWith("Bearer ")
    ? verifyAccessToken(authorization.slice("Bearer ".length).trim())
    : null;
  if (identity?.role !== "worker" || typeof identity.workerId !== "number") {
    return next(new UnauthorizedError("Worker authentication required"));
  }
  return next();
}

function workerIdentity(req: Request): { workerId: number } {
  const authorization = req.headers.authorization;
  const identity = authorization?.startsWith("Bearer ")
    ? verifyAccessToken(authorization.slice("Bearer ".length).trim())
    : null;
  if (identity?.role !== "worker" || typeof identity.workerId !== "number") throw new UnauthorizedError("Worker authentication required");
  return { workerId: identity.workerId as number };
}

workerRouter.get("/tasks", async (req, res, next) => {
  try {
    const { workerId } = workerIdentity(req);
    if (!(await isDatabaseAvailable())) {
      const tasks = fallbackState.assignments
        .filter((assignment) => assignment.worker_id === workerId)
        .map((assignment) => {
          const request = fallbackState.requests.find((item) => item.id === assignment.request_id);
          const worker = fallbackState.workers.find((item) => item.id === workerId);
          const update = fallbackState.workUpdates.find((item) => item.assignment_id === assignment.id);
          const client = request && fallbackState.clients.find((item) => item.id === request.client_id);
          const expertise = worker && fallbackState.expertises.find((item) => item.id === worker.expertise_id);
          return {
            assignmentId: assignment.id,
            requestId: assignment.request_id,
            date: assignment.assignment_date,
            expertiseName: expertise?.name ?? "",
            clientName: client?.company_or_name ?? "",
            requestDescription: request?.description ?? null,
            estimatedWorkerCount: request?.estimated_worker_count ?? 1,
            requestStatus: request?.status ?? "PENDING",
            workStatus: update?.status ?? "IN_PROGRESS",
            workDescription: update?.work_description ?? "",
            workUpdatedAt: update?.updated_at ?? null
          };
        })
        .sort((left, right) => left.date.localeCompare(right.date));
      return res.json({ tasks });
    }

    const [tasks] = await dbPool.query<WorkerTaskRow[]>(
      `SELECT a.id AS assignmentId, a.request_id AS requestId,
              DATE_FORMAT(a.assignment_date, '%Y-%m-%d') AS date,
              e.name AS expertiseName, c.company_or_name AS clientName,
              r.description AS requestDescription, r.estimated_worker_count AS estimatedWorkerCount,
              r.status AS requestStatus,
              COALESCE(u.status, 'IN_PROGRESS') AS workStatus,
              COALESCE(u.work_description, '') AS workDescription,
              DATE_FORMAT(u.updated_at, '%Y-%m-%d %H:%i:%s') AS workUpdatedAt
       FROM assignments a
       JOIN requests r ON r.id = a.request_id
       JOIN clients c ON c.id = r.client_id
       JOIN workers w ON w.id = a.worker_id
       JOIN expertises e ON e.id = r.expertise_id
       LEFT JOIN assignment_work_updates u ON u.assignment_id = a.id
       WHERE a.worker_id = ?
       ORDER BY a.assignment_date ASC, a.id ASC`,
      [workerId]
    );
    return res.json({ tasks });
  } catch (error) {
    return next(error);
  }
});

workerRouter.put("/tasks/:assignmentId", async (req, res, next) => {
  try {
    const { workerId } = workerIdentity(req);
    const assignmentId = z.coerce.number().int().positive().parse(req.params.assignmentId);
    const input = reportSchema.parse(req.body);

    if (!(await isDatabaseAvailable())) {
      const assignment = fallbackState.assignments.find((item) => item.id === assignmentId && item.worker_id === workerId);
      if (!assignment) throw new NotFoundError("Assigned task not found");
      const update = fallbackState.workUpdates.find((item) => item.assignment_id === assignmentId);
      const now = new Date().toISOString();
      if (update) Object.assign(update, {
        status: input.status,
        work_description: input.workDescription,
        updated_at: now,
        completed_at: input.status === "COMPLETED" ? now : null
      });
      else fallbackState.workUpdates.push({
        assignment_id: assignmentId,
        worker_id: workerId,
        status: input.status,
        work_description: input.workDescription,
        updated_at: now,
        completed_at: input.status === "COMPLETED" ? now : null
      });
      const request = fallbackState.requests.find((item) => item.id === assignment.request_id);
      if (request) {
        const requestAssignments = fallbackState.assignments.filter((item) => item.request_id === request.id);
        const allCompleted = requestAssignments.length > 0 && requestAssignments.every((item) =>
          fallbackState.workUpdates.find((report) => report.assignment_id === item.id)?.status === "COMPLETED"
        );
        request.status = allCompleted ? "COMPLETED" : "ASSIGNED";
      }
      return res.json({ assignmentId, status: input.status });
    }

    const connection = await dbPool.getConnection();
    let requestId = 0;
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT request_id AS requestId FROM assignments WHERE id = ? AND worker_id = ? FOR UPDATE",
        [assignmentId, workerId]
      );
      if (!rows.length) throw new NotFoundError("Assigned task not found");
      requestId = Number(rows[0].requestId);
      await connection.execute<ResultSetHeader>(
        `INSERT INTO assignment_work_updates (assignment_id, status, work_description, completed_at)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status), work_description = VALUES(work_description),
           completed_at = VALUES(completed_at)`,
        [assignmentId, input.status, input.workDescription, input.status === "COMPLETED" ? new Date() : null]
      );
      const [totals] = await connection.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN u.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed
         FROM assignments a LEFT JOIN assignment_work_updates u ON u.assignment_id = a.id
         WHERE a.request_id = ?`,
        [requestId]
      );
      const total = Number(totals[0].total);
      const completed = Number(totals[0].completed ?? 0);
      const requestStatus = total > 0 && completed === total ? "COMPLETED" : "ASSIGNED";
      await connection.execute("UPDATE requests SET status = ? WHERE id = ? AND status <> 'CANCELED'", [requestStatus, requestId]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return res.json({ assignmentId, status: input.status, requestId });
  } catch (error) {
    if (error instanceof z.ZodError) return next(new ValidationError("Invalid work report"));
    return next(error);
  }
});
