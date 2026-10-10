import { Router } from "express";
import { z } from "zod";

import { assignWorkers, getAvailableWorkersForRequest, getPendingRequests } from "./assignment.service.js";

const idSchema = z.coerce.number().int().positive();

const assignBodySchema = z.object({
  workerIds: z.array(z.number().int().positive()).min(1)
});

export const assignmentRouter = Router();

assignmentRouter.get("/", async (_req, res, next) => {
  try {
    const data = await getPendingRequests();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

assignmentRouter.get("/:id/available-workers", async (req, res, next) => {
  try {
    const requestId = idSchema.parse(req.params.id);
    const data = await getAvailableWorkersForRequest(requestId);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

assignmentRouter.post("/:id/assignments", async (req, res, next) => {
  try {
    const requestId = idSchema.parse(req.params.id);
    const body = assignBodySchema.parse(req.body);
    const result = await assignWorkers(requestId, body.workerIds);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
