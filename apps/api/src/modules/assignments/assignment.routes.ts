import { Router } from "express";
import { z } from "zod";

import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors/app-error.js";
import {
  assignWorkers,
  assignWorkersByDate,
  getAvailableWorkersForRequest,
  getPendingRequests
} from "./assignment.service.js";
import { deleteAdminRequest, getRequestActivity, updateAdminRequest } from "./assignment.repository.js";

const idSchema = z.coerce.number().int().positive();

const assignBodySchema = z.object({
  workerIds: z.array(z.number().int().positive()).min(1)
});
const dailyAssignmentSchema = z.object({
  days: z.array(z.object({
    date: z.string().date(),
    workerIds: z.array(z.number().int().positive())
  }))
});
const updateRequestSchema = z.object({
  expertiseId: z.number().int().positive(),
  startDate: z.string().date(),
  endDate: z.string().date(),
  description: z.string().max(2000).optional(),
  estimatedWorkerCount: z.number().int().positive()
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

assignmentRouter.get("/:id/activity", async (req, res, next) => {
  try {
    const requestId = idSchema.parse(req.params.id);
    res.json(await getRequestActivity(requestId));
  } catch (error) {
    if (error && typeof error === "object" && "message" in error && error.message === "REQUEST_NOT_FOUND") {
      return next(new NotFoundError("Request not found"));
    }
    return next(error);
  }
});

assignmentRouter.put("/:id", async (req, res, next) => {
  try {
    const requestId = idSchema.parse(req.params.id);
    const body = updateRequestSchema.parse(req.body);
    if (body.endDate < body.startDate) throw new ValidationError("End date cannot be before start date");
    const result = await updateAdminRequest(requestId, body);
    res.json(result);
  } catch (error) {
    if (error && typeof error === "object" && "message" in error && error.message === "REQUEST_NOT_FOUND") {
      return next(new NotFoundError("Request not found"));
    }
    return next(error);
  }
});

assignmentRouter.delete("/:id", async (req, res, next) => {
  try {
    const requestId = idSchema.parse(req.params.id);
    await deleteAdminRequest(requestId);
    res.status(204).end();
  } catch (error) {
    if (error && typeof error === "object" && "message" in error && error.message === "REQUEST_NOT_FOUND") {
      return next(new NotFoundError("Request not found"));
    }
    return next(error);
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

assignmentRouter.put("/:id/assignments", async (req, res, next) => {
  try {
    const requestId = idSchema.parse(req.params.id);
    const body = dailyAssignmentSchema.parse(req.body);
    const result = await assignWorkersByDate(requestId, body.days);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
