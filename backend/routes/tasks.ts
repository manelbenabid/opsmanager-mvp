import express from "express";
import pool from "../db";
import { format } from "date-fns";

const router = express.Router();

const logActivity = async (
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

// GET all tasks for a specific project
router.get("/", async (req, res) => {
  const { projectId } = req.query;
  if (!projectId) {
    return res
      .status(400)
      .json({ error: "Missing required query parameter: projectId" });
  }

  try {
    const tasksQuery = `
            SELECT 
                t.*, 
                json_agg(json_build_object('id', e.id, 'name', e.first_name || ' ' || e.last_name)) 
                FILTER (WHERE e.id IS NOT NULL) AS assignees
            FROM project_tasks t
            LEFT JOIN task_assignees ta ON t.id = ta.task_id
            LEFT JOIN employees e ON ta.employee_id = e.id
            WHERE t.project_id = $1
            GROUP BY t.id
            ORDER BY t.created_at ASC;
        `;
    const tasksResult = await pool.query(tasksQuery, [projectId]);
    res.json(tasksResult.rows);
  } catch (err) {
    console.error(`Error fetching tasks for project ${projectId}:`, err);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// POST to create a new task
router.post("/", async (req, res) => {
  const actorUserId = req.user?.id;
  if (!actorUserId) {
    return res.status(403).json({ error: "User not authenticated." });
  }
  // Correctly destructure 'createdBy' instead of 'creatorId'
  const {
    projectId,
    taskName,
    parentTaskId,
    priority,
    dueDate,
    tags,
    assignees,
    createdBy,
  } = req.body;

  if (!projectId || !taskName) {
    return res
      .status(400)
      .json({ error: "projectId and taskName are required." });
  }

  // Also, ensure createdBy is provided, as the database requires it.
  if (createdBy === undefined) {
    return res.status(400).json({ error: "createdBy is a required field." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const newTaskResult = await client.query(
      `INSERT INTO project_tasks (project_id, task_name, parent_task_id, priority, due_date, tags, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id;`,
      // Use the correct 'createdBy' variable in the query parameters
      [
        projectId,
        taskName,
        parentTaskId || null,
        priority || "Normal",
        dueDate || null,
        tags || [],
        createdBy,
      ]
    );
    const newTaskId = newTaskResult.rows[0].id;

    // --- LOG TASK_CREATED ---
    let logDetails: { taskName: string; parentTaskName?: string } = {
      taskName,
    };
    if (parentTaskId) {
      const parentTaskRes = await client.query(
        "SELECT task_name FROM project_tasks WHERE id = $1",
        [parentTaskId]
      );
      if (parentTaskRes.rows.length > 0) {
        logDetails.parentTaskName = parentTaskRes.rows[0].task_name;
      }
    }
    await logActivity(
      client,
      projectId,
      actorUserId,
      "TASK_CREATED",
      logDetails
    );

    if (assignees && Array.isArray(assignees)) {
      for (const employeeId of assignees) {
        await client.query(
          "INSERT INTO task_assignees (task_id, employee_id) VALUES ($1, $2)",
          [newTaskId, employeeId]
        );
      }
    }
    await client.query("COMMIT");

    // Fetch the full task to return it
    const result = await pool.query(
      "SELECT * FROM project_tasks WHERE id = $1",
      [newTaskId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating task:", err);
    res.status(500).json({ error: "Failed to create task" });
  } finally {
    client.release();
  }
});

// PUT to update a task (e.g., change status, priority, etc.)
router.put("/:taskId", async (req, res) => {
  const actorUserId = req.user?.id;
  if (!actorUserId) {
    return res.status(403).json({ error: "User not authenticated." });
  }

  const { taskId } = req.params;
  const { status, priority, dueDate, tags, taskName, assignees } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // --- Fetch Original Task for Comparison ---
    const originalTaskRes = await client.query(
      `
      SELECT t.*, p.id as project_id 
      FROM project_tasks t 
      JOIN projects p ON t.project_id = p.id
      WHERE t.id = $1 FOR UPDATE`,
      [taskId]
    );
    if (originalTaskRes.rows.length === 0) {
      throw new Error("Task not found.");
    }
    const originalTask = originalTaskRes.rows[0];
    const projectId = originalTask.project_id; // Get projectId for logging

    // Helper to fetch employee names from an array of IDs for readable logs
    const getAssigneeNames = async (assigneeIds: number[]) => {
      if (!assigneeIds || assigneeIds.length === 0) return "None";
      const namesRes = await client.query(
        `SELECT first_name, last_name FROM employees WHERE id = ANY($1::int[])`,
        [assigneeIds]
      );
      return namesRes.rows
        .map((r) => `${r.first_name} ${r.last_name}`)
        .join(", ");
    };

    // Log Status Change
    if (status && status !== originalTask.status) {
      if (status === "Completed") {
        await logActivity(client, projectId, actorUserId, "TASK_COMPLETED", {
          taskName: originalTask.task_name,
        });
      } else {
        await logActivity(client, projectId, actorUserId, "TASK_UPDATED", {
          taskName: originalTask.task_name,
          field: "Status",
          from: originalTask.status,
          to: status,
        });
      }
    }

    // Log Task Name Change
    if (taskName && taskName !== originalTask.task_name) {
      await logActivity(client, projectId, actorUserId, "TASK_UPDATED", {
        taskName: originalTask.task_name,
        field: "Name",
        from: originalTask.task_name,
        to: taskName,
      });
    }

    // Log Priority Change
    if (priority && priority !== originalTask.priority) {
      await logActivity(client, projectId, actorUserId, "TASK_UPDATED", {
        taskName: originalTask.task_name,
        field: "Priority",
        from: originalTask.priority,
        to: priority,
      });
    }

    // Log Due Date Change
    const originalDueDate = originalTask.due_date
      ? format(new Date(originalTask.due_date), "yyyy-MM-dd")
      : null;
    if (dueDate !== undefined && dueDate !== originalDueDate) {
      await logActivity(client, projectId, actorUserId, "TASK_UPDATED", {
        taskName: originalTask.task_name,
        field: "Due Date",
        from: originalDueDate || "None",
        to: dueDate || "None",
      });
    }

    // Log Tags Change
    const originalTags = originalTask.tags || [];
    const newTags = tags || [];
    // Sort arrays to ensure consistent comparison
    if (
      JSON.stringify([...originalTags].sort()) !==
      JSON.stringify([...newTags].sort())
    ) {
      await logActivity(client, projectId, actorUserId, "TASK_UPDATED", {
        taskName: originalTask.task_name,
        field: "Tags",
        from: originalTags.join(", ") || "None",
        to: newTags.join(", ") || "None",
      });
    }

    // Log Assignees Change
    if (assignees && Array.isArray(assignees)) {
      const originalAssigneesRes = await client.query(
        "SELECT employee_id FROM task_assignees WHERE task_id = $1",
        [taskId]
      );
      const originalAssigneeIds = originalAssigneesRes.rows
        .map((r) => r.employee_id)
        .sort();
      const newAssigneeIds = [...assignees].sort();

      if (
        JSON.stringify(originalAssigneeIds) !== JSON.stringify(newAssigneeIds)
      ) {
        await logActivity(client, projectId, actorUserId, "TASK_UPDATED", {
          taskName: originalTask.task_name,
          field: "Assignees",
          from: await getAssigneeNames(originalAssigneeIds),
          to: await getAssigneeNames(newAssigneeIds),
        });
      }
    }

    const fields = [];
    const values = [];
    let queryIndex = 1;

    if (status !== undefined) {
      fields.push(`status = $${queryIndex++}`);
      values.push(status);
    }
    if (priority !== undefined) {
      fields.push(`priority = $${queryIndex++}`);
      values.push(priority);
    }
    if (dueDate !== undefined) {
      fields.push(`due_date = $${queryIndex++}`);
      values.push(dueDate);
    }
    if (tags !== undefined) {
      fields.push(`tags = $${queryIndex++}`);
      values.push(tags);
    }
    if (taskName !== undefined) {
      fields.push(`task_name = $${queryIndex++}`);
      values.push(taskName);
    }

    if (fields.length > 0) {
      values.push(taskId);
      const updateQuery = `UPDATE project_tasks SET ${fields.join(
        ", "
      )}, updated_at = NOW() WHERE id = $${queryIndex}`;
      await client.query(updateQuery, values);
    }

    // Reconcile assignees
    if (assignees && Array.isArray(assignees)) {
      await client.query("DELETE FROM task_assignees WHERE task_id = $1", [
        taskId,
      ]);
      for (const employeeId of assignees) {
        await client.query(
          "INSERT INTO task_assignees (task_id, employee_id) VALUES ($1, $2)",
          [taskId, employeeId]
        );
      }
    }

    await client.query("COMMIT");
    res.status(200).json({ message: "Task updated successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`Error updating task ${taskId}:`, err);
    res.status(500).json({ error: "Failed to update task" });
  } finally {
    client.release();
  }
});

// DELETE a task
router.delete("/:taskId", async (req, res) => {
  const actorUserId = req.user?.id;
  if (!actorUserId) {
    return res.status(403).json({ error: "User not authenticated." });
  }

  const { taskId } = req.params;
  const client = await pool.connect();

  // This query relies on the database schema having 'ON DELETE CASCADE' for
  // the 'parent_task_id' foreign key and for the 'task_id' in 'task_assignees'.
  // This ensures that deleting a parent task also deletes all its subtasks and assignments.
  try {
    await client.query("BEGIN");

    // Fetch task details before deleting for the log
    const taskRes = await client.query(
      "SELECT task_name, project_id FROM project_tasks WHERE id = $1",
      [taskId]
    );
    if (taskRes.rows.length > 0) {
      const { task_name, project_id } = taskRes.rows[0];
      await logActivity(client, project_id, actorUserId, "TASK_DELETED", {
        taskName: task_name,
      });
    }

    await client.query("DELETE FROM project_tasks WHERE id = $1", [taskId]);

    await client.query("COMMIT");
    res
      .status(200)
      .json({ message: "Task and its subtasks deleted successfully" });
  } catch (err) {
    console.error(`Error deleting task ${taskId}:`, err);
    res.status(500).json({ error: "Failed to delete task" });
  }
});

export default router;
