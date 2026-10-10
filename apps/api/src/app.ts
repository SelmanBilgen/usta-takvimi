import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

import { AppError } from "./shared/errors/app-error.js";
import { availabilityRouter } from "./modules/availability/availability.routes.js";
import { requestRouter } from "./modules/requests/request.routes.js";
import { assignmentRouter } from "./modules/assignments/assignment.routes.js";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/v1/availability", availabilityRouter);
app.use("/api/v1/requests", requestRouter);
app.use("/api/v1/admin/requests", assignmentRouter);

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

  return res.status(500).json({
    code: "INTERNAL_SERVER_ERROR",
    message: "Unexpected server error",
    correlationId
  });
});
