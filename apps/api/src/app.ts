import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

import { AppError } from "./shared/errors/app-error.js";
import { availabilityRouter } from "./modules/availability/availability.routes.js";
import { requestRouter } from "./modules/requests/request.routes.js";
import { assignmentRouter } from "./modules/assignments/assignment.routes.js";
import { expertiseRouter } from "./modules/expertises/expertise.routes.js";
import { managementRouter, uploadDirectory } from "./modules/admin/management.routes.js";
import { adminRouter, requireAdminAuth } from "./modules/admin/admin.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { siteImagesRouter } from "./modules/site-images/site-images.routes.js";
import { customerRouter, requireCustomerAuth } from "./modules/customer/customer.routes.js";
import { requireWorkerAuth, workerRouter } from "./modules/worker/worker.routes.js";
import { dbPool } from "./shared/db/pool.js";
import { allowedCorsOrigins } from "./shared/config.js";

export const app = express();

const corsOrigins = allowedCorsOrigins();

app.set("trust proxy", true);
app.use(cors(corsOrigins.length > 0 ? { origin: corsOrigins } : undefined));
app.use(express.json());
app.use("/uploads", express.static(uploadDirectory, { maxAge: "7d", fallthrough: true }));

app.get("/health", async (_req, res) => {
  try {
    await dbPool.query("SELECT 1");
    res.json({ ok: true, database: "connected" });
  } catch (error) {
    res.status(503).json({
      ok: false,
      database: "disconnected",
      message: "MySQL is not available. Start the database and import schema.sql before using request flows."
    });
  }
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/site-images", siteImagesRouter);
app.use("/api/v1/customer", requireCustomerAuth, customerRouter);
app.use("/api/v1/worker", requireWorkerAuth, workerRouter);
app.use("/api/v1/expertises", expertiseRouter);
app.use("/api/v1/availability", availabilityRouter);
app.use("/api/v1/requests", requestRouter);
app.use("/api/v1/admin", requireAdminAuth, adminRouter);
app.use("/api/v1/admin/manage", requireAdminAuth, managementRouter);
app.use("/api/v1/admin/requests", requireAdminAuth, assignmentRouter);

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const correlationId = randomUUID();

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      code: error.code,
      message: error.message,
      details: error.details,
      correlationId
    });
  }

  const dbErrorCode = error && typeof error === "object" && "code" in error ? String((error as { code?: string }).code) : "";
  const isDbError = ["ECONNREFUSED", "ER_BAD_DB_ERROR", "ER_ACCESS_DENIED_ERROR", "ENOTFOUND", "ETIMEDOUT", "PROTOCOL_CONNECTION_LOST", "ER_NO_SUCH_TABLE"].includes(dbErrorCode);

  if (isDbError) {
    return res.status(503).json({
      code: "SERVICE_UNAVAILABLE",
      message: "MySQL is not available. Start the database and run the schema/seed scripts before using the request workflow.",
      correlationId
    });
  }

  return res.status(500).json({
    code: "INTERNAL_SERVER_ERROR",
    message: "Unexpected server error",
    correlationId
  });
});
