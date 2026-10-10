import { dbPool } from "../../shared/db/pool.js";

interface CapacityRow {
  date: string;
  totalCapacity: number;
  usedCapacity: number;
}

export async function getDailyCapacities(
  expertiseId: number,
  startDate: string,
  endDate: string
): Promise<CapacityRow[]> {
  const [rows] = await dbPool.query(
    `
    WITH RECURSIVE date_span AS (
      SELECT CAST(? AS DATE) AS d
      UNION ALL
      SELECT DATE_ADD(d, INTERVAL 1 DAY)
      FROM date_span
      WHERE d < CAST(? AS DATE)
    )
    SELECT
      DATE_FORMAT(ds.d, '%Y-%m-%d') AS date,
      (
        SELECT COUNT(*)
        FROM workers w
        WHERE w.expertise_id = ?
          AND w.daily_status = 'ACTIVE'
      ) AS totalCapacity,
      (
        SELECT COUNT(DISTINCT a.worker_id)
        FROM assignments a
        JOIN workers w2 ON w2.id = a.worker_id
        WHERE w2.expertise_id = ?
          AND a.assignment_date = ds.d
      ) AS usedCapacity
    FROM date_span ds
    `,
    [startDate, endDate, expertiseId, expertiseId]
  );

  return rows as CapacityRow[];
}
