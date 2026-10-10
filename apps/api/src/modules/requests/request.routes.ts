import { Router } from "express";
import { z } from "zod";

import { createNewRequest } from "./request.service.js";

const bodySchema = z.object({
  clientId: z.number().int().positive(),
  expertiseId: z.number().int().positive(),
  startDate: z.string().date(),
  endDate: z.string().date(),
  description: z.string().max(2000).optional(),
  estimatedWorkerCount: z.number().int().positive()
});

export const requestRouter = Router();

requestRouter.post("/", async (req, res, next) => {
  try {
    const body = bodySchema.parse(req.body);
    const result = await createNewRequest(body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});
