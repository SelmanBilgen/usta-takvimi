import { Router } from "express";
import { z } from "zod";

import { getAvailability } from "./availability.service.js";

const querySchema = z.object({
  expertiseId: z.coerce.number().int().positive(),
  startDate: z.string().date(),
  endDate: z.string().date()
});

export const availabilityRouter = Router();

availabilityRouter.get("/", async (req, res, next) => {
  try {
    const { expertiseId, startDate, endDate } = querySchema.parse(req.query);
    const data = await getAvailability(expertiseId, startDate, endDate);
    res.json(data);
  } catch (error) {
    next(error);
  }
});
