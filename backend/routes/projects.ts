import express from "express";
import pool from "../db"; // Ensure this path is correct
import { handleProTeamChangeNotifications } from "../services/notificationService";
import { format } from "date-fns";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";

// const UPLOADS_PATH = process.env.UPLOADS_DIR;

// if (!UPLOADS_PATH) {
//   console.error("FATAL ERROR: UPLOADS_DIR environment variable is not set.");
//   process.exit(1); // Exit if the path isn't configured
// }

// --- Configure Multer to use the absolute path ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    //cb(null, UPLOADS_PATH); // Use the absolute path
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = uuidv4();
    const extension = path.extname(file.originalname);
    cb(null, uniqueSuffix + extension);
  },
});
const upload = multer({ storage: storage });

const router = express.Router();

// --- Role Constants ---
const COMPANY_ROLE_LEAD = "Lead";
const COMPANY_ROLE_ACCOUNT_MANAGER = "Account Manager";
const COMPANY_ROLE_TECHNICAL_TEAM = "Technical Team";
const COMPANY_ROLE_PROJECT_MANAGER = "Project Manager";

const PROJECT_ROLE_TECHNICAL_LEAD = "Technical Lead";
const PROJECT_ROLE_ACCOUNT_MANAGER = "Account Manager";
const PROJECT_ROLE_PROJECT_MANAGER = "Project Manager";
const PROJECT_ROLE_LEAD_ENGINEER = "Lead Engineer";

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

// --- Helper Functions & Main Query ---

/**
 * Interface for a fully detailed project object, matching the expected frontend structure.
 */
interface TeamAssignmentMember {
  id: number; // project_employees.id
  projectId: number;
  employeeId: number;
  role: string;
  assignedAt: string;
  unassignedAt?: string | null;
  employee: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    jobTitle: string;
    role?: string; // Company role
  };
}

interface RawTask {
  id: number;
  project_id: number;
  parent_task_id: number | null;
  task_name: string;
  status: "Not Started" | "In Progress" | "Completed";
  created_at: string;
  updated_at: string;
  assignees: { id: number; name: string }[] | null;
}

// The Task object after nesting is added
interface NestedTask extends RawTask {
  subtasks: NestedTask[];
}

// The raw DB row from the aggregated query
interface ProjectDbRow {
  id: number;
  customer_id: number;
  title: string;
  technology: string;
  start_date: string;
  end_date: string | null;
  created_at: Date;
  updated_at: Date;
  status: string;
  customer_name: string;
  team_assignments: any[]; // Kept as any for simplicity, as it's complex
  status_history: any[]; // Kept as any for simplicity
  tasks: RawTask[] | null; // This is the key field to type correctly
}

/**
 * Maps a raw database row from our aggregated query into a clean, structured Project object.
 */
const mapProjectData = (dbRow: any) => {
  if (!dbRow) return null;

  // Extract key roles from the aggregated team_assignments array
  let lead, accountManager, projectManager;
  if (dbRow.team_assignments && Array.isArray(dbRow.team_assignments)) {
    lead = dbRow.team_assignments.find(
      (m: any) => m.role === PROJECT_ROLE_TECHNICAL_LEAD
    )?.employee;
    accountManager = dbRow.team_assignments.find(
      (m: any) => m.role === PROJECT_ROLE_ACCOUNT_MANAGER
    )?.employee;
    projectManager = dbRow.team_assignments.find(
      (m: any) => m.role === PROJECT_ROLE_PROJECT_MANAGER
    )?.employee;
  }

  // --- Nesting logic for tasks ---
  const flatTasks: RawTask[] = dbRow.tasks || [];
  const taskMap = new Map<number, NestedTask>(
    flatTasks.map((t) => [t.id, { ...t, subtasks: [] }])
  );
  const nestedTasks: NestedTask[] = [];
  for (const task of taskMap.values()) {
    if (task.parent_task_id && taskMap.has(task.parent_task_id)) {
      taskMap.get(task.parent_task_id)!.subtasks.push(task);
    } else {
      nestedTasks.push(task);
    }
  }

  return {
    id: dbRow.id,
    customerId: dbRow.customer_id,
    title: dbRow.title,
    technology: dbRow.technology,
    startDate: dbRow.start_date,
    endDate: dbRow.end_date,
    createdAt: dbRow.created_at,
    updatedAt: dbRow.updated_at,
    statuses: dbRow.statuses || [],

    customer: dbRow.customer_name
      ? { id: dbRow.customer_id, name: dbRow.customer_name }
      : undefined,
    lead,
    accountManager,
    projectManager,
    teamAssignments: dbRow.team_assignments || [],
    statusHistory: dbRow.status_history || [],
    tasks: nestedTasks,
    attachments: dbRow.attachments || [],
  };
};

/**
 * A robust, aggregated query to fetch a complete Project object by its ID.
 * It uses Common Table Expressions (CTEs) for clarity and performance, just like the projects.ts example.
 * NOTE: This assumes a 'project_employees' table exists with a similar structure to 'project_employees'.
 */
const getAggregatedProjectQueryById = `
   WITH ProjectBase AS (
    -- The 'status' column is removed from this part of the query
    SELECT p.id, p.customer_id, p.title, p.technology, p.start_date, p.end_date, p.created_at, p.updated_at, c.name AS customer_name
    FROM projects p
    JOIN customers c ON p.customer_id = c.id
    WHERE p.id = $1
  ),
  -- New CTE to aggregate all current statuses for the project into a single array
  CurrentStatuses AS (
    SELECT 
      project_id, 
      COALESCE(json_agg(status ORDER BY status), '[]'::json) as statuses
    FROM project_current_statuses
    WHERE project_id = $1
    GROUP BY project_id
  ),
  ProjectTeamDetails AS (
    SELECT
      pe.id AS assignment_id, pe.project_id, pe.employee_id, pe.role AS project_role, pe.assigned_at, pe.unassigned_at,
      e.id AS emp_id, e.first_name, e.last_name, e.email, e.job_title, e.role AS company_role
    FROM project_employees pe
    JOIN employees e ON pe.employee_id = e.id
    WHERE pe.project_id = $1 AND pe.unassigned_at IS NULL
  ),
  AggregatedTeam AS (
    SELECT
      ptd.project_id,
      json_agg(
        json_build_object(
          'id', ptd.assignment_id, 'projectId', ptd.project_id, 'employeeId', ptd.emp_id,
          'role', ptd.project_role, 'assignedAt', ptd.assigned_at, 'unassignedAt', ptd.unassigned_at,
          'employee', json_build_object(
            'id', ptd.emp_id, 'firstName', ptd.first_name, 'lastName', ptd.last_name,
            'email', ptd.email, 'jobTitle', ptd.job_title, 'role', ptd.company_role
          )
        )
      ) AS team_assignments
    FROM ProjectTeamDetails ptd
    GROUP BY ptd.project_id
  ),
  StatusHistory AS (
    SELECT
        psc.project_id,
        json_agg(
            json_build_object(
                'id', psc.id, 'status', psc.status, 'startedAt', psc.started_at, 'endedAt', psc.ended_at,
                'comments', (
                    SELECT COALESCE(json_agg(
                        json_build_object(
                            'id', pcomm.id, 'comment', pcomm.comment, 'createdAt', pcomm.created_at,
                            'author', json_build_object('id', auth.id, 'name', auth.first_name || ' ' || auth.last_name)
                        ) ORDER BY pcomm.created_at ASC
                    ), '[]'::json)
                    FROM project_comments pcomm JOIN employees auth ON pcomm.author_id = auth.id
                    WHERE pcomm.status_comment_id = psc.id
                )
            ) ORDER BY psc.started_at DESC
        ) AS status_history
    FROM project_status_comments psc WHERE psc.project_id = $1 GROUP BY psc.project_id
  ),
  ProjectTasks AS (
    SELECT 
      p.id as project_id,
      COALESCE(
        json_agg(
          json_build_object(
            'id', t.id, 'project_id', t.project_id, 'parent_task_id', t.parent_task_id,
            'task_name', t.task_name, 'status', t.status, 'created_at', t.created_at, 'updated_at', t.updated_at,
            'assignees', ta_agg.assignees
          ) ORDER BY t.created_at ASC
        ), '[]'::json
      ) as tasks
    FROM projects p
    LEFT JOIN project_tasks t ON p.id = t.project_id
    LEFT JOIN (
      SELECT 
        ta.task_id, 
        json_agg(json_build_object('id', e.id, 'name', e.first_name || ' ' || e.last_name)) as assignees
      FROM task_assignees ta JOIN employees e ON e.id = ta.employee_id GROUP BY ta.task_id
    ) ta_agg ON t.id = ta_agg.task_id
    WHERE p.id = $1
    GROUP BY p.id
  ),
    ProjectAttachments AS (
    SELECT
        pa.project_id,
        COALESCE(json_agg(
            json_build_object(
                'id', pa.id,
                'uuid', pa.uuid,
                'description', pa.description,
                'originalFilename', pa.original_filename,
                'mimeType', pa.mime_type,
                'fileSizeBytes', pa.file_size_bytes,
                'createdAt', pa.created_at,
                'uploadedBy', json_build_object('id', uploader.id, 'name', uploader.first_name || ' ' || uploader.last_name)
            ) ORDER BY pa.created_at DESC
        ), '[]'::json) AS attachments
    FROM project_attachments pa
    JOIN employees uploader ON pa.uploaded_by_id = uploader.id
    WHERE pa.project_id = $1
    GROUP BY pa.project_id
)
  SELECT 
    pb.*,
    cs.statuses, -- Add the new statuses array to the final selection
    at.team_assignments,
    sh.status_history,
    pt.tasks,
    p_att.attachments
  FROM ProjectBase pb
  LEFT JOIN CurrentStatuses cs ON pb.id = cs.project_id -- Join with the new CTE
  LEFT JOIN AggregatedTeam at ON pb.id = at.project_id
  LEFT JOIN StatusHistory sh ON pb.id = sh.project_id
  LEFT JOIN ProjectTasks pt ON pb.id = pt.project_id
  LEFT JOIN ProjectAttachments p_att ON pb.id = p_att.project_id;
`;

// --- ROUTE HANDLERS ---

// GET /api/projects (List View)
router.get("/", async (req, res) => {
  const { role, id: employeeId } = req.user || {};
  try {
    let query = `
      SELECT 
        p.id, p.title, p.technology, p.start_date, p.end_date, p.updated_at,
        c.name AS customer_name,
        pm.first_name || ' ' || pm.last_name AS project_manager_name,
        am.first_name || ' ' || am.last_name AS account_manager_name,
        tl.first_name || ' ' || tl.last_name AS technical_lead_name,
        COALESCE(
          (SELECT json_agg(pcs.status ORDER BY pcs.status) FROM project_current_statuses pcs WHERE pcs.project_id = p.id),
          '[]'::json
        ) as statuses
      FROM projects p
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN employees pm ON p.project_manager_id = pm.id
      LEFT JOIN employees am ON p.account_manager_id = am.id
      LEFT JOIN employees tl ON p.technical_lead_id = tl.id
    `;

    const queryParams = [];
    let whereClause = "";

    // Use a switch statement to apply role-specific filtering
    switch (role) {
      case 'Project Manager':
        queryParams.push(employeeId);
        whereClause = `WHERE p.project_manager_id = $1`;
        break;
      
      case 'Account Manager':
        queryParams.push(employeeId);
        whereClause = `WHERE p.account_manager_id = $1`;
        break;

      case 'Lead':
        queryParams.push(employeeId);
        whereClause = `WHERE p.technical_lead_id = $1`;
        break;
      
      case 'Technical Team':
        queryParams.push(employeeId);
        // Find projects where the user is assigned in ANY capacity
        whereClause = `WHERE p.id IN (
          SELECT project_id FROM project_employees 
          WHERE employee_id = $1 AND unassigned_at IS NULL
        )`;
        break;
      
      // 'admin' (or any other role) will not have a WHERE clause and will see all projects
      default:
        break;
    }

    query += whereClause;
    query += ' ORDER BY p.updated_at DESC;';

    const result = await pool.query(query, queryParams);
    // This is a simplified mapping for the list view, not the full detail view object
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching projects list:", err);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

// GET /api/projects/:id (Detail View)
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(getAggregatedProjectQueryById, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }
    res.json(mapProjectData(result.rows[0]));
  } catch (err) {
    console.error(`Error fetching project ${id}:`, err);
    res.status(500).json({ error: "Failed to fetch project details" });
  }
});

// POST /api/projects (Create)
router.post("/", async (req, res) => {
  const actorUserId = req.user?.id; // Assumes your middleware provides this
  if (!actorUserId) {
    return res
      .status(403)
      .json({ error: "User not authenticated or user ID not found." });
  }

  const {
    customerId,
    title,
    technology,
    startDate,
    endDate,
    statuses,
    technicalLeadId,
    accountManagerId,
    projectManagerId,
    initialTeamAssignments,
    sourcePocId,
  } = req.body;

  if (
    !customerId ||
    !title ||
    !startDate ||
    !statuses ||
    !Array.isArray(statuses) ||
    statuses.length === 0 ||
    !accountManagerId ||
    !projectManagerId ||
    !technology || !Array.isArray(technology) || technology.length === 0
  ) {
    return res.status(400).json({
      error: "Missing required project fields, including at least one status.",
    });
  }



  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    // Role validation for key members
    const pmEmpRes = await client.query(
      "SELECT role FROM employees WHERE id = $1",
      [projectManagerId]
    );
    if (
      pmEmpRes.rows.length === 0 ||
      pmEmpRes.rows[0].role !== COMPANY_ROLE_PROJECT_MANAGER
    ) {
      throw new Error(
        `Selected Project Manager (ID: ${projectManagerId}) must have company role '${COMPANY_ROLE_PROJECT_MANAGER}'.`
      );
    }

    const amEmpRes = await client.query(
      "SELECT role FROM employees WHERE id = $1",
      [accountManagerId]
    );
    if (
      amEmpRes.rows.length === 0 ||
      amEmpRes.rows[0].role !== COMPANY_ROLE_ACCOUNT_MANAGER
    ) {
      throw new Error(
        `Selected Account Manager (ID: ${accountManagerId}) must have company role '${COMPANY_ROLE_ACCOUNT_MANAGER}'.`
      );
    }

    const projectResult = await client.query(
      `INSERT INTO projects (
        customer_id, title, technology, start_date, end_date, 
        account_manager_id, technical_lead_id, source_poc_id, project_manager_id
      ) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING id, title`,
      [
        customerId,
        title,
        technology,
        startDate,
        endDate,
        accountManagerId,
        technicalLeadId || null,
        sourcePocId,
        projectManagerId,
      ]
    );
    const newProjectId = projectResult.rows[0].id;
    const newProjectTitle = projectResult.rows[0].title;

    // --- LOG PROJECT_CREATED ---
    await logActivity(client, newProjectId, actorUserId, "PROJECT_CREATED", {
      title: newProjectTitle,
    });

    if (technicalLeadId) {
      const leadDetails = await client.query(
        "SELECT first_name, last_name FROM employees WHERE id = $1",
        [technicalLeadId]
      );
      if (leadDetails.rows.length > 0) {
        const leadName = `${leadDetails.rows[0].first_name} ${leadDetails.rows[0].last_name}`;
        await logActivity(client, newProjectId, actorUserId, "LEAD_ASSIGNED", {
          from: "None",
          to: leadName,
        });
      }
    }

    // Log Customer
    const customerResult = await client.query(
      "SELECT name FROM customers WHERE id = $1",
      [customerId]
    );
    const customerName = customerResult.rows[0]?.name || "Unknown";
    await logActivity(client, newProjectId, actorUserId, "FIELD_UPDATED", {
      field: "Customer",
      from: "None",
      to: customerName,
    });

    // Log Technology
    await logActivity(client, newProjectId, actorUserId, "FIELD_UPDATED", {
      field: "Technology",
      from: "None",
      to: technology,
    });

    // Log Initial Statuses
    if (statuses && statuses.length > 0) {
      await logActivity(client, newProjectId, actorUserId, "STATUS_UPDATED", {
        from: "None",
        to: statuses,
      });
    }

    // Log Start Date
    await logActivity(client, newProjectId, actorUserId, "FIELD_UPDATED", {
      field: "Start Date",
      from: "None",
      to: startDate,
    });

    // Log End Date only if it was provided
    if (endDate) {
      await logActivity(client, newProjectId, actorUserId, "FIELD_UPDATED", {
        field: "Target End Date",
        from: "None",
        to: endDate,
      });
    }

    for (const status of statuses) {
      // Add to the current status table
      await client.query(
        `INSERT INTO project_current_statuses (project_id, status) VALUES ($1, $2)`,
        [newProjectId, status]
      );
      // Add to the history log
      await client.query(
        `INSERT INTO project_status_comments (project_id, started_at, status) VALUES ($1, NOW(), $2)`,
        [newProjectId, status]
      );
    }

    // Insert key roles into the project_employees table for consistency
    await client.query(
      "INSERT INTO project_employees (project_id, employee_id, role, assigned_at) VALUES ($1, $2, $3, $4)",
      [newProjectId, projectManagerId, PROJECT_ROLE_PROJECT_MANAGER, startDate]
    );
    await client.query(
      "INSERT INTO project_employees (project_id, employee_id, role, assigned_at) VALUES ($1, $2, $3, $4)",
      [newProjectId, accountManagerId, PROJECT_ROLE_ACCOUNT_MANAGER, startDate]
    );

    // Only insert the Technical Lead assignment if a technicalLeadId was provided.
    if (technicalLeadId) {
      await client.query(
        "INSERT INTO project_employees (project_id, employee_id, role, assigned_at) VALUES ($1, $2, $3, $4)",
        [newProjectId, technicalLeadId, PROJECT_ROLE_TECHNICAL_LEAD, startDate]
      );
    }

    // Insert dynamic engineering team members
    if (initialTeamAssignments && Array.isArray(initialTeamAssignments)) {
      let leadEngineerAssigned = false;
      for (const assignment of initialTeamAssignments) {
        if (assignment.employeeId && assignment.role) {
          if (
            assignment.employeeId === technicalLeadId ||
            assignment.employeeId === accountManagerId ||
            assignment.employeeId === projectManagerId
          )
            continue;
          const teamMemberRes = await client.query(
            "SELECT role FROM employees WHERE id = $1",
            [assignment.employeeId]
          );
          if (
            teamMemberRes.rows.length === 0 ||
            teamMemberRes.rows[0].role !== COMPANY_ROLE_TECHNICAL_TEAM
          ) {
            console.warn(
              `Skipping team assignment for employee ${assignment.employeeId} to Project ${newProjectId} with role ${assignment.role}: Not part of ${COMPANY_ROLE_TECHNICAL_TEAM}.`
            );
            continue;
          }
          if (assignment.role === PROJECT_ROLE_LEAD_ENGINEER) {
            if (leadEngineerAssigned) {
              await client.query("ROLLBACK");
              return res
                .status(400)
                .json({ error: "A Project can only have one Lead Engineer." });
            }
            leadEngineerAssigned = true;
          }
          const assignDate = assignment.assignedAt
            ? new Date(assignment.assignedAt).toISOString().split("T")[0]
            : new Date(startDate).toISOString().split("T")[0];
          await client.query(
            "INSERT INTO project_employees (project_id, employee_id, role, assigned_at) VALUES ($1, $2, $3, $4)",
            [newProjectId, assignment.employeeId, assignment.role, assignDate]
          );
        }
      }
    }

    // await client.query(`INSERT INTO project_status_comments (project_id, started_at, status) VALUES ($1, NOW(), $2)`, [newProjectId, status]);

    await client.query("COMMIT");

    // Fetch the full, newly created project to return
    const createdProjectResult = await pool.query(
      getAggregatedProjectQueryById,
      [newProjectId]
    );
    if (createdProjectResult.rows.length === 0) {
      return res.status(500).json({
        error: "Failed to retrieve created PROJECT details after creation.",
      });
    }
    res.status(201).json(mapProjectData(createdProjectResult.rows[0]));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating project:", err);
    res.status(500).json({ error: "Database error during project creation." });
  } finally {
    client.release();
  }
});

// PUT /api/projects/:id (Update)
router.put("/:id", async (req, res) => {
  const actorUserId = req.user?.id;
  if (!actorUserId) {
    return res.status(403).json({ error: "User not authenticated." });
  }
  const { id } = req.params;
  const projectId = parseInt(id, 10);
  if (isNaN(projectId))
    return res.status(400).json({ error: "Invalid Project ID format." });

  const {
    title,
    technology,
    statuses,
    startDate,
    endDate,
    technicalLeadId,
    projectManagerId,
    teamAssignments: newAssignments,
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // --- Fetch Original Data for Comparison ---
    const originalProjectRes = await client.query(
      "SELECT * FROM projects WHERE id = $1 FOR UPDATE",
      [projectId]
    );
    if (originalProjectRes.rows.length === 0) {
      throw new Error("Project not found.");
    }
    const originalProject = originalProjectRes.rows[0];

    // --- LOG FIELD UPDATES ---
    const updatedFields: { field: string; from: any; to: any }[] = [];
    if (title !== undefined && title !== originalProject.title) {
      updatedFields.push({
        field: "Title",
        from: originalProject.title,
        to: title,
      });
    }
    if (technology !== undefined && (!Array.isArray(technology) || technology.length === 0)) {
      return res.status(400).json({ error: "'technology' must be a non-empty array." });
   }
 
   // LOG FIELD_UPDATED for technology
   if (technology !== undefined && JSON.stringify(technology) !== JSON.stringify(originalProject.technology)) {
       updatedFields.push({
           field: "Technology",
           from: originalProject.technology,
           to: technology,
       });
   }
    if (
      startDate !== undefined &&
      format(new Date(startDate), "yyyy-MM-dd") !==
        format(new Date(originalProject.start_date), "yyyy-MM-dd")
    ) {
      updatedFields.push({
        field: "Start Date",
        from: format(new Date(originalProject.start_date), "yyyy-MM-dd"),
        to: startDate,
      });
    }
    if (
      endDate !== undefined &&
      format(new Date(endDate), "yyyy-MM-dd") !==
        (originalProject.end_date
          ? format(new Date(originalProject.end_date), "yyyy-MM-dd")
          : null)
    ) {
      updatedFields.push({
        field: "Target End Date",
        from: originalProject.end_date,
        to: endDate,
      });
    }
    for (const update of updatedFields) {
      await logActivity(
        client,
        projectId,
        actorUserId,
        "FIELD_UPDATED",
        update
      );
    }

    // --- LOG STATUS UPDATES ---
    if (statuses && Array.isArray(statuses)) {
      const originalStatusesRes = await client.query(
        "SELECT status FROM project_current_statuses WHERE project_id = $1",
        [projectId]
      );
      const originalStatusSet = new Set(
        originalStatusesRes.rows.map((r) => r.status)
      );
      const newStatusSet = new Set(statuses);
      if (
        originalStatusSet.size !== newStatusSet.size ||
        ![...originalStatusSet].every((s) => newStatusSet.has(s))
      ) {
        await logActivity(client, projectId, actorUserId, "STATUS_UPDATED", {
          from: [...originalStatusSet],
          to: [...newStatusSet],
        });
      }
    }

    // --- LOG PM and LEAD CHANGES ---
    const getEmployeeName = async (employeeId: number) => {
      if (!employeeId) return "None";
      const res = await client.query(
        "SELECT first_name, last_name FROM employees WHERE id = $1",
        [employeeId]
      );
      return res.rows[0]
        ? `${res.rows[0].first_name} ${res.rows[0].last_name}`
        : "Unknown User";
    };

    if (
      projectManagerId !== undefined &&
      projectManagerId !== originalProject.project_manager_id
    ) {
      await logActivity(client, projectId, actorUserId, "PM_ASSIGNED", {
        from: await getEmployeeName(originalProject.project_manager_id),
        to: await getEmployeeName(projectManagerId),
      });
    }
    if (
      technicalLeadId !== undefined &&
      technicalLeadId !== originalProject.technical_lead_id
    ) {
      await logActivity(client, projectId, actorUserId, "LEAD_ASSIGNED", {
        from: await getEmployeeName(originalProject.technical_lead_id),
        to: await getEmployeeName(technicalLeadId),
      });
    }

    // --- LOG TEAM MEMBER CHANGES ---
    if (newAssignments !== undefined && Array.isArray(newAssignments)) {
      const originalAssignmentsRes = await client.query(
        `SELECT pe.employee_id, pe.role, e.first_name, e.last_name FROM project_employees pe JOIN employees e ON pe.employee_id = e.id WHERE pe.project_id = $1 AND pe.unassigned_at IS NULL AND pe.role NOT IN ($2, $3, $4)`,
        [projectId, "Technical Lead", "Account Manager", "Project Manager"]
      );
      const originalTeam = originalAssignmentsRes.rows.map((r) => ({
        employeeId: r.employee_id,
        role: r.role,
        name: `${r.first_name} ${r.last_name}`,
      }));
      const newTeamMap = new Map(newAssignments.map((a) => [a.employeeId, a]));
      const originalTeamMap = new Map(
        originalTeam.map((a) => [a.employeeId, a])
      );

      for (const member of originalTeam) {
        if (!newTeamMap.has(member.employeeId)) {
          await logActivity(
            client,
            projectId,
            actorUserId,
            "TEAM_MEMBER_UNASSIGNED",
            { member: member.name, role: member.role }
          );
        }
      }
      for (const member of newAssignments) {
        if (!originalTeamMap.has(member.employeeId)) {
          await logActivity(
            client,
            projectId,
            actorUserId,
            "TEAM_MEMBER_ASSIGNED",
            {
              member: await getEmployeeName(member.employeeId),
              role: member.role,
            }
          );
        }
      }
    }

    let originalAssignments: any[] = [];
    if (newAssignments !== undefined) {
      const originalAssignmentsResult = await client.query(
        `SELECT employee_id as "employeeId", role FROM project_employees WHERE project_id = $1 AND unassigned_at IS NULL AND role NOT IN ($2, $3, $4)`,
        [
          projectId,
          PROJECT_ROLE_TECHNICAL_LEAD,
          PROJECT_ROLE_ACCOUNT_MANAGER,
          PROJECT_ROLE_PROJECT_MANAGER,
        ]
      );
      originalAssignments = originalAssignmentsResult.rows;
    }

    const projectUpdateFields = [];
    const projectValues = [];
    let queryIndex = 1;

    if (title !== undefined) {
      projectUpdateFields.push(`title = $${queryIndex++}`);
      projectValues.push(title);
    }
    if (technology !== undefined) {
      projectUpdateFields.push(`technology = $${queryIndex++}`);
      projectValues.push(technology);
    }
    if (startDate !== undefined) {
      projectUpdateFields.push(`start_date = $${queryIndex++}`);
      projectValues.push(startDate);
    }
    if (endDate !== undefined) {
      projectUpdateFields.push(`end_date = $${queryIndex++}`);
      projectValues.push(endDate);
    }
    if (technicalLeadId !== undefined) {
      projectUpdateFields.push(`technical_lead_id = $${queryIndex++}`);
      projectValues.push(technicalLeadId);
    }
    if (projectManagerId !== undefined) {
      projectUpdateFields.push(`project_manager_id = $${queryIndex++}`);
      projectValues.push(projectManagerId);
    }

    let mainProjectUpdated = false;

    if (projectUpdateFields.length > 0) {
      projectUpdateFields.push(`updated_at = NOW()`);
      projectValues.push(projectId);
      const updateResult = await client.query(
        `UPDATE projects SET ${projectUpdateFields.join(
          ", "
        )} WHERE id = $${queryIndex} RETURNING id`,
        projectValues
      );
      if (updateResult.rowCount && updateResult.rowCount > 0) {
        mainProjectUpdated = true;
      } else if (projectUpdateFields.length > 1) {
        // Only error if we tried to update more than just 'updated_at' and nothing changed
        await client.query("ROLLBACK");
        return res.status(404).json({
          error:
            "Project not found or no direct fields were updated, leading to no change.",
        });
      }
    }
    // --- Status Update Logic ---
    let statusChanged = false;
    if (statuses && Array.isArray(statuses)) {
      // 1. End all previously active status history records
      await client.query(
        `UPDATE project_status_comments SET ended_at = NOW() 
              WHERE project_id = $1 AND ended_at IS NULL`,
        [projectId]
      );

      // 2. Create new history records for the new set of active statuses
      for (const status of statuses) {
        await client.query(
          `INSERT INTO project_status_comments (project_id, status, started_at) 
                  VALUES ($1, $2, NOW())`,
          [projectId, status]
        );
      }

      // 3. Update the 'project_current_statuses' join table to reflect the new state
      await client.query(
        "DELETE FROM project_current_statuses WHERE project_id = $1",
        [projectId]
      );
      for (const status of statuses) {
        await client.query(
          `INSERT INTO project_current_statuses (project_id, status) VALUES ($1, $2)`,
          [projectId, status]
        );
      }
      statusChanged = true;
    }

    if (
      technicalLeadId !== undefined &&
      !isNaN(parseInt(technicalLeadId, 10))
    ) {
      const newLeadIdNum = parseInt(technicalLeadId, 10);
      const leadEmpRes = await client.query(
        "SELECT role FROM employees WHERE id = $1",
        [newLeadIdNum]
      );
      if (
        leadEmpRes.rows.length === 0 ||
        leadEmpRes.rows[0].role !== COMPANY_ROLE_LEAD
      ) {
        throw new Error(
          `New Technical Lead (ID: ${newLeadIdNum}) must have company role '${COMPANY_ROLE_LEAD}'.`
        );
      }
      await client.query(
        `UPDATE project_employees SET unassigned_at = NOW() WHERE project_id = $1 AND role = $2 AND unassigned_at IS NULL AND employee_id != $3`,
        [projectId, PROJECT_ROLE_TECHNICAL_LEAD, newLeadIdNum]
      );
      const existingLead = await client.query(
        `SELECT id FROM project_employees WHERE project_id = $1 AND employee_id = $2 AND role = $3 AND unassigned_at IS NULL`,
        [projectId, newLeadIdNum, PROJECT_ROLE_TECHNICAL_LEAD]
      );
      if (existingLead.rows.length === 0) {
        await client.query(
          "INSERT INTO project_employees (project_id, employee_id, role, assigned_at) VALUES ($1, $2, $3, NOW())",
          [projectId, newLeadIdNum, PROJECT_ROLE_TECHNICAL_LEAD]
        );
      }
    }

    if (
      projectManagerId !== undefined &&
      !isNaN(parseInt(projectManagerId, 10))
    ) {
      const newPmIdNum = parseInt(projectManagerId, 10);
      const pmEmpRes = await client.query(
        "SELECT role FROM employees WHERE id = $1",
        [newPmIdNum]
      );
      if (
        pmEmpRes.rows.length === 0 ||
        pmEmpRes.rows[0].role !== COMPANY_ROLE_PROJECT_MANAGER
      ) {
        throw new Error(
          `New Project Manager (ID: ${newPmIdNum}) must have company role '${COMPANY_ROLE_PROJECT_MANAGER}'.`
        );
      }
      await client.query(
        `UPDATE project_employees SET unassigned_at = NOW() WHERE project_id = $1 AND role = $2 AND unassigned_at IS NULL AND employee_id != $3`,
        [projectId, PROJECT_ROLE_PROJECT_MANAGER, newPmIdNum]
      );
      const existingPm = await client.query(
        `SELECT id FROM project_employees WHERE project_id = $1 AND employee_id = $2 AND role = $3 AND unassigned_at IS NULL`,
        [projectId, newPmIdNum, PROJECT_ROLE_PROJECT_MANAGER]
      );
      if (existingPm.rows.length === 0) {
        await client.query(
          "INSERT INTO project_employees (project_id, employee_id, role, assigned_at) VALUES ($1, $2, $3, NOW())",
          [projectId, newPmIdNum, PROJECT_ROLE_PROJECT_MANAGER]
        );
      }
    }

    // if (statusChanged) {
    //   await client.query( `UPDATE project_status_comments SET ended_at = NOW() WHERE project_id = $1 AND ended_at IS NULL AND status != $2`, [projectId, status] );
    //   await client.query( 'INSERT INTO project_status_comments (project_id, started_at, status, ended_at) VALUES ($1, NOW(), $2, NULL)', [projectId, status] );
    //   mainProjectUpdated = true;
    // }

    if (
      !mainProjectUpdated &&
      !statusChanged &&
      technicalLeadId === undefined
    ) {
      // No actual data fields were sent for update
      await client.query("ROLLBACK"); // Or COMMIT if you want updated_at to change anyway
      const currentProjectResult = await pool.query(
        getAggregatedProjectQueryById,
        [
          projectId,
          PROJECT_ROLE_TECHNICAL_LEAD,
          PROJECT_ROLE_ACCOUNT_MANAGER,
          PROJECT_ROLE_LEAD_ENGINEER,
        ]
      );
      if (currentProjectResult.rows.length === 0)
        return res.status(404).json({ error: "Project not found" });
      return res.json(mapProjectData(currentProjectResult.rows[0]));
    }

    // Reconcile all team assignments in 'project_employees' table
    // adding segment to send change email notifications
    if (newAssignments !== undefined && Array.isArray(newAssignments)) {
      const newAssignmentMap = new Map(
        newAssignments.map((a) => [a.employeeId, a])
      );
      const originalAssignmentMap = new Map(
        originalAssignments.map((a) => [a.employeeId, a])
      );

      // 1. Find and handle members to be removed (unassigned)
      for (const orig of originalAssignments) {
        if (!newAssignmentMap.has(orig.employeeId)) {
          console.log(
            `Unassigning employee ${orig.employeeId} from Project ${projectId}`
          );
          await client.query(
            "UPDATE project_employees SET unassigned_at = NOW() WHERE project_id = $1 AND employee_id = $2 AND unassigned_at IS NULL",
            [projectId, orig.employeeId]
          );
        }
      }

      // 2. Find and handle new or updated members
      for (const newAssign of newAssignments) {
        const origAssign = originalAssignmentMap.get(newAssign.employeeId);
        if (!origAssign) {
          // This is a new assignment
          console.log(
            `Assigning new employee ${newAssign.employeeId} to project ${projectId}`
          );
          await client.query(
            "INSERT INTO project_employees (project_id, employee_id, role, assigned_at) VALUES ($1, $2, $3, NOW())",
            [projectId, newAssign.employeeId, newAssign.role]
          );
        } else if (origAssign.role !== newAssign.role) {
          // This is an existing assignment with a role change
          console.log(
            `Updating role for employee ${newAssign.employeeId} on project ${projectId} to ${newAssign.role}`
          );
          await client.query(
            "UPDATE project_employees SET role = $1 WHERE project_id = $2 AND employee_id = $3 AND unassigned_at IS NULL",
            [newAssign.role, projectId, newAssign.employeeId]
          );
        }
        // If they exist in both and the role is the same, do nothing.
      }
    }

    await client.query("COMMIT");

    if (newAssignments !== undefined && technicalLeadId) {
      handleProTeamChangeNotifications(
        projectId,
        originalAssignments,
        newAssignments,
        technicalLeadId
      ).catch((err) =>
        console.error("Team change notification failed to send:", err)
      );
    }

    const updatedProjectResult = await pool.query(
      getAggregatedProjectQueryById,
      [projectId]
    );
    if (updatedProjectResult.rows.length === 0)
      return res.status(404).json({ error: "Project not found after update." });
    res.json(mapProjectData(updatedProjectResult.rows[0]));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`Error updating project ${id}:`, err);
    res.status(500).json({ error: "Database error during project update." });
  } finally {
    client.release();
  }
});

// DELETE /api/projects/:id
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const projectId = parseInt(id, 10);
  if (isNaN(projectId)) {
    return res.status(400).json({ error: "Invalid Project ID format." });
  }

  try {
    // Call the custom database function to handle archival and deletion
    const result = await pool.query(
      "SELECT archive_and_delete_project($1) AS message",
      [projectId]
    );
    const responseMessage = result.rows[0].message;

    // Check the message returned by the function for handled errors
    if (responseMessage.startsWith("ERROR: Not Found")) {
      return res.status(404).json({ error: "Project not found" });
    }
    if (responseMessage.startsWith("ERROR:")) {
      // Throw an error to be caught by the catch block for logging
      throw new Error(responseMessage);
    }

    // On success, return the success message from the function
    res.status(200).json({ message: responseMessage });
  } catch (err) {
    console.error(`Error in project delete function for ID ${projectId}:`, err);
    const errorMessage =
      err instanceof Error
        ? err.message
        : "An unknown database error occurred.";
    res
      .status(500)
      .json({ error: "Database function call failed", details: errorMessage });
  }
});

router.post(
  "/:id/attachments",
  upload.single("file"), // 'file' must match the name in FormData
  async (req, res) => {
    const actorUserId = req.user?.id;
    if (!actorUserId) {
      return res.status(403).json({ error: "User not authenticated." });
    }

    const { id: projectId } = req.params;
    const { description } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded." });
    }
    if (!description) {
      return res.status(400).json({ error: "Description is required." });
    }

    try {
      await pool.query("BEGIN");
      const result = await pool.query(
        `INSERT INTO project_attachments (project_id, uploaded_by_id, description, original_filename, stored_filename, mime_type, file_size_bytes)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING id, uuid, description, original_filename, mime_type, file_size_bytes, created_at`,
        [
          projectId,
          actorUserId,
          description,
          file.originalname,
          file.filename,
          file.mimetype,
          file.size,
        ]
      );

      // Log the upload activity
      await logActivity(
        pool,
        parseInt(projectId),
        actorUserId,
        "ATTACHMENT_UPLOADED",
        {
          filename: file.originalname,
        }
      );

      await pool.query("COMMIT");

      // Return the newly created attachment metadata
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Error uploading Project attachment:", err);
      res.status(500).json({ error: "Database error during file upload." });
    }
  }
);

export default router;
