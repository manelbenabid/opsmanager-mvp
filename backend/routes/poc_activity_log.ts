import express from 'express';
import pool from '../db';

const router = express.Router();

// Maps the database row to a more frontend-friendly object
const mapActivityLogData = (dbRow: any) => {
  if (!dbRow) return null;
  return {
    id: dbRow.id,
    pocId: dbRow.poc_id,
    activityType: dbRow.activity_type,
    details: dbRow.details, // This is a JSONB field
    timestamp: dbRow.timestamp,
    user: {
      id: dbRow.user_id,
      name: dbRow.user_name,
    },
  };
};

// GET all activity logs for a specific PoC ID
router.get('/:pocId', async (req, res) => {
  const { pocId } = req.params;
  const parsedPocId = parseInt(pocId, 10);

  if (isNaN(parsedPocId)) {
    return res.status(400).json({ error: 'Invalid PoC ID format.' });
  }

  try {
    const result = await pool.query(
      `SELECT
         pal.id,
         pal.poc_id,
         pal.user_id,
         pal.activity_type,
         pal.details,
         pal.timestamp,
         u.first_name || ' ' || u.last_name AS user_name
       FROM poc_activity_log pal
       JOIN employees u ON pal.user_id = u.id
       WHERE pal.poc_id = $1
       ORDER BY pal.timestamp DESC`,
      [parsedPocId]
    );

    if (result.rows.length === 0) {
      // Return an empty array if no logs found, which is not an error
      return res.json([]);
    }

    res.json(result.rows.map(mapActivityLogData));
  } catch (err) {
    console.error(`Error fetching activity log for PoC ${pocId}:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: 'Failed to fetch activity log', details: errorMessage });
  }
});

export default router;