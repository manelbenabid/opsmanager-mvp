import express from 'express';
import pool from '../db'; // Ensure this path is correct
 
const router = express.Router();

// Helper to map DB row to a more frontend-friendly PocStatusComment object
// Your frontend PocStatusComment interface should align with this structure.
const mapPocStatusCommentData = (dbRow: any) => {
  if (!dbRow) return null;
  return {
    id: dbRow.id,
    pocId: dbRow.poc_id,
    startedAt: dbRow.started_at, // Timestamp from DB, will be stringified
    endedAt: dbRow.ended_at,   // Timestamp from DB, will be stringified or null
    status: dbRow.status,      // Assuming poc_status_enum comes as string
  };
};

// GET all status comments for a specific PoC
router.get('/', async (req, res) => {
  const { pocId } = req.query;

  if (!pocId) {
    return res.status(400).json({ error: 'Missing required query parameter: pocId' });
  }

  try {
    const result = await pool.query(
      `SELECT id, poc_id, started_at, ended_at, status 
      FROM poc_status_comments 
      WHERE poc_id = $1 
      ORDER BY started_at DESC`,
      [pocId]
    );
    res.json(result.rows.map(mapPocStatusCommentData));
  } catch (err) {
    console.error(`Error fetching PoC status comments for pocId ${pocId}:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: 'Failed to fetch PoC status comments', details: errorMessage });
  }
});

// GET a single PoC status comment by its ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, poc_id, started_at, ended_at, status 
      FROM poc_status_comments WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'PoC status comment not found' });
    }
    res.json(mapPocStatusCommentData(result.rows[0]));
  } catch (err) {
    console.error(`Error fetching PoC status comment ${id}:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: 'Failed to fetch PoC status comment', details: errorMessage });
  }
});

// POST to create a new PoC status comment
router.post('/', async (req, res) => {
  const {
    pocId,
    startedAt, // Should be a valid timestamp string
    endedAt,   // Optional, should be a valid timestamp string or null
    status,    // From poc_status_enum
  } = req.body;

  if (!pocId || !startedAt) { // Status can be null initially if that's allowed by your logic
    return res.status(400).json({ error: 'Missing required fields: pocId, startedAt' });
  }

  try {
    // Check if PoC exists
    const pocCheck = await pool.query('SELECT id FROM pocs WHERE id = $1', [pocId]);
    if (pocCheck.rows.length === 0) {
      return res.status(404).json({ error: `PoC with id ${pocId} not found.` });
    }

    const result = await pool.query(
      `INSERT INTO poc_status_comments (poc_id, started_at, ended_at, status) 
      VALUES ($1, $2, $3, $4)
      RETURNING id, poc_id, started_at, ended_at, status`,
      [pocId, new Date(startedAt), endedAt ? new Date(endedAt) : null, status]
    );
    res.status(201).json(mapPocStatusCommentData(result.rows[0]));
  } catch (err) {
    console.error('Error creating PoC status comment:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    if (err instanceof Error && 'code' in err) {
        if (err.code === '23503') { // Foreign key violation
            return res.status(400).json({ error: 'Invalid poc_id. PoC does not exist.', details: err.message });
        }
        if (err.code === '23514' && err.message.includes('poc_status_enum')) { // Check constraint on enum
             return res.status(400).json({ error: 'Invalid status value.', details: err.message });
        }
         if (err.code === '22007' || err.code === '22008') { // Invalid date/time format
            return res.status(400).json({ error: 'Invalid date format for startedAt or endedAt.', details: err.message });
        }
    }
    res.status(500).json({ error: 'Database error during PoC status comment creation', details: errorMessage });
  }
});

// PUT to update a PoC status comment
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    startedAt, // timestamp string
    endedAt,   // timestamp string or null
    status,    // poc_status_enum
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
      UPDATE poc_status_comments 
      SET ${updates.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING id, poc_id, started_at, ended_at, status
    `;
    const result = await pool.query(queryText, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'PoC status comment not found or not updated' });
    }
    res.json(mapPocStatusCommentData(result.rows[0]));
  } catch (err) {
    console.error(`Error updating PoC status comment ${id}:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    if (err instanceof Error && 'code' in err) {
        if (err.code === '23514' && err.message.includes('poc_status_enum')) {
            return res.status(400).json({ error: 'Invalid status value.', details: err.message });
        }
        if (err.code === '22007' || err.code === '22008') { // Invalid date/time format
            return res.status(400).json({ error: 'Invalid date format for startedAt or endedAt.', details: err.message });
        }
    }
    res.status(500).json({ error: 'Database error during PoC status comment update', details: errorMessage });
  }
});

// DELETE a PoC status comment
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Check if this status comment is referenced by poc_comments
    const refCheck = await pool.query(
        'SELECT id FROM poc_comments WHERE status_comment_id = $1 LIMIT 1',
        [id]
    );
    if (refCheck.rows.length > 0) {
        return res.status(409).json({ 
            error: 'Cannot delete status comment. It is referenced by one or more PoC comments.',
            details: 'Delete or reassign associated PoC comments before deleting this status entry.'
        });
    }

    const result = await pool.query(
      'DELETE FROM poc_status_comments WHERE id = $1 RETURNING id, poc_id, status',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'PoC status comment not found' });
    }
    res.status(200).json({ message: 'PoC status comment deleted successfully', deletedStatusComment: mapPocStatusCommentData(result.rows[0]) });
  } catch (err) {
    console.error(`Error deleting PoC status comment ${id}:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    // Note: The foreign key constraint in poc_comments is ON DELETE CASCADE for status_comment_id,
    // so direct deletion here might be blocked if not for the manual check above,
    // or if the cascade isn't what's desired for all scenarios.
    // The manual check provides a more informative error.
    res.status(500).json({ error: 'Database error during PoC status comment deletion', details: errorMessage });
  }
});

export default router;
