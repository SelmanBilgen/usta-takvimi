import { Router } from "express";
import { RowDataPacket } from "mysql2";

import { dbPool } from "../../shared/db/pool.js";
import { fallbackState, isDatabaseAvailable } from "../../shared/fallback-store.js";

interface SiteImageRow extends RowDataPacket {
  imageKey: string;
  imageUrl: string;
}

export const siteImagesRouter = Router();

siteImagesRouter.get("/", async (_req, res, next) => {
  try {
    if (!(await isDatabaseAvailable())) return res.json({ images: fallbackState.siteImages });
    const [rows] = await dbPool.query<SiteImageRow[]>(
      "SELECT image_key AS imageKey, image_url AS imageUrl FROM site_images"
    );
    return res.json({ images: Object.fromEntries(rows.map((row) => [row.imageKey, row.imageUrl])) });
  } catch (error) {
    return next(error);
  }
});
