import { dbPool } from "../../shared/db/pool.js";
import { createDateSpan, fallbackState, isDatabaseAvailable } from "../../shared/fallback-store.js";

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
  if (!(await isDatabaseAvailable())) {
    const totalCapacity = fallbackState.workers.filter(
      (worker) => worker.expertise_id === expertiseId && worker.daily_status === "ACTIVE"
    ).length;

    return createDateSpan(startDate, endDate).map((date) => ({
      date,
      totalCapacity,
      usedCapacity: fallbackState.assignments
        .filter((assignment) => assignment.assignment_date === date)
        .filter((assignment) =>
          fallbackState.workers.some(
            (worker) => worker.id === assignment.worker_id && worker.expertise_id === expertiseId
          )
        ).length
    }));
  }

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
