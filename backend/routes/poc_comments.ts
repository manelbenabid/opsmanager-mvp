import express from 'express';
import pool from '../db'; // Ensure this path is correct
import { sendEmail } from '../services/emailServices'; 
import {getEmployeeProfileDetailsByID} from '../services/employeeService'
import { format, parseISO } from 'date-fns';      // For formatting dates

const router = express.Router(); 

// Helper to map DB row to a more frontend-friendly PocComment object
// Your frontend PocComment interface should align with this structure.
const mapPocCommentData = (dbRow: any) => {
  if (!dbRow) return null;
  return {
    id: dbRow.id,
    statusCommentId: dbRow.status_comment_id,
    authorId: dbRow.author_id,
    comment: dbRow.comment,
    createdAt: dbRow.created_at,
    // Include author details if fetched
    author: dbRow.author_name ? { // Check if author details were joined
        id: dbRow.author_id, // Redundant but good for consistency if author object is expected
        name: dbRow.author_name,
        avatar: dbRow.author_avatar, // Assuming employees table has an avatar column
    } : undefined, // Or null, depending on frontend expectation
  };
};

// GET all comments for a specific PoC Status Comment (status_comment_id)
router.get('/', async (req, res) => {
  const { statusCommentId } = req.query;

  if (!statusCommentId) {
    return res.status(400).json({ error: 'Missing required query parameter: statusCommentId' });
  }

  try {
    const result = await pool.query(
      `SELECT 
        pc.id, pc.status_comment_id, pc.author_id, pc.comment, pc.created_at,
        e.first_name || ' ' || e.last_name AS author_name, 
        e.email AS author_email -- Or another field for avatar if you have it
      FROM poc_comments pc
      JOIN employees e ON pc.author_id = e.id
      WHERE pc.status_comment_id = $1 
      ORDER BY pc.created_at ASC`, // Or DESC depending on desired order
      [statusCommentId]
    );
    res.json(result.rows.map(mapPocCommentData));
  } catch (err) {
    console.error(`Error fetching PoC comments for statusCommentId ${statusCommentId}:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: 'Failed to fetch PoC comments', details: errorMessage });
  }
});

// GET a single PoC comment by its ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT 
        pc.id, pc.status_comment_id, pc.author_id, pc.comment, pc.created_at,
        e.first_name || ' ' || e.last_name AS author_name,
        e.email AS author_email -- Or another field for avatar if you have it
      FROM poc_comments pc
      JOIN employees e ON pc.author_id = e.id
      WHERE pc.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'PoC comment not found' });
    }
    res.json(mapPocCommentData(result.rows[0]));
  } catch (err) {
    console.error(`Error fetching PoC comment ${id}:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: 'Failed to fetch PoC comment', details: errorMessage });
  }
});

// POST to create a new PoC comment
router.post('/', async (req, res) => {
  const {
    statusCommentId,
    authorId,
    comment,
  } = req.body;

  if (!statusCommentId || !authorId || !comment) {
    return res.status(400).json({ error: 'Missing required fields: statusCommentId, authorId, comment' });
  }

  try {
    // Check if PoC Status Comment exists
    const statusCommentCheck = await pool.query('SELECT id FROM poc_status_comments WHERE id = $1', [statusCommentId]);
    if (statusCommentCheck.rows.length === 0) {
      return res.status(404).json({ error: `PoC Status Comment with id ${statusCommentId} not found.` });
    }

    // Check if Author (Employee) exists
    const authorCheck = await pool.query('SELECT id FROM employees WHERE id = $1', [authorId]);
    if (authorCheck.rows.length === 0) {
      return res.status(404).json({ error: `Author (Employee) with id ${authorId} not found.` });
    }

    const result = await pool.query(
      `INSERT INTO poc_comments (status_comment_id, author_id, comment, created_at) 
      VALUES ($1, $2, $3, NOW())
      RETURNING id, status_comment_id, author_id, comment, created_at`,
      [statusCommentId, authorId, comment]
    );
    
    // Fetch the newly created comment with author details to return
    const newCommentId = result.rows[0].id;
    const newCommentResult = await pool.query(
       `SELECT 
        pc.id, pc.status_comment_id, pc.author_id, pc.comment, pc.created_at,
        e.first_name || ' ' || e.last_name AS author_name,
        e.email AS author_email -- Or another field for avatar if you have it
      FROM poc_comments pc
      JOIN employees e ON pc.author_id = e.id
      WHERE pc.id = $1`,
      [newCommentId]
    );

    const savedCommentData = newCommentResult.rows[0]; // This has the comment and author details

    // --- Start of Email Notification Logic ---
    const commentContentWithMarkup = savedCommentData.comment;
    const mentionerName = savedCommentData.author_name || 'A colleague'; // From the JOINed query
    
    // You need to get pocId and pocTitle.
    // poc_status_comments table (which statusCommentId refers to) should have a poc_id.
    let pocIdForEmail: number | null = null;
    let pocTitleForEmail: string = 'N/A';
    let pocCustomerName: string = 'N/A';
    let pocTechnology: string = 'N/A';
    let pocStartDate: Date | null = null;
    let pocEndDate: Date | null = null;

    try {
        const pocInfoQuery = await pool.query(
        `SELECT p.id, p.title, p.technology, p.start_date, p.end_date, c.name as customer_name 
         FROM pocs p
         JOIN poc_status_comments psc ON p.id = psc.poc_id
         LEFT JOIN customers c ON p.customer_id = c.id
         WHERE psc.id = $1`,
        [savedCommentData.status_comment_id]
      );
        if (pocInfoQuery.rows.length > 0) {
          const pocInfo = pocInfoQuery.rows[0];
          pocIdForEmail = pocInfo.id;
          pocTitleForEmail = pocInfo.title;
          pocCustomerName = pocInfo.customer_name;
          pocTechnology = pocInfo.technology;
          pocStartDate = pocInfo.start_date; // pg driver returns this as a Date object
          pocEndDate = pocInfo.end_date;
      } else {
            console.warn(`Could not find PoC details for status_comment_id: ${savedCommentData.status_comment_id}`);
        }
    } catch (pocInfoError) {
        console.error("Error fetching PoC info for email notification:", pocInfoError);
    }

    const pocLink = pocIdForEmail ? `${process.env.FRONTEND_URL}/pocs/${pocIdForEmail}` : `${process.env.FRONTEND_URL}/pocs`;

    const mentionRegex = /@\[([^\]]+)\]\(employee:([^)]+)\)/g;
    let match;
    const mentionedUserIds = new Set<string>();

    while ((match = mentionRegex.exec(commentContentWithMarkup)) !== null) {
      const [_fullMatch, _displayName, employeeIdFromMention] = match;
      mentionedUserIds.add(employeeIdFromMention);
    }

    if (mentionedUserIds.size > 0 && pocIdForEmail) { // Only proceed if we have PoC info
      const getPlainTextComment = (textWithMarkup: string) => textWithMarkup.replace(mentionRegex, '$1');
      const plainTextCommentForEmail = getPlainTextComment(commentContentWithMarkup);
      const getHtmlComment = (textWithMarkup: string) => textWithMarkup.replace(mentionRegex, (_full, displayName) => `<strong style="color: #3B82F6;">${displayName}</strong>`);
      const htmlCommentForEmail = getHtmlComment(commentContentWithMarkup);

      const formattedStartDate = pocStartDate ? format(pocStartDate, "MMM d, yyyy") : 'Not set';
      const formattedEndDate = pocEndDate ? format(pocEndDate, "MMM d, yyyy") : 'Not set';


      for (const mentionedEmployeeId of mentionedUserIds) {
        // Avoid notifying the person who wrote the comment if they @mention themselves
        if (savedCommentData.author_id.toString() === mentionedEmployeeId) {
            continue;
        }
        try {
          // Fetch mentioned employee's email and name using their on-premise ID
          // Assuming getEmployeeProfileDetails can fetch by ID and returns an object with email and firstName/name
          const employeeProfile = await getEmployeeProfileDetailsByID(parseInt(mentionedEmployeeId, 10)); // Using your existing service

          if (employeeProfile && employeeProfile.email) {
            const emailOptions = {
              to: employeeProfile.email,
              subject: `You were mentioned in PoC: ${pocTitleForEmail}`,
              text: `Hi ${employeeProfile.name},\n\n${mentionerName} mentioned you in PoC "${pocTitleForEmail}" for customer "${pocCustomerName}".\n\nComment:\n"${plainTextCommentForEmail}"\n\nView PoC: ${pocLink}`,
              html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                  <p>Hi ${employeeProfile.name},</p>
                  <p><strong>${mentionerName}</strong> mentioned you in a comment regarding the Proof of Concept "<strong>${pocTitleForEmail}</strong>".</p>
                  
                  <div style="background-color: #f7f7f7; border-left: 4px solid #6366f1; padding: 15px; margin: 20px 0;">
                    <p style="margin: 0; font-style: italic; color: #555;">${htmlCommentForEmail}</p>
                  </div>

                  <h4 style="color: #4a5568; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">PoC Details</h4>
                  <p style="margin: 5px 0;"><strong>Customer:</strong> ${pocCustomerName}</p>
                  <p style="margin: 5px 0;"><strong>Technology:</strong> ${pocTechnology}</p>
                  <p style="margin: 5px 0;"><strong>Timeline:</strong> ${formattedStartDate} to ${formattedEndDate}</p>

                  <p style="margin-top: 25px; text-align: left;">
                    <a href="${pocLink}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Full PoC Details</a>
                  </p>
                  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
              <p style="font-size: 12px; color: #777;">Please do not reply. This is an automated notification from the NTS Operation Manager.</p>
                </div>
              `,
            };
            
            sendEmail(emailOptions).catch(err => {
                console.error("Background email sending failed for a mention:", err);
            });
          } else {
            console.warn(`Could not find email for mentioned employee ID: ${mentionedEmployeeId}`);
          }
        } catch (emailError) {
          console.error(`Error processing mention notification for employee ID ${mentionedEmployeeId}:`, emailError);
        }
      }
    }


    res.status(201).json(mapPocCommentData(newCommentResult.rows[0]));
  } catch (err) {
    console.error('Error creating PoC comment:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    if (err instanceof Error && 'code' in err && err.code === '23503') { // Foreign key violation
        return res.status(400).json({ error: 'Invalid status_comment_id or author_id.', details: err.message });
    }
    res.status(500).json({ error: 'Database error during PoC comment creation', details: errorMessage });
  }
});

// PUT to update a PoC comment (only the comment text)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { comment } = req.body;

  if (comment === undefined || typeof comment !== 'string' || comment.trim() === '') {
    return res.status(400).json({ error: 'Missing or invalid comment text for update.' });
  }

  try {
    const result = await pool.query(
      `UPDATE poc_comments 
      SET comment = $1 
      WHERE id = $2
      RETURNING id, status_comment_id, author_id, comment, created_at`,
      [comment, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'PoC comment not found or not updated' });
    }
    
    // Fetch the updated comment with author details
    const updatedCommentId = result.rows[0].id;
    const updatedCommentResult = await pool.query(
       `SELECT 
        pc.id, pc.status_comment_id, pc.author_id, pc.comment, pc.created_at,
        e.first_name || ' ' || e.last_name AS author_name,
        e.email AS author_email -- Or another field for avatar if you have it
      FROM poc_comments pc
      JOIN employees e ON pc.author_id = e.id
      WHERE pc.id = $1`,
      [updatedCommentId]
    );
    
    res.json(mapPocCommentData(updatedCommentResult.rows[0]));
  } catch (err) {
    console.error(`Error updating PoC comment ${id}:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: 'Database error during PoC comment update', details: errorMessage });
  }
});

// DELETE a PoC comment
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM poc_comments WHERE id = $1 RETURNING id, status_comment_id, author_id, comment',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'PoC comment not found' });
    }
    res.status(200).json({ message: 'PoC comment deleted successfully', deletedComment: mapPocCommentData(result.rows[0]) });
  } catch (err) {
    console.error(`Error deleting PoC comment ${id}:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: 'Database error during PoC comment deletion', details: errorMessage });
  }
});

export default router;
