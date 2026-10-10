import { Router } from "express";
import { RowDataPacket } from "mysql2";

import { dbPool } from "../../shared/db/pool.js";
import { fallbackState, isDatabaseAvailable } from "../../shared/fallback-store.js";

interface ExpertiseRow extends RowDataPacket {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
}

function defaultImageFor(expertise: ExpertiseRow) {
  const name = expertise.name.toLocaleLowerCase("tr-TR");
  if (name.includes("elektrik")) return fallbackState.expertises.find((item) => item.id === 3)?.image_url;
  if (name.includes("tesisat") || name.includes("su")) return fallbackState.expertises.find((item) => item.id === 2)?.image_url;
  if (name.includes("boya") || name.includes("alçı") || name.includes("duvar")) return fallbackState.expertises.find((item) => item.id === 1)?.image_url;
  if (name.includes("mobilya")) return "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=85";
  return "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=900&q=85";
}

export const expertiseRouter = Router();

expertiseRouter.get("/", async (_req, res, next) => {
  try {
    if (!(await isDatabaseAvailable())) {
      return res.json({ expertises: fallbackState.expertises });
    }
    const [rows] = await dbPool.query<ExpertiseRow[]>(
      `SELECT e.id, e.name, p.description, p.image_url AS imageUrl
       FROM expertises e
       LEFT JOIN expertise_profiles p ON p.expertise_id = e.id
       ORDER BY e.name ASC`
    );
    return res.json({
      expertises: rows.map((expertise) => ({
        ...expertise,
        imageUrl: expertise.imageUrl ?? defaultImageFor(expertise)
      }))
    });
  } catch (error) {
    return next(error);
  }
});