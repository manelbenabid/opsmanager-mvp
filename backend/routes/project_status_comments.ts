import express from 'express';
import pool from '../db'; // Ensure this path is correct

const router = express.Router();

// Helper to map DB row to a more frontend-friendly projectStatusComment object
// Your frontend projectStatusComment interface should align with this structure.
const mapProjectStatusCommentData = (dbRow: any) => {
  if (!dbRow) return null;
  return {
    id: dbRow.id,
    projectId: dbRow.project_id,
    startedAt: dbRow.started_at, // Timestamp from DB, will be stringified
    endedAt: dbRow.ended_at,   // Timestamp from DB, will be stringified or null
    status: dbRow.status,      // Assuming project_status_enum comes as string
  };
};

// GET all status comments for a specific project
router.get('/', async (req, res) => {
  const { projectId } = req.query;

  if (!projectId) {
    return res.status(400).json({ error: 'Missing required query parameter: projectId' });
  }

  try {
    const result = await pool.query(
      `SELECT id, project_id, started_at, ended_at, status 
      FROM project_status_comments 
      WHERE project_id = $1 
      ORDER BY started_at DESC`,
      [projectId]
    );
    res.json(result.rows.map(mapProjectStatusCommentData));
  } catch (err) {
    console.error(`Error fetching Project status comments for projectId ${projectId}:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: 'Failed to fetch Project status comments', details: errorMessage });
  }
});

// GET all status comments for a specific project
router.get('/active-statuses/', async (req, res) => {
  const { projectId } = req.query;

  if (!projectId) {
    return res.status(400).json({ error: 'Missing required query parameter: projectId' });
  }

  try {
    const result = await pool.query(
      ` select * from project_current_statuses 
      WHERE project_id = $1 `,
      [projectId]
    );
    res.json(result.rows.map(mapProjectStatusCommentData));
  } catch (err) {
    console.error(`Error fetching Project status comments for projectId ${projectId}:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: 'Failed to fetch Project status comments', details: errorMessage });
  }
});

// GET a single project status comment by its ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, project_id, started_at, ended_at, status 
      FROM project_status_comments WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project status comment not found' });
    }
    res.json(mapProjectStatusCommentData(result.rows[0]));
  } catch (err) {
    console.error(`Error fetching Project status comment ${id}:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: 'Failed to fetch Project status comment', details: errorMessage });
  }
});

router.get('/active-statuses/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      ` select * from project_current_statuses WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project status comment not found' });
    }
    res.json(mapProjectStatusCommentData(result.rows[0]));
  } catch (err) {
    console.error(`Error fetching Project status comment ${id}:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: 'Failed to fetch Project status comment', details: errorMessage });
  }
});

// POST to create a new project status comment
router.post('/', async (req, res) => {
  const {
    projectId,
    startedAt, // Should be a valid timestamp string
    endedAt,   // Optional, should be a valid timestamp string or null
    status,    // From project_status_enum
  } = req.body;

  if (!projectId || !startedAt) { // Status can be null initially if that's allowed by your logic
    return res.status(400).json({ error: 'Missing required fields: projectId, startedAt' });
  }

  try {
    // Check if project exists
    const projectCheck = await pool.query('SELECT id FROM projects WHERE id = $1', [projectId]);
    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: `Project with id ${projectId} not found.` });
    }

    const result = await pool.query(
      `INSERT INTO project_status_comments (project_id, started_at, ended_at, status) 
      VALUES ($1, $2, $3, $4)
      RETURNING id, project_id, started_at, ended_at, status`,
      [projectId, new Date(startedAt), endedAt ? new Date(endedAt) : null, status]
    );
    res.status(201).json(mapProjectStatusCommentData(result.rows[0]));
  } catch (err) {
    console.error('Error creating Project status comment:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    if (err instanceof Error && 'code' in err) {
        if (err.code === '23503') { // Foreign key violation
            return res.status(400).json({ error: 'Invalid project_id. Project does not exist.', details: err.message });
        }
        if (err.code === '23514' && err.message.includes('project_status_enum')) { // Check constraint on enum
             return res.status(400).json({ error: 'Invalid status value.', details: err.message });
        }
         if (err.code === '22007' || err.code === '22008') { // Invalid date/time format
            return res.status(400).json({ error: 'Invalid date format for startedAt or endedAt.', details: err.message });
        }
    }
    res.status(500).json({ error: 'Database error during Project status comment creation', details: errorMessage });
  }
});

// PUT to update a project status comment
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    startedAt, // timestamp string
    endedAt,   // timestamp string or null
    status,    // project_status_enum
  } = req.body;

  if (startedAt === undefined && endedAt === undefined && status === undefined) {
    return res.status(400).json({ error: 'No fields provided for update. Provide startedAt, endedAt, or status.' });
  }

  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (startedAt !== undefined) {
    updates.push(`started_at = $${paramCount++}`);
    values.push(new Date(startedAt));
  }
  if (endedAt !== undefined) {
    updates.push(`ended_at = $${paramCount++}`);
    values.push(endedAt ? new Date(endedAt) : null);
  }
  if (status !== undefined) {
    updates.push(`status = $${paramCount++}`);
    values.push(status);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update.' });
  }

  values.push(id); // For WHERE id = $N

  try {
    const queryText = `
      UPDATE project_status_comments 
      SET ${updates.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING id, project_id, started_at, ended_at, status
    `;
    const result = await pool.query(queryText, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project status comment not found or not updated' });
    }
    res.json(mapProjectStatusCommentData(result.rows[0]));
  } catch (err) {
    console.error(`Error updating Project status comment ${id}:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    if (err instanceof Error && 'code' in err) {
        if (err.code === '23514' && err.message.includes('project_status_enum')) {
            return res.status(400).json({ error: 'Invalid status value.', details: err.message });
        }
        if (err.code === '22007' || err.code === '22008') { // Invalid date/time format
            return res.status(400).json({ error: 'Invalid date format for startedAt or endedAt.', details: err.message });
        }
    }
    res.status(500).json({ error: 'Database error during Project status comment update', details: errorMessage });
  }
});

// DELETE a project status comment
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Check if this status comment is referenced by project_comments
    const refCheck = await pool.query(
        'SELECT id FROM project_comments WHERE status_comment_id = $1 LIMIT 1',
        [id]
    );
    if (refCheck.rows.length > 0) {
        return res.status(409).json({ 
            error: 'Cannot delete status comment. It is referenced by one or more Project comments.',
            details: 'Delete or reassign associated Project comments before deleting this status entry.'
        });
    }

    const result = await pool.query(
      'DELETE FROM project_status_comments WHERE id = $1 RETURNING id, project_id, status',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project status comment not found' });
    }
    res.status(200).json({ message: 'Project status comment deleted successfully', deletedStatusComment: mapProjectStatusCommentData(result.rows[0]) });
  } catch (err) {
    console.error(`Error deleting Project status comment ${id}:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    // Note: The foreign key constraint in project_comments is ON DELETE CASCADE for status_comment_id,
    // so direct deletion here might be blocked if not for the manual check above,
    // or if the cascade isn't what's desired for all scenarios.
    // The manual check provides a more informative error.
    res.status(500).json({ error: 'Database error during Project status comment deletion', details: errorMessage });
  }
});

export default router;
