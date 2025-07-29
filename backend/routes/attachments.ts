// src/routes/attachments.ts
import express from "express";
import pool from "../db";
import path from "path";

const router = express.Router();

// Your designated uploads directory


const logPocActivity = async (
  client: any,
  pocId: number,
  userId: number,
  activityType: string,
  details: object
) => {
  try {
    await client.query(
      `INSERT INTO poc_activity_log (poc_id, user_id, activity_type, details)
         VALUES ($1, $2, $3, $4)`,
      [pocId, userId, activityType, JSON.stringify(details)]
    );
  } catch (error) {
    // Log the error but don't fail the main transaction
    console.error(
      `Failed to log activity '${activityType}' for PoC ${pocId}:`,
      error
    );
    // Depending on business rules, you might want to re-throw the error
    // to cause the main transaction to roll back.
    // throw error;
  }
};

const logProjectActivity = async (
  client: any,
  projectId: number,
  userId: number,
  activityType: string,
  details: object
) => {
  try {
    await client.query(
      `INSERT INTO project_activity_log (project_id, user_id, activity_type, details)
         VALUES ($1, $2, $3, $4)`,
      [projectId, userId, activityType, JSON.stringify(details)]
    );
  } catch (error) {
    console.error(
      `Failed to log activity '${activityType}' for Project ${projectId}:`,
      error
    );
  }
};

router.get("/:uuid/download", async (req, res) => {
  // 1. Verify user is authenticated
  const actorUserId = req.user?.id;
  if (!actorUserId) {
    return res.status(403).json({ error: "User not authenticated." });
  }

  const { uuid } = req.params;

  try {
    let attachment;
    let entityType = "";

    // 2. Find the attachment and its parent ID
    let pocResult = await pool.query(
      "SELECT poc_id, original_filename, mime_type, file_data FROM poc_attachments WHERE uuid = $1",
      [uuid]
    );

    if (pocResult.rows.length > 0) {
      attachment = pocResult.rows[0];
      entityType = "poc";
    } else {
      let projectResult = await pool.query(
        "SELECT project_id, original_filename, mime_type, file_data FROM project_attachments WHERE uuid = $1",
        [uuid]
      );
      if (projectResult.rows.length > 0) {
        attachment = projectResult.rows[0];
        entityType = "project";
      }
    }

    if (!attachment) {
      return res.status(404).json({ error: "Attachment not found." });
    }

    // 3. Log the download activity (asynchronously, no need to wait)
    if (entityType === "poc") {
      logPocActivity(
        pool, // Use the main pool for logging, no transaction needed for a GET
        attachment.poc_id,
        actorUserId,
        "ATTACHMENT_DOWNLOADED",
        { filename: attachment.original_filename }
      );
    } else if (entityType === "project") {
      logProjectActivity(
        pool,
        attachment.project_id,
        actorUserId,
        "ATTACHMENT_DOWNLOADED",
        { filename: attachment.original_filename }
      );
    }

    // 4. Send the file to the user
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${attachment.original_filename}"`
    );
    res.setHeader("Content-Type", attachment.mime_type);
    res.send(attachment.file_data);

  } catch (err) {
    console.error(`Error downloading attachment ${uuid}:`, err);
    res.status(500).json({ error: "Failed to download attachment." });
  }
});

export default router;
