import { Router } from "express";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { z } from "zod";

import { dbPool } from "../../shared/db/pool.js";
import { createAccessToken, hashPassword, verifyPassword } from "../../shared/auth-token.js";
import { ConflictError, UnauthorizedError } from "../../shared/errors/app-error.js";
import { fallbackState } from "../../shared/fallback-store.js";
import { isProduction } from "../../shared/config.js";

const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(254),
  password: z.string().min(4).max(200)
});

const registerSchema = z.object({
  name: z.string().trim().min(2).max(180),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(5).max(40),
  password: z.string().min(8).max(200)
});

interface AccountRow extends RowDataPacket {
  clientId: number;
  email: string;
  passwordHash: string;
  displayName: string;
}

interface WorkerAccountRow extends RowDataPacket {
  workerId: number;
  email: string;
  passwordHash: string;
  displayName: string;
}

export const authRouter = Router();

authRouter.post("/login", async (req, res, next) => {
  try {
    const { identifier, password } = loginSchema.parse(req.body);
    const adminUsername = process.env.ADMIN_USERNAME ?? "admin";
    if (identifier === adminUsername && password === (process.env.ADMIN_PASSWORD ?? "admin123")) {
      return res.json({
        token: createAccessToken({ role: "admin", subject: adminUsername }),
        role: "admin",
        username: adminUsername
      });
    }

    let account: { clientId: number; email: string; passwordHash: string; displayName: string } | undefined;
    try {
      const [rows] = await dbPool.query<AccountRow[]>(
        `SELECT a.client_id AS clientId, a.email, a.password_hash AS passwordHash, c.company_or_name AS displayName
         FROM customer_accounts a JOIN clients c ON c.id = a.client_id WHERE a.email = ? LIMIT 1`,
        [identifier.toLowerCase()]
      );
      account = rows[0];
    } catch (error) {
      if (isProduction) throw error;
      const fallbackAccount = fallbackState.accounts.find((item) => item.email === identifier.toLowerCase());
      account = fallbackAccount
        ? {
          clientId: fallbackAccount.client_id,
          email: fallbackAccount.email,
          passwordHash: fallbackAccount.password_hash,
          displayName: fallbackState.clients.find((client) => client.id === fallbackAccount.client_id)?.company_or_name ?? fallbackAccount.email
        }
        : undefined;
    }

    if (account && await verifyPassword(password, account.passwordHash)) {
      return res.json({
        token: createAccessToken({ role: "customer", subject: account.email, clientId: account.clientId }),
        role: "customer",
        email: account.email,
        displayName: account.displayName
      });
    }

    let workerAccount: WorkerAccountRow | undefined;
    try {
      const [rows] = await dbPool.query<WorkerAccountRow[]>(
        `SELECT wa.worker_id AS workerId, wa.email, wa.password_hash AS passwordHash, w.name AS displayName
         FROM worker_accounts wa JOIN workers w ON w.id = wa.worker_id
         WHERE wa.email = ? AND w.daily_status = 'ACTIVE' LIMIT 1`,
        [identifier.toLowerCase()]
      );
      workerAccount = rows[0];
    } catch (error) {
      if (isProduction) throw error;
      const fallbackAccount = fallbackState.workerAccounts.find((item) => item.email === identifier.toLowerCase());
      const worker = fallbackAccount && fallbackState.workers.find((item) => item.id === fallbackAccount.worker_id && item.daily_status === "ACTIVE");
      if (fallbackAccount && worker) {
        workerAccount = {
          workerId: worker.id,
          email: fallbackAccount.email,
          passwordHash: fallbackAccount.password_hash,
          displayName: worker.name
        } as WorkerAccountRow;
      }
    }

    if (!workerAccount || !(await verifyPassword(password, workerAccount.passwordHash))) {
      throw new UnauthorizedError("E-posta veya şifre hatalı");
    }

    return res.json({
      token: createAccessToken({ role: "worker", subject: workerAccount.email, workerId: workerAccount.workerId }),
      role: "worker",
      email: workerAccount.email,
      displayName: workerAccount.displayName
    });
  } catch (error) {
    return next(error);
  }
});

authRouter.post("/register", async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const email = input.email.toLowerCase();
    const passwordHash = await hashPassword(input.password);
    let clientId = 0;

    try {
      const connection = await dbPool.getConnection();
      try {
        await connection.beginTransaction();
        const [clientResult] = await connection.execute<ResultSetHeader>(
          "INSERT INTO clients (company_or_name, contact_info) VALUES (?, JSON_OBJECT('phone', ?, 'email', ?))",
          [input.name, input.phone, email]
        );
        clientId = clientResult.insertId;
        await connection.execute<ResultSetHeader>(
          "INSERT INTO customer_accounts (client_id, email, password_hash) VALUES (?, ?, ?)",
          [clientId, email, passwordHash]
        );
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        if (error && typeof error === "object" && "code" in error && error.code === "ER_DUP_ENTRY") {
          throw new ConflictError("Bu e-posta adresiyle bir hesap zaten var");
        }
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      if (error instanceof ConflictError) throw error;
      if (!(error && typeof error === "object" && "code" in error && ["ECONNREFUSED", "ER_BAD_DB_ERROR", "ER_NO_SUCH_TABLE"].includes(String(error.code)))) {
        throw error;
      }
      if (isProduction) throw error;
      if (fallbackState.accounts.some((item) => item.email === email)) {
        throw new ConflictError("Bu e-posta adresiyle bir hesap zaten var");
      }
      clientId = Math.max(0, ...fallbackState.clients.map((item) => item.id)) + 1;
      fallbackState.clients.push({
        id: clientId,
        company_or_name: input.name,
        contact_info: { phone: input.phone, email }
      });
      fallbackState.accounts.push({
        id: Math.max(0, ...fallbackState.accounts.map((item) => item.id)) + 1,
        client_id: clientId,
        email,
        password_hash: passwordHash
      });
    }

    return res.status(201).json({
      token: createAccessToken({ role: "customer", subject: email, clientId }),
      role: "customer",
      email,
      displayName: input.name
    });
  } catch (error) {
    return next(error);
  }
});