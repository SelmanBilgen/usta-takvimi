import { Request, Router } from "express";
import { z } from "zod";

import { verifyAccessToken } from "../../shared/auth-token.js";
import { UnauthorizedError } from "../../shared/errors/app-error.js";
import { createNewRequest } from "./request.service.js";

const bodySchema = z.object({
  expertiseId: z.number().int().positive(),
  startDate: z.string().date(),
  endDate: z.string().date(),
  description: z.string().max(2000).optional(),
  estimatedWorkerCount: z.number().int().positive(),
  contact: z.object({
    name: z.string().trim().min(2).max(180),
    phone: z.string().trim().min(5).max(40),
    email: z.string().trim().email().max(254).optional().or(z.literal(""))
  }).optional()
});

export const requestRouter = Router();

function customerClientId(req: Request): number | undefined {
  const authorization = req.headers.authorization;
  if (!authorization) return undefined;
  if (!authorization.startsWith("Bearer ")) throw new UnauthorizedError("Invalid customer session");
  const identity = verifyAccessToken(authorization.slice("Bearer ".length).trim());
  if (!identity || identity.role !== "customer" || !identity.clientId) {
    throw new UnauthorizedError("Invalid customer session");
  }
  return identity.clientId;
}

requestRouter.post("/", async (req, res, next) => {
  try {
    const body = bodySchema.parse(req.body);
    const result = await createNewRequest({ ...body, clientId: customerClientId(req) });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});
