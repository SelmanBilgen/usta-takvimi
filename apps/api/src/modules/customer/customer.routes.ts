import { NextFunction, Request, Response, Router } from "express";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { z } from "zod";

import { verifyAccessToken } from "../../shared/auth-token.js";
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from "../../shared/errors/app-error.js";
import { fallbackState, isDatabaseAvailable } from "../../shared/fallback-store.js";
import { dbPool } from "../../shared/db/pool.js";

interface CustomerRequestRow extends RowDataPacket {
  id: number;
  expertiseName: string;
  startDate: string;
  endDate: string;
  status: string;
  description: string | null;
  estimatedWorkerCount: number;
}
interface WorkReportRow extends RowDataPacket {
  requestId: number;
  assignmentId: number;
  date: string;
  workerName: string;
  status: "IN_PROGRESS" | "COMPLETED";
  workDescription: string;
  updatedAt: string | null;
}
interface ReviewRow extends RowDataPacket {
  requestId: number;
  rating: number;
  comment: string | null;
  createdAt: string;
}

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional().default("")
});

export const customerRouter = Router();

export function requireCustomerAuth(req: Request, _res: Response, next: NextFunction) {
  const authorization = req.headers.authorization;
  const identity = authorization?.startsWith("Bearer ")
    ? verifyAccessToken(authorization.slice("Bearer ".length).trim())
    : null;
  if (identity?.role !== "customer" || typeof identity.clientId !== "number") {
    return next(new UnauthorizedError("Customer authentication required"));
  }
  return next();
}

function customerIdentity(req: Request): { clientId: number } {
  const authorization = req.headers.authorization;
  const identity = authorization?.startsWith("Bearer ")
    ? verifyAccessToken(authorization.slice("Bearer ".length).trim())
    : null;
  if (identity?.role !== "customer" || typeof identity.clientId !== "number") throw new UnauthorizedError("Customer authentication required");
  return { clientId: identity.clientId as number };
}

customerRouter.get("/requests", async (req, res, next) => {
  try {
    const { clientId } = customerIdentity(req);
    if (!(await isDatabaseAvailable())) {
      const requests = fallbackState.requests.filter((request) => request.client_id === clientId).map((request) => {
        const expertise = fallbackState.expertises.find((item) => item.id === request.expertise_id);
        const assignments = fallbackState.assignments.filter((item) => item.request_id === request.id).map((assignment) => {
          const report = fallbackState.workUpdates.find((item) => item.assignment_id === assignment.id);
          const worker = fallbackState.workers.find((item) => item.id === assignment.worker_id);
          return {
            assignmentId: assignment.id,
            date: assignment.assignment_date,
            workerName: worker?.name ?? "",
            status: report?.status ?? "IN_PROGRESS",
            workDescription: report?.work_description ?? "",
            updatedAt: report?.updated_at ?? null
          };
        });
        const review = fallbackState.reviews.find((item) => item.request_id === request.id);
        return {
          id: request.id,
          expertiseName: expertise?.name ?? "",
          startDate: request.start_date,
          endDate: request.end_date,
          status: request.status,
          description: request.description ?? null,
          estimatedWorkerCount: request.estimated_worker_count,
          assignments,
          review: review ? { rating: review.rating, comment: review.comment, createdAt: review.created_at } : null
        };
      });
      return res.json({ requests });
    }

    const [requests] = await dbPool.query<CustomerRequestRow[]>(
      `SELECT r.id, e.name AS expertiseName,
              DATE_FORMAT(r.start_date, '%Y-%m-%d') AS startDate,
              DATE_FORMAT(r.end_date, '%Y-%m-%d') AS endDate,
              r.status, r.description, r.estimated_worker_count AS estimatedWorkerCount
       FROM requests r JOIN expertises e ON e.id = r.expertise_id
       WHERE r.client_id = ? ORDER BY r.created_at DESC`,
      [clientId]
    );
    if (!requests.length) return res.json({ requests: [] });
    const requestIds = requests.map((request) => request.id);
    const placeholders = requestIds.map(() => "?").join(",");
    const [reports] = await dbPool.query<WorkReportRow[]>(
      `SELECT a.request_id AS requestId, a.id AS assignmentId,
              DATE_FORMAT(a.assignment_date, '%Y-%m-%d') AS date, w.name AS workerName,
              COALESCE(u.status, 'IN_PROGRESS') AS status,
              COALESCE(u.work_description, '') AS workDescription,
              DATE_FORMAT(u.updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt
       FROM assignments a JOIN workers w ON w.id = a.worker_id
       LEFT JOIN assignment_work_updates u ON u.assignment_id = a.id
       WHERE a.request_id IN (${placeholders}) ORDER BY a.assignment_date, w.name`,
      requestIds
    );
    const [reviews] = await dbPool.query<ReviewRow[]>(
      `SELECT request_id AS requestId, rating, comment,
              DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
       FROM request_reviews WHERE request_id IN (${placeholders})`,
      requestIds
    );
    return res.json({
      requests: requests.map((request) => ({
        ...request,
        assignments: reports.filter((report) => report.requestId === request.id),
        review: reviews.find((review) => review.requestId === request.id) ?? null
      }))
    });
  } catch (error) {
    return next(error);
  }
});

customerRouter.post("/requests/:requestId/review", async (req, res, next) => {
  try {
    const { clientId } = customerIdentity(req);
    const requestId = z.coerce.number().int().positive().parse(req.params.requestId);
    const input = reviewSchema.parse(req.body);
    if (!(await isDatabaseAvailable())) {
      const request = fallbackState.requests.find((item) => item.id === requestId && item.client_id === clientId);
      if (!request) throw new NotFoundError("Request not found");
      const hasWorkReport = fallbackState.assignments.some((assignment) => assignment.request_id === requestId &&
        fallbackState.workUpdates.some((update) => update.assignment_id === assignment.id && update.work_description.trim().length > 0));
      if (!hasWorkReport) throw new ValidationError("A worker must add a work note before this request can be reviewed");
      if (fallbackState.reviews.some((item) => item.request_id === requestId)) throw new ConflictError("This request already has a review");
      fallbackState.reviews.push({
        request_id: requestId,
        client_id: clientId,
        rating: input.rating,
        comment: input.comment,
        created_at: new Date().toISOString()
      });
      return res.status(201).json({ requestId, rating: input.rating, comment: input.comment });
    }

    const [ownedRequests] = await dbPool.query<RowDataPacket[]>(
      `SELECT r.id, EXISTS(
         SELECT 1 FROM assignments a
         JOIN assignment_work_updates u ON u.assignment_id = a.id
         WHERE a.request_id = r.id AND CHAR_LENGTH(TRIM(u.work_description)) > 0
       ) AS hasWorkReport
       FROM requests r WHERE r.id = ? AND r.client_id = ? LIMIT 1`,
      [requestId, clientId]
    );
    if (!ownedRequests.length) throw new NotFoundError("Request not found");
    if (!Number(ownedRequests[0].hasWorkReport)) throw new ValidationError("A worker must add a work note before this request can be reviewed");
    try {
      await dbPool.execute<ResultSetHeader>(
        "INSERT INTO request_reviews (request_id, client_id, rating, comment) VALUES (?, ?, ?, ?)",
        [requestId, clientId, input.rating, input.comment || null]
      );
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ER_DUP_ENTRY") {
        throw new ConflictError("This request already has a review");
      }
      throw error;
    }
    return res.status(201).json({ requestId, rating: input.rating, comment: input.comment });
  } catch (error) {
    return next(error);
  }
});
