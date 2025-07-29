import express from 'express';
import pool from '../db';

const router = express.Router();

// This endpoint fetches the most recent activities across ALL projects.
router.get('/projects', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         pal.id,
         pal.project_id,
         p.title as project_title, -- Get the project title
         pal.user_id,
         pal.activity_type,
         pal.details,
         pal.timestamp,
         u.first_name || ' ' || u.last_name AS user_name
       FROM project_activity_log pal
       JOIN employees u ON pal.user_id = u.id
       JOIN projects p ON pal.project_id = p.id -- Join with projects to get the title
       ORDER BY pal.timestamp DESC
       LIMIT 25`, // Limit to the 25 most recent activities
    );

    // Map the data to a consistent frontend format
    const formattedLogs = result.rows.map(log => ({
        id: log.id,
        projectId: log.project_id,
        projectTitle: log.project_title,
        activityType: log.activity_type,
        details: log.details,
        timestamp: log.timestamp,
        user: {
            id: log.user_id,
            name: log.user_name,
        },
    }));

    res.json(formattedLogs);
  } catch (err) {
    console.error(`Error fetching recent project activity:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: 'Failed to fetch recent activity', details: errorMessage });
  }
});

export default router;