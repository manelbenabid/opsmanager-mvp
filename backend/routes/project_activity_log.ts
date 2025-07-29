import express from 'express';
import pool from '../db';

const router = express.Router();

// Maps the database row to a more frontend-friendly object
const mapActivityLogData = (dbRow: any) => {
  if (!dbRow) return null;
  return {
    id: dbRow.id,
    projectId: dbRow.project_id,
    activityType: dbRow.activity_type,
    details: dbRow.details, // JSONB field
    timestamp: dbRow.timestamp,
    user: {
      id: dbRow.user_id,
      name: dbRow.user_name,
    },
  };
};

// GET all activity logs for a specific Project ID
router.get('/:projectId', async (req, res) => {
  const { projectId } = req.params;
  const parsedProjectId = parseInt(projectId, 10);

  if (isNaN(parsedProjectId)) {
    return res.status(400).json({ error: 'Invalid Project ID format.' });
  }

  try {
    const result = await pool.query(
      `SELECT
         pal.id,
         pal.project_id,
         pal.user_id,
         pal.activity_type,
         pal.details,
         pal.timestamp,
         u.first_name || ' ' || u.last_name AS user_name
       FROM project_activity_log pal
       JOIN employees u ON pal.user_id = u.id
       WHERE pal.project_id = $1
       ORDER BY pal.timestamp DESC`,
      [parsedProjectId]
    );

    res.json(result.rows.map(mapActivityLogData));
  } catch (err) {
    console.error(`Error fetching activity log for Project ${projectId}:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: 'Failed to fetch activity log', details: errorMessage });
  }
});

export default router;