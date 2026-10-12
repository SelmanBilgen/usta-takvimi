import { Router } from "express";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { z } from "zod";
import multer from "multer";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

import { dbPool } from "../../shared/db/pool.js";
import { hashPassword } from "../../shared/auth-token.js";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors/app-error.js";
import { fallbackState, isDatabaseAvailable } from "../../shared/fallback-store.js";

const idSchema = z.coerce.number().int().positive();
const imageReferenceSchema = z.union([
  z.string().trim().url().max(1000),
  z.string().trim().regex(/^\/uploads\/[a-zA-Z0-9_-]+\.(?:jpg|png|webp)$/)
]).optional().or(z.literal(""));
const workerSchema = z.object({
  name: z.string().trim().min(2).max(150),
  expertiseId: z.number().int().positive(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  phone: z.string().trim().max(40).optional().default(""),
  email: z.string().trim().email().max(254).optional().or(z.literal("")),
  bio: z.string().trim().max(2000).optional().default(""),
  imageUrl: imageReferenceSchema,
  loginPassword: z.string().min(8).max(200).optional().or(z.literal(""))
});
const expertiseSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(2000).optional().default(""),
  imageUrl: imageReferenceSchema
});
const scheduleQuerySchema = z.object({
  startDate: z.string().date(),
  endDate: z.string().date(),
  expertiseId: z.coerce.number().int().positive().optional(),
  workerId: z.coerce.number().int().positive().optional()
});

interface WorkerRow extends RowDataPacket {
  id: number;
  name: string;
  expertiseId: number;
  expertiseName: string;
  status: "ACTIVE" | "INACTIVE";
  phone: string | null;
  email: string | null;
  bio: string | null;
  imageUrl: string | null;
}

interface ScheduleRow extends RowDataPacket {
  id: number;
  requestId: number;
  date: string;
  workerId: number;
  workerName: string;
  expertiseId: number;
  expertiseName: string;
  clientName: string;
  status: string;
}

export const managementRouter = Router();

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    callback(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype));
  }
});
const imageKeySchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/);
export const uploadDirectory = resolve(process.env.UPLOAD_DIR ?? resolve(process.cwd(), "uploads"));
const publicApiUrl = (process.env.PUBLIC_API_URL ?? "").replace(/\/+$/, "");
const uploadedFileUrlPattern = /\/uploads\/([a-zA-Z0-9_-]+\.(?:jpg|png|webp))(?:\?.*)?$/;

managementRouter.put("/site-images/:key", imageUpload.single("image"), async (req, res, next) => {
  let imagePath = "";
  try {
    const imageKey = imageKeySchema.parse(req.params.key);
    const image = req.file;
    if (!image) throw new ValidationError("Select a JPEG, PNG, or WebP image up to 8 MB");
    const expertiseMatch = /^expertise-(\d+)$/.exec(imageKey);
    const workerMatch = /^worker-(\d+)$/.exec(imageKey);
    const extension = image.mimetype === "image/jpeg" ? ".jpg" : image.mimetype === "image/png" ? ".png" : ".webp";
    const filename = `site-${imageKey}-${Date.now()}${extension}`;
    const databaseAvailable = await isDatabaseAvailable();
    let previousUrl: string | undefined = fallbackState.siteImages[imageKey];
    if (databaseAvailable && expertiseMatch) {
      previousUrl = (await dbPool.query<RowDataPacket[]>("SELECT image_url AS imageUrl FROM expertise_profiles WHERE expertise_id = ?", [Number(expertiseMatch[1])]))[0][0]?.imageUrl as string | undefined;
    } else if (databaseAvailable && workerMatch) {
      previousUrl = (await dbPool.query<RowDataPacket[]>("SELECT image_url AS imageUrl FROM worker_profiles WHERE worker_id = ?", [Number(workerMatch[1])]))[0][0]?.imageUrl as string | undefined;
    } else if (databaseAvailable) {
      previousUrl = (await dbPool.query<RowDataPacket[]>("SELECT image_url AS imageUrl FROM site_images WHERE image_key = ?", [imageKey]))[0][0]?.imageUrl as string | undefined;
    }
    await mkdir(uploadDirectory, { recursive: true });
    imagePath = resolve(uploadDirectory, filename);
    await writeFile(imagePath, image.buffer);
    const imageUrl = `${publicApiUrl}/uploads/${filename}`;

    if (databaseAvailable && expertiseMatch) {
      await dbPool.execute(
        `INSERT INTO expertise_profiles (expertise_id, image_url) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE image_url = VALUES(image_url)`,
        [Number(expertiseMatch[1]), imageUrl]
      );
    } else if (databaseAvailable && workerMatch) {
      await dbPool.execute(
        `INSERT INTO worker_profiles (worker_id, image_url) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE image_url = VALUES(image_url)`,
        [Number(workerMatch[1]), imageUrl]
      );
    } else if (databaseAvailable) {
      await dbPool.execute(
        `INSERT INTO site_images (image_key, image_url) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE image_url = VALUES(image_url)`,
        [imageKey, imageUrl]
      );
    }
    fallbackState.siteImages[imageKey] = imageUrl;
    if (expertiseMatch) {
      const expertise = fallbackState.expertises.find((item) => item.id === Number(expertiseMatch[1]));
      if (expertise) expertise.image_url = imageUrl;
    }
    if (workerMatch) {
      const worker = fallbackState.workers.find((item) => item.id === Number(workerMatch[1]));
      if (worker) worker.image_url = imageUrl;
    }

    const previousFile = previousUrl && (previousUrl.startsWith("/uploads/") || (publicApiUrl && previousUrl.startsWith(`${publicApiUrl}/uploads/`)))
      ? uploadedFileUrlPattern.exec(previousUrl)?.[1]
      : undefined;
    if (previousFile) {
      const oldPath = resolve(uploadDirectory, previousFile);
      if (oldPath !== imagePath && oldPath.startsWith(`${uploadDirectory}${sep}`)) await rm(oldPath, { force: true });
    }
    return res.json({ key: imageKey, imageUrl });
  } catch (error) {
    if (imagePath) await rm(imagePath, { force: true }).catch(() => undefined);
    if (error instanceof multer.MulterError) {
      return next(new ValidationError(error.code === "LIMIT_FILE_SIZE" ? "Image must be 8 MB or smaller" : "Only one image can be uploaded at a time"));
    }
    return next(error);
  }
});

managementRouter.get("/workers", async (_req, res, next) => {
  try {
    if (!(await isDatabaseAvailable())) {
      return res.json({ workers: fallbackState.workers.map((worker) => ({
        ...worker,
        expertiseId: worker.expertise_id,
        expertiseName: fallbackState.expertises.find((item) => item.id === worker.expertise_id)?.name ?? "",
        status: worker.daily_status
      })) });
    }
    const [workers] = await dbPool.query<WorkerRow[]>(
      `SELECT w.id, w.name, w.expertise_id AS expertiseId, e.name AS expertiseName,
              w.daily_status AS status, p.phone, p.email, p.bio, p.image_url AS imageUrl
       FROM workers w
       JOIN expertises e ON e.id = w.expertise_id
       LEFT JOIN worker_profiles p ON p.worker_id = w.id
       ORDER BY w.name ASC`
    );
    return res.json({ workers });
  } catch (error) {
    return next(error);
  }
});

managementRouter.post("/workers", async (req, res, next) => {
  try {
    const input = workerSchema.parse(req.body);
    if (input.loginPassword && !input.email) throw new ValidationError("Worker login requires an email address");
    if (!(await isDatabaseAvailable())) {
      const id = Math.max(0, ...fallbackState.workers.map((worker) => worker.id)) + 1;
      fallbackState.workers.push({
        id,
        name: input.name,
        expertise_id: input.expertiseId,
        daily_status: input.status,
        phone: input.phone,
        email: input.email || null,
        bio: input.bio,
        image_url: input.imageUrl || null
      });
      if (input.loginPassword && input.email) {
        fallbackState.workerAccounts.push({
          id: Math.max(0, ...fallbackState.workerAccounts.map((account) => account.id)) + 1,
          worker_id: id,
          email: input.email.toLowerCase(),
          password_hash: await hashPassword(input.loginPassword)
        });
      }
      return res.status(201).json({ workerId: id });
    }
    const connection = await dbPool.getConnection();
    let workerId = 0;
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute<ResultSetHeader>(
        "INSERT INTO workers (name, expertise_id, daily_status) VALUES (?, ?, ?)",
        [input.name, input.expertiseId, input.status]
      );
      workerId = result.insertId;
      await connection.execute(
        `INSERT INTO worker_profiles (worker_id, phone, email, bio, image_url)
         VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE phone = VALUES(phone), email = VALUES(email), bio = VALUES(bio), image_url = COALESCE(VALUES(image_url), image_url)`,
        [workerId, input.phone || null, input.email || null, input.bio || null, input.imageUrl || null]
      );
      if (input.email && input.loginPassword) {
        await connection.execute(
          `INSERT INTO worker_accounts (worker_id, email, password_hash) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE email = VALUES(email), password_hash = VALUES(password_hash)`,
          [workerId, input.email.toLowerCase(), await hashPassword(input.loginPassword)]
        );
      } else if (input.email) {
        await connection.execute("UPDATE worker_accounts SET email = ? WHERE worker_id = ?", [input.email.toLowerCase(), workerId]);
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return res.status(201).json({ workerId });
  } catch (error) {
    return next(error);
  }
});

managementRouter.put("/workers/:id", async (req, res, next) => {
  try {
    const workerId = idSchema.parse(req.params.id);
    const input = workerSchema.parse(req.body);
    if (input.loginPassword && !input.email) throw new ValidationError("Worker login requires an email address");
    if (!(await isDatabaseAvailable())) {
      const worker = fallbackState.workers.find((item) => item.id === workerId);
      if (!worker) throw new NotFoundError("Worker not found");
      Object.assign(worker, {
        name: input.name,
        expertise_id: input.expertiseId,
        daily_status: input.status,
        phone: input.phone,
        email: input.email || null,
        bio: input.bio,
        image_url: input.imageUrl || worker.image_url || null
      });
      const account = fallbackState.workerAccounts.find((item) => item.worker_id === workerId);
      if (input.loginPassword && input.email) {
        const passwordHash = await hashPassword(input.loginPassword);
        if (account) Object.assign(account, { email: input.email.toLowerCase(), password_hash: passwordHash });
        else fallbackState.workerAccounts.push({
          id: Math.max(0, ...fallbackState.workerAccounts.map((item) => item.id)) + 1,
          worker_id: workerId,
          email: input.email.toLowerCase(),
          password_hash: passwordHash
        });
      } else if (account && input.email) {
        account.email = input.email.toLowerCase();
      }
      return res.json({ workerId });
    }
    const connection = await dbPool.getConnection();
    try {
      await connection.beginTransaction();
      const [existingWorkers] = await connection.query<RowDataPacket[]>("SELECT id FROM workers WHERE id = ? FOR UPDATE", [workerId]);
      if (!existingWorkers.length) throw new NotFoundError("Worker not found");
      await connection.execute<ResultSetHeader>(
        "UPDATE workers SET name = ?, expertise_id = ?, daily_status = ? WHERE id = ?",
        [input.name, input.expertiseId, input.status, workerId]
      );
      await connection.execute(
        `INSERT INTO worker_profiles (worker_id, phone, email, bio, image_url)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE phone = VALUES(phone), email = VALUES(email), bio = VALUES(bio), image_url = COALESCE(VALUES(image_url), image_url)`,
        [workerId, input.phone || null, input.email || null, input.bio || null, input.imageUrl || null]
      );
      if (input.email && input.loginPassword) {
        await connection.execute(
          `INSERT INTO worker_accounts (worker_id, email, password_hash) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE email = VALUES(email), password_hash = VALUES(password_hash)`,
          [workerId, input.email.toLowerCase(), await hashPassword(input.loginPassword)]
        );
      } else if (input.email) {
        await connection.execute("UPDATE worker_accounts SET email = ? WHERE worker_id = ?", [input.email.toLowerCase(), workerId]);
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return res.json({ workerId });
  } catch (error) {
    console.error("Worker profile update failed:", error instanceof Error ? error.message : "Unknown error");
    return next(error);
  }
});

managementRouter.post("/expertises", async (req, res, next) => {
  try {
    const input = expertiseSchema.parse(req.body);
    if (!(await isDatabaseAvailable())) {
      if (fallbackState.expertises.some((item) => item.name.toLowerCase() === input.name.toLowerCase())) {
        throw new ConflictError("Uzmanlık alanı zaten kayıtlı");
      }
      const id = Math.max(0, ...fallbackState.expertises.map((item) => item.id)) + 1;
      fallbackState.expertises.push({ id, name: input.name, description: input.description, image_url: input.imageUrl || "" });
      return res.status(201).json({ expertiseId: id });
    }
    const connection = await dbPool.getConnection();
    let expertiseId = 0;
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute<ResultSetHeader>("INSERT INTO expertises (name) VALUES (?)", [input.name]);
      expertiseId = result.insertId;
      await connection.execute(
        "INSERT INTO expertise_profiles (expertise_id, description, image_url) VALUES (?, ?, ?)",
        [expertiseId, input.description || null, input.imageUrl || null]
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      if (error && typeof error === "object" && "code" in error && error.code === "ER_DUP_ENTRY") {
        throw new ConflictError("Uzmanlık alanı zaten kayıtlı");
      }
      throw error;
    } finally {
      connection.release();
    }
    return res.status(201).json({ expertiseId });
  } catch (error) {
    return next(error);
  }
});

managementRouter.put("/expertises/:id", async (req, res, next) => {
  try {
    const expertiseId = idSchema.parse(req.params.id);
    const input = expertiseSchema.parse(req.body);
    if (!(await isDatabaseAvailable())) {
      const expertise = fallbackState.expertises.find((item) => item.id === expertiseId);
      if (!expertise) throw new NotFoundError("Expertise not found");
      Object.assign(expertise, { name: input.name, description: input.description, image_url: input.imageUrl || expertise.image_url });
      return res.json({ expertiseId });
    }
    const connection = await dbPool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute<ResultSetHeader>("UPDATE expertises SET name = ? WHERE id = ?", [input.name, expertiseId]);
      if (result.affectedRows === 0) throw new NotFoundError("Expertise not found");
      await connection.execute(
        `INSERT INTO expertise_profiles (expertise_id, description, image_url)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE description = VALUES(description), image_url = COALESCE(VALUES(image_url), image_url)`,
        [expertiseId, input.description || null, input.imageUrl || null]
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      if (error && typeof error === "object" && "code" in error && error.code === "ER_DUP_ENTRY") {
        throw new ConflictError("Uzmanlık alanı zaten kayıtlı");
      }
      throw error;
    } finally {
      connection.release();
    }
    return res.json({ expertiseId });
  } catch (error) {
    return next(error);
  }
});

managementRouter.get("/schedule", async (req, res, next) => {
  try {
    const filters = scheduleQuerySchema.parse(req.query);
    if (filters.endDate < filters.startDate) throw new ConflictError("Bitiş tarihi başlangıç tarihinden önce olamaz");
    if (!(await isDatabaseAvailable())) {
      const assignments = fallbackState.assignments.filter((assignment) => {
        const worker = fallbackState.workers.find((item) => item.id === assignment.worker_id);
        return assignment.assignment_date >= filters.startDate && assignment.assignment_date <= filters.endDate &&
          fallbackState.requests.some((request) => request.id === assignment.request_id) &&
          (!filters.workerId || worker?.id === filters.workerId) && (!filters.expertiseId || worker?.expertise_id === filters.expertiseId);
      }).map((assignment) => {
        const worker = fallbackState.workers.find((item) => item.id === assignment.worker_id)!;
        const request = fallbackState.requests.find((item) => item.id === assignment.request_id)!;
        return {
          ...assignment,
          requestId: request.id,
          date: assignment.assignment_date,
          workerId: worker.id,
          workerName: worker.name,
          expertiseId: worker.expertise_id,
          expertiseName: fallbackState.expertises.find((item) => item.id === worker.expertise_id)?.name ?? "",
          clientName: fallbackState.clients.find((item) => item.id === request.client_id)?.company_or_name ?? "",
          status: request.status
        };
      });
      return res.json({ assignments });
    }
    const [assignments] = await dbPool.query<ScheduleRow[]>(
      `SELECT a.id, a.request_id AS requestId, DATE_FORMAT(a.assignment_date, '%Y-%m-%d') AS date,
              w.id AS workerId, w.name AS workerName, e.id AS expertiseId, e.name AS expertiseName,
              c.company_or_name AS clientName, r.status
       FROM assignments a
       JOIN requests r ON r.id = a.request_id
       JOIN workers w ON w.id = a.worker_id
       JOIN expertises e ON e.id = w.expertise_id
       JOIN clients c ON c.id = r.client_id
       WHERE a.assignment_date BETWEEN ? AND ?
         AND (? IS NULL OR e.id = ?)
         AND (? IS NULL OR w.id = ?)
       ORDER BY a.assignment_date, e.name, w.name`,
      [filters.startDate, filters.endDate, filters.expertiseId ?? null, filters.expertiseId ?? null, filters.workerId ?? null, filters.workerId ?? null]
    );
    return res.json({ assignments });
  } catch (error) {
    return next(error);
  }
});

managementRouter.put("/workers/:id/account", async (req, res, next) => {
  try {
    const workerId = idSchema.parse(req.params.id);
    const input = z.object({
      email: z.string().trim().email().max(254),
      password: z.string().min(8).max(200)
    }).parse(req.body);
    const email = input.email.toLowerCase();
    const passwordHash = await hashPassword(input.password);

    if (!(await isDatabaseAvailable())) {
      if (!fallbackState.workers.some((worker) => worker.id === workerId)) throw new NotFoundError("Worker not found");
      if (fallbackState.workerAccounts.some((account) => account.email === email && account.worker_id !== workerId)) {
        throw new ConflictError("Bu giriş e-posta adresi başka bir ustaya tanımlı");
      }
      const account = fallbackState.workerAccounts.find((item) => item.worker_id === workerId);
      if (account) Object.assign(account, { email, password_hash: passwordHash });
      else fallbackState.workerAccounts.push({
        id: Math.max(0, ...fallbackState.workerAccounts.map((item) => item.id)) + 1,
        worker_id: workerId,
        email,
        password_hash: passwordHash
      });
      const worker = fallbackState.workers.find((item) => item.id === workerId)!;
      worker.email = email;
      return res.json({ workerId, email });
    }

    const connection = await dbPool.getConnection();
    try {
      await connection.beginTransaction();
      const [workers] = await connection.query<RowDataPacket[]>("SELECT id FROM workers WHERE id = ? FOR UPDATE", [workerId]);
      if (!workers.length) throw new NotFoundError("Worker not found");
      await connection.execute(
        `INSERT INTO worker_accounts (worker_id, email, password_hash) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE email = VALUES(email), password_hash = VALUES(password_hash)`,
        [workerId, email, passwordHash]
      );
      await connection.execute(
        `INSERT INTO worker_profiles (worker_id, email) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE email = VALUES(email)`,
        [workerId, email]
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      if (error && typeof error === "object" && "code" in error && error.code === "ER_DUP_ENTRY") {
        throw new ConflictError("Bu giriş e-posta adresi başka bir ustaya tanımlı");
      }
      throw error;
    } finally {
      connection.release();
    }
    return res.json({ workerId, email });
  } catch (error) {
    return next(error);
  }
});

managementRouter.get("/activity", async (_req, res, next) => {
  try {
    if (!(await isDatabaseAvailable())) {
      const requests = [...fallbackState.requests].sort((left, right) => right.id - left.id).map((request) => ({
        requestId: request.id,
        clientName: fallbackState.clients.find((item) => item.id === request.client_id)?.company_or_name ?? "",
        expertiseName: fallbackState.expertises.find((item) => item.id === request.expertise_id)?.name ?? "",
        status: request.status,
        createdAt: request.created_at ?? ""
      }));
      const workUpdates = fallbackState.workUpdates.map((update) => {
        const assignment = fallbackState.assignments.find((item) => item.id === update.assignment_id);
        const request = assignment && fallbackState.requests.find((item) => item.id === assignment.request_id);
        return {
          requestId: request?.id,
          clientName: request && fallbackState.clients.find((item) => item.id === request.client_id)?.company_or_name,
          date: assignment?.assignment_date,
          workerName: fallbackState.workers.find((item) => item.id === update.worker_id)?.name,
          status: update.status,
          workDescription: update.work_description,
          updatedAt: update.updated_at
        };
      }).filter((item) => item.requestId);
      const reviews = fallbackState.reviews.map((review) => ({
        requestId: review.request_id,
        clientName: fallbackState.clients.find((item) => item.id === review.client_id)?.company_or_name ?? "",
        rating: review.rating,
        comment: review.comment,
        createdAt: review.created_at
      }));
      return res.json({ requests, workUpdates, reviews });
    }
    const [requests] = await dbPool.query<RowDataPacket[]>(
      `SELECT r.id AS requestId, c.company_or_name AS clientName, e.name AS expertiseName,
              r.status, DATE_FORMAT(r.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
       FROM requests r JOIN clients c ON c.id = r.client_id
       JOIN expertises e ON e.id = r.expertise_id
       ORDER BY r.created_at DESC, r.id DESC`
    );
    const [workUpdates] = await dbPool.query<RowDataPacket[]>(
      `SELECT r.id AS requestId, c.company_or_name AS clientName,
              DATE_FORMAT(a.assignment_date, '%Y-%m-%d') AS date, w.name AS workerName,
              u.status, u.work_description AS workDescription,
              DATE_FORMAT(u.updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt
       FROM assignment_work_updates u
       JOIN assignments a ON a.id = u.assignment_id
       JOIN requests r ON r.id = a.request_id
       JOIN clients c ON c.id = r.client_id
       JOIN workers w ON w.id = a.worker_id
       ORDER BY u.updated_at DESC`
    );
    const [reviews] = await dbPool.query<RowDataPacket[]>(
      `SELECT r.id AS requestId, c.company_or_name AS clientName, v.rating, v.comment,
              DATE_FORMAT(v.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
       FROM request_reviews v JOIN requests r ON r.id = v.request_id
       JOIN clients c ON c.id = v.client_id ORDER BY v.created_at DESC`
    );
    return res.json({ requests, workUpdates, reviews });
  } catch (error) {
    return next(error);
  }
});