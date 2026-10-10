import { NextFunction, Request, Response, Router } from "express";

import { createAccessToken, verifyAccessToken } from "../../shared/auth-token.js";
import { UnauthorizedError } from "../../shared/errors/app-error.js";

export const adminRouter = Router();

export function requireAdminAuth(req: Request, _res: Response, next: NextFunction) {
  if (req.path === "/login") {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new UnauthorizedError("Admin authentication required"));
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const identity = verifyAccessToken(token);
  if (identity?.role !== "admin") {
    return next(new UnauthorizedError("Invalid admin token"));
  }

  return next();
}

adminRouter.post("/login", (req, res, next) => {
  const { username, password } = req.body ?? {};
  const expectedUsername = process.env.ADMIN_USERNAME ?? "admin";
  const expectedPassword = process.env.ADMIN_PASSWORD ?? "admin123";
  if (username !== expectedUsername || password !== expectedPassword) {
    return next(new UnauthorizedError("Invalid admin credentials"));
  }
  return res.json({
    token: createAccessToken({ role: "admin", subject: expectedUsername }),
    username: expectedUsername,
    role: "admin"
  });
});
