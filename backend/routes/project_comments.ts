import express from 'express';
import pool from '../db'; // Ensure this path is correct
import { sendEmail } from '../services/emailServices'; 
import {getEmployeeProfileDetailsByID} from '../services/employeeService'
import { format, parseISO } from 'date-fns';      // For formatting dates

const router = express.Router();

// Helper to map DB row to a more frontend-friendly ProjectComment object
// Your frontend ProjectComment interface should align with this structure.
const mapProjectCommentData = (dbRow: any) => {
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

// GET all comments for a specific project Status Comment (status_comment_id)
router.get('/', async (req, res) => {
  const { statusCommentId } = req.query;

  if (!statusCommentId) {
    return res.status(400).json({ error: 'Missing required query parameter: statusCommentId' });
  }

  try {
    const result = await pool.query(
      `SELECT 
        prc.id, prc.status_comment_id, prc.author_id, prc.comment, prc.created_at,
        e.first_name || ' ' || e.last_name AS author_name, 
        e.email AS author_email -- Or another field for avatar if you have it
      FROM project_comments prc
      JOIN employees e ON prc.author_id = e.id
      WHERE prc.status_comment_id = $1 
      ORDER BY prc.created_at ASC`, // Or DESC depending on desired order
      [statusCommentId]
    );
    res.json(result.rows.map(mapProjectCommentData));
  } catch (err) {
    console.error(`Error fetching Project comments for statusCommentId ${statusCommentId}:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: 'Failed to fetch Project comments', details: errorMessage });
  }
});

// GET a single project comment by its ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT 
        prc.id, prc.status_comment_id, prc.author_id, prc.comment, prc.created_at,
        e.first_name || ' ' || e.last_name AS author_name,
        e.email AS author_email -- Or another field for avatar if you have it
      FROM project_comments prc
      JOIN employees e ON prc.author_id = e.id
      WHERE prc.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project comment not found' });
    }
    res.json(mapProjectCommentData(result.rows[0]));
  } catch (err) {
    console.error(`Error fetching Project comment ${id}:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: 'Failed to fetch Project comment', details: errorMessage });
  }
});

// POST to create a new project comment
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
    // Check if project Status Comment exists
    const statusCommentCheck = await pool.query('SELECT id FROM project_status_comments WHERE id = $1', [statusCommentId]);
    if (statusCommentCheck.rows.length === 0) {
      return res.status(404).json({ error: `Project Status Comment with id ${statusCommentId} not found.` });
    }

    // Check if Author (Employee) exists
    const authorCheck = await pool.query('SELECT id FROM employees WHERE id = $1', [authorId]);
    if (authorCheck.rows.length === 0) {
      return res.status(404).json({ error: `Author (Employee) with id ${authorId} not found.` });
    }

    const result = await pool.query(
      `INSERT INTO project_comments (status_comment_id, author_id, comment, created_at) 
      VALUES ($1, $2, $3, NOW())
      RETURNING id, status_comment_id, author_id, comment, created_at`,
      [statusCommentId, authorId, comment]
    );
    
    // Fetch the newly created comment with author details to return
    const newCommentId = result.rows[0].id;
    const newCommentResult = await pool.query(
       `SELECT 
        prc.id, prc.status_comment_id, prc.author_id, prc.comment, prc.created_at,
        e.first_name || ' ' || e.last_name AS author_name,
        e.email AS author_email -- Or another field for avatar if you have it
      FROM project_comments prc
      JOIN employees e ON prc.author_id = e.id
      WHERE prc.id = $1`,
      [newCommentId]
    );

    const savedCommentData = newCommentResult.rows[0]; // This has the comment and author details

    // --- Start of Email Notification Logic ---
    const commentContentWithMarkup = savedCommentData.comment;
    const mentionerName = savedCommentData.author_name || 'A colleague'; // From the JOINed query
    
    // You need to get projectId and projectTitle.
    // project_status_comments table (which statusCommentId refers to) should have a project_id.
    let projectIdForEmail: number | null = null;
    let projectTitleForEmail: string = 'N/A';
    let projectCustomerName: string = 'N/A';
    let projectTechnology: string = 'N/A';
    let projectStartDate: Date | null = null;
    let projectEndDate: Date | null = null;

    try {
        const projectInfoQuery = await pool.query(
        `SELECT p.id, p.title, p.technology, p.start_date, p.end_date, c.name as customer_name 
         FROM projects p
         JOIN project_status_comments psc ON p.id = psc.project_id
         LEFT JOIN customers c ON p.customer_id = c.id
         WHERE psc.id = $1`,
        [savedCommentData.status_comment_id]
      );
        if (projectInfoQuery.rows.length > 0) {
          const projectInfo = projectInfoQuery.rows[0];
          projectIdForEmail = projectInfo.id;
          projectTitleForEmail = projectInfo.title;
          projectCustomerName = projectInfo.customer_name;
          projectTechnology = projectInfo.technology;
          projectStartDate = projectInfo.start_date; // pg driver returns this as a Date object
          projectEndDate = projectInfo.end_date;
      } else {
            console.warn(`Could not find Project details for status_comment_id: ${savedCommentData.status_comment_id}`);
        }
    } catch (projectInfoError) {
        console.error("Error fetching Project info for email notification:", projectInfoError);
    }

    const projectLink = projectIdForEmail ? `${process.env.FRONTEND_URL}/projects/${projectIdForEmail}` : `${process.env.FRONTEND_URL}/projects`;

    const mentionRegex = /@\[([^\]]+)\]\(employee:([^)]+)\)/g;
    let match;
    const mentionedUserIds = new Set<string>();

    while ((match = mentionRegex.exec(commentContentWithMarkup)) !== null) {
      const [_fullMatch, _displayName, employeeIdFromMention] = match;
      mentionedUserIds.add(employeeIdFromMention);
    }

    if (mentionedUserIds.size > 0 && projectIdForEmail) { // Only proceed if we have Project info
      const getPlainTextComment = (textWithMarkup: string) => textWithMarkup.replace(mentionRegex, '$1');
      const plainTextCommentForEmail = getPlainTextComment(commentContentWithMarkup);
      const getHtmlComment = (textWithMarkup: string) => textWithMarkup.replace(mentionRegex, (_full, displayName) => `<strong style="color: #3B82F6;">${displayName}</strong>`);
      const htmlCommentForEmail = getHtmlComment(commentContentWithMarkup);

      const formattedStartDate = projectStartDate ? format(projectStartDate, "MMM d, yyyy") : 'Not set';
      const formattedEndDate = projectEndDate ? format(projectEndDate, "MMM d, yyyy") : 'Not set';


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
              subject: `You were mentioned in Project: ${projectTitleForEmail}`,
              text: `Hi ${employeeProfile.name},\n\n${mentionerName} mentioned you in Project "${projectTitleForEmail}" for customer "${projectCustomerName}".\n\nComment:\n"${plainTextCommentForEmail}"\n\nView Project: ${projectLink}`,
              html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                  <p>Hi ${employeeProfile.name},</p>
                  <p><strong>${mentionerName}</strong> mentioned you in a comment regarding the Project "<strong>${projectTitleForEmail}</strong>".</p>
                  
                  <div style="background-color: #f7f7f7; border-left: 4px solid #6366f1; padding: 15px; margin: 20px 0;">
                    <p style="margin: 0; font-style: italic; color: #555;">${htmlCommentForEmail}</p>
                  </div>

                  <h4 style="color: #4a5568; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">Project Details</h4>
                  <p style="margin: 5px 0;"><strong>Customer:</strong> ${projectCustomerName}</p>
                  <p style="margin: 5px 0;"><strong>Technology:</strong> ${projectTechnology}</p>
                  <p style="margin: 5px 0;"><strong>Timeline:</strong> ${formattedStartDate} to ${formattedEndDate}</p>

                  <p style="margin-top: 25px; text-align: left;">
                    <a href="${projectLink}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Full Project Details</a>
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


    res.status(201).json(mapProjectCommentData(newCommentResult.rows[0]));
  } catch (err) {
    console.error('Error creating Project comment:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    if (err instanceof Error && 'code' in err && err.code === '23503') { // Foreign key violation
        return res.status(400).json({ error: 'Invalid status_comment_id or author_id.', details: err.message });
    }
    res.status(500).json({ error: 'Database error during Project comment creation', details: errorMessage });
  }
});

// PUT to update a Project comment (only the comment text)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { comment } = req.body;

  if (comment === undefined || typeof comment !== 'string' || comment.trim() === '') {
    return res.status(400).json({ error: 'Missing or invalid comment text for update.' });
  }

  try {
    const result = await pool.query(
      `UPDATE project_comments 
      SET comment = $1 
      WHERE id = $2
      RETURNING id, status_comment_id, author_id, comment, created_at`,
      [comment, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project comment not found or not updated' });
    }
    
    // Fetch the updated comment with author details
    const updatedCommentId = result.rows[0].id;
    const updatedCommentResult = await pool.query(
       `SELECT 
        pc.id, pc.status_comment_id, pc.author_id, pc.comment, pc.created_at,
        e.first_name || ' ' || e.last_name AS author_name,
        e.email AS author_email -- Or another field for avatar if you have it
      FROM project_comments pc
      JOIN employees e ON pc.author_id = e.id
      WHERE pc.id = $1`,
      [updatedCommentId]
    );
    
    res.json(mapProjectCommentData(updatedCommentResult.rows[0]));
  } catch (err) {
    console.error(`Error updating Project comment ${id}:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: 'Database error during Project comment update', details: errorMessage });
  }
});

// DELETE a Project comment
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM project_comments WHERE id = $1 RETURNING id, status_comment_id, author_id, comment',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project comment not found' });
    }
    res.status(200).json({ message: 'Project comment deleted successfully', deletedComment: mapProjectCommentData(result.rows[0]) });
  } catch (err) {
    console.error(`Error deleting Project comment ${id}:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: 'Database error during Project comment deletion', details: errorMessage });
  }
});

export default router;
