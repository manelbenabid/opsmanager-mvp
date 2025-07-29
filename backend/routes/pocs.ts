import express from "express";
import pool from "../db"; // Ensure this path is correct
import {
  sendPoCRequestNotifications,
  sendPoCApprovalNotifications,
  handlePocTeamChangeNotifications,
} from "../services/notificationService"; // Import the new service
import { format } from "date-fns";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";

// const UPLOADS_PATH = process.env.UPLOADS_DIR;
// if (!UPLOADS_PATH) {
//   console.error("FATAL ERROR: UPLOADS_DIR environment variable is not set.");
//   process.exit(1); // Exit if the path isn't configured
// }

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- Role Constants ---
// Company Roles (from employee_role_enum)
const COMPANY_ROLE_LEAD = "Lead";
const COMPANY_ROLE_ACCOUNT_MANAGER = "Account Manager";
const COMPANY_ROLE_TECHNICAL_TEAM = "Technical Team";

// PoC Specific Roles (from poc_employee_role_enum)
const POC_ROLE_TECHNICAL_LEAD = "Technical Lead";
const POC_ROLE_ACCOUNT_MANAGER = "Account Manager";
const POC_ROLE_LEAD_ENGINEER = "Lead Engineer";
const POC_ROLE_SUPPORTING_ENGINEER = "Supporting Engineer";

const logActivity = async (
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

// Interface for the structure of items within the team_assignments array
interface TeamAssignmentMember {
  id: number; // poc_employees.id
  pocId: number;
  employeeId: number;
  role: string;
  assignedAt: string; // Date string
  unassignedAt?: string | null; // Date string or null
  employee: {
    // Nested employee details
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    jobTitle: string;
    role?: string; // Company role
  };
}

// Helper to map a single DB row to a more frontend-friendly PoC object
const mapPocData = (dbRow: any) => {
  if (!dbRow) return null;

  let lead, accountManager, leadId, accountManagerId;

  if (dbRow.team_assignments && Array.isArray(dbRow.team_assignments)) {
    const leadAssignment = (
      dbRow.team_assignments as TeamAssignmentMember[]
    ).find(
      (member: TeamAssignmentMember) =>
        member.role === POC_ROLE_TECHNICAL_LEAD && !member.unassignedAt
    );
    if (leadAssignment && leadAssignment.employee) {
      lead = leadAssignment.employee;
      leadId = leadAssignment.employeeId;
    }

    const amAssignment = (
      dbRow.team_assignments as TeamAssignmentMember[]
    ).find(
      (member: TeamAssignmentMember) =>
        member.role === POC_ROLE_ACCOUNT_MANAGER && !member.unassignedAt
    );
    if (amAssignment && amAssignment.employee) {
      accountManager = amAssignment.employee;
      accountManagerId = amAssignment.employeeId;
    }
  }

  return {
    id: dbRow.id,
    customerId: dbRow.customer_id,
    title: dbRow.title,
    technology: dbRow.technology,
    startDate: dbRow.start_date,
    endDate: dbRow.end_date,
    lastComment: dbRow.last_comment,
    createdAt: dbRow.created_at,
    updatedAt: dbRow.updated_at,
    status: dbRow.status,

    customer: dbRow.customer_name
      ? {
          id: dbRow.customer_id,
          name: dbRow.customer_name,
        }
      : undefined,

    leadId: leadId || dbRow.derived_lead_id,
    lead:
      lead ||
      (dbRow.lead_first_name
        ? {
            id: dbRow.derived_lead_id,
            firstName: dbRow.lead_first_name,
            lastName: dbRow.lead_last_name,
            email: dbRow.lead_email,
            jobTitle: dbRow.lead_job_title,
          }
        : undefined),

    accountManagerId: accountManagerId || dbRow.derived_am_id,
    accountManager:
      accountManager ||
      (dbRow.am_first_name
        ? {
            id: dbRow.derived_am_id,
            firstName: dbRow.am_first_name,
            lastName: dbRow.am_last_name,
            email: dbRow.am_email,
            jobTitle: dbRow.am_job_title,
          }
        : undefined),

    teamAssignments: (dbRow.team_assignments || []) as TeamAssignmentMember[],
    statusHistory: dbRow.status_history || [],
    attachments: dbRow.attachments || [],
    workflow_status: dbRow.workflow_status,
    isBudgetAllocated: dbRow.is_budget_allocated,
    isVendorAware: dbRow.is_vendor_aware,
    description: dbRow.description,
  };
};

const getAggregatedPocQueryById = `
WITH PocBase AS (
    SELECT 
        p.id, p.customer_id, p.title, p.technology, p.start_date, p.end_date, 
        p.last_comment, p.created_at, p.updated_at, p.status, p.workflow_status,
        p.is_budget_allocated,
        p.is_vendor_aware, 
        p.description,    
        cust.name AS customer_name
    FROM pocs p JOIN customers cust ON p.customer_id = cust.id WHERE p.id = $1
), PocTeamDetailsGlobal AS (
    SELECT pe.id AS assignment_id, pe.poc_id, pe.employee_id, pe.role AS poc_role, pe.assigned_at, pe.unassigned_at,
           e.id AS emp_id, e.first_name, e.last_name, e.email, e.job_title, e.role AS company_role 
    FROM poc_employees pe JOIN employees e ON pe.employee_id = e.id WHERE pe.poc_id = $1
  ), AggregatedTeam AS (
    SELECT ptd.poc_id, COALESCE(json_agg(json_build_object('id', ptd.assignment_id, 'pocId', ptd.poc_id, 'employeeId', ptd.emp_id, 'role', ptd.poc_role, 'assignedAt', ptd.assigned_at, 'unassignedAt', ptd.unassigned_at,
        'employee', json_build_object('id', ptd.emp_id, 'firstName', ptd.first_name, 'lastName', ptd.last_name, 'email', ptd.email, 'jobTitle', ptd.job_title, 'role', ptd.company_role))
         ORDER BY CASE ptd.poc_role WHEN $2 THEN 1 WHEN $3 THEN 2 WHEN $4 THEN 3 ELSE 4 END, ptd.first_name), '[]'::json) AS team_assignments
    FROM PocTeamDetailsGlobal ptd GROUP BY ptd.poc_id
  ), PocLeadInfo AS (
    SELECT emp_id AS derived_lead_id, first_name AS lead_first_name, last_name AS lead_last_name, email AS lead_email, job_title AS lead_job_title
    FROM PocTeamDetailsGlobal WHERE poc_role = $2 AND unassigned_at IS NULL LIMIT 1
  ), PocAmInfo AS (
    SELECT emp_id AS derived_am_id, first_name AS am_first_name, last_name AS am_last_name, email AS am_email, job_title AS am_job_title
    FROM PocTeamDetailsGlobal WHERE poc_role = $3 AND unassigned_at IS NULL LIMIT 1
  ), StatusHistory AS (
    SELECT psc.poc_id, COALESCE(json_agg(json_build_object('id', psc.id, 'pocId', psc.poc_id, 'startedAt', psc.started_at, 'endedAt', psc.ended_at, 'status', psc.status,
        'comments', (SELECT COALESCE(json_agg(json_build_object('id', pcomm.id, 'statusCommentId', pcomm.status_comment_id, 'authorId', pcomm.author_id, 'comment', pcomm.comment, 'createdAt', pcomm.created_at,
            'author', json_build_object('id', auth.id, 'name', auth.first_name || ' ' || auth.last_name, 'email', auth.email)) ORDER BY pcomm.created_at ASC), '[]'::json)
                     FROM poc_comments pcomm JOIN employees auth ON pcomm.author_id = auth.id WHERE pcomm.status_comment_id = psc.id))
         ORDER BY psc.started_at DESC), '[]'::json) AS status_history
    FROM poc_status_comments psc WHERE psc.poc_id = $1 GROUP BY psc.poc_id
  ),
    PocAttachments AS (
    SELECT
        pa.poc_id,
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
    FROM poc_attachments pa
    JOIN employees uploader ON pa.uploaded_by_id = uploader.id
    WHERE pa.poc_id = $1
    GROUP BY pa.poc_id
)
 SELECT pb.*,
    pl_info.derived_lead_id, pl_info.lead_first_name, pl_info.lead_last_name, pl_info.lead_email, pl_info.lead_job_title,
    pa_info.derived_am_id, pa_info.am_first_name, pa_info.am_last_name, pa_info.am_email, pa_info.am_job_title,
    at.team_assignments, sh.status_history,
    p_att.attachments 
  FROM PocBase pb
  LEFT JOIN PocLeadInfo pl_info ON pb.id = $1 
  LEFT JOIN PocAmInfo pa_info ON pb.id = $1  
  LEFT JOIN AggregatedTeam at ON pb.id = at.poc_id
  LEFT JOIN StatusHistory sh ON pb.id = sh.poc_id
  LEFT JOIN PocAttachments p_att ON pb.id = p_att.poc_id;
`;

// GET all PoCs
router.get("/", async (req, res) => {
  const { role, id: employeeId } = req.user || {};

  try {
    let query = `
      SELECT 
        p.id, p.customer_id, p.title, p.technology, p.start_date, p.end_date, 
        p.last_comment, p.created_at, p.updated_at, p.status, p.workflow_status,
        cust.name AS customer_name,
        (SELECT e.first_name || ' ' || e.last_name FROM poc_employees pe JOIN employees e ON pe.employee_id = e.id WHERE pe.poc_id = p.id AND pe.role = $1 AND pe.unassigned_at IS NULL LIMIT 1) AS lead_full_name,
        (SELECT e.first_name || ' ' || e.last_name FROM poc_employees pe JOIN employees e ON pe.employee_id = e.id WHERE pe.poc_id = p.id AND pe.role = $2 AND pe.unassigned_at IS NULL LIMIT 1) AS am_full_name,
        (SELECT COUNT(*) FROM poc_employees pe WHERE pe.poc_id = p.id AND pe.unassigned_at IS NULL) AS team_member_count
      FROM pocs p
      JOIN customers cust ON p.customer_id = cust.id
    `;

    const queryParams = [POC_ROLE_TECHNICAL_LEAD, POC_ROLE_ACCOUNT_MANAGER];

    let filterClause = "";

    // Use a switch statement to apply role-specific filtering
    switch (role) {
      case 'Presales':
        // Presales sees requests pending review AND all active POCs.
        filterClause = ` WHERE p.workflow_status IN ('pending_presales_review', 'active')`;
        break;

      case 'Account Manager':
        queryParams.push(employeeId, POC_ROLE_ACCOUNT_MANAGER);
        filterClause = `
          JOIN poc_employees pe_filter ON p.id = pe_filter.poc_id
          WHERE pe_filter.employee_id = $${queryParams.length - 1} AND pe_filter.role = $${queryParams.length} AND pe_filter.unassigned_at IS NULL
        `;
        break;

      case 'Lead':
        queryParams.push(employeeId, POC_ROLE_TECHNICAL_LEAD);
        filterClause = `
          JOIN poc_employees pe_filter ON p.id = pe_filter.poc_id
          WHERE p.workflow_status = 'active' AND pe_filter.employee_id = $${queryParams.length - 1} AND pe_filter.role = $${queryParams.length} AND pe_filter.unassigned_at IS NULL
        `;
        break;

      case 'Technical Team':
        queryParams.push(employeeId);
        filterClause = `
          JOIN poc_employees pe_filter ON p.id = pe_filter.poc_id
          WHERE p.workflow_status = 'active' AND pe_filter.employee_id = $${queryParams.length} AND pe_filter.unassigned_at IS NULL
        `;
        break;

      // Admin, Project Manager, and any other roles see everything.
      default:
        break;
    }

    query += filterClause;

    query += " ORDER BY p.updated_at DESC;";

    const result = await pool.query(query, queryParams);

    const pocsList = result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      workflow_status: row.workflow_status,
      customerName: row.customer_name,
      technology: row.technology,
      leadName: row.lead_full_name,
      amName: row.am_full_name,
      teamMemberCount: parseInt(row.team_member_count, 10),
      startDate: row.start_date,
      endDate: row.end_date,
      updatedAt: row.updated_at,
    }));
    res.json(pocsList);
  } catch (err) {
    console.error("Error fetching PoCs:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Unknown database error";
    res
      .status(500)
      .json({ error: "Failed to fetch PoCs", details: errorMessage });
  }
});

router.put("/:id/approve", async (req, res) => {
  const { id } = req.params;
  const pocId = parseInt(id, 10);
  const { description } = req.body;
  const approverId = req.user?.id;

  if (req.user?.role !== 'Presales' && req.user?.role !== 'Admin') {
      return res.status(403).json({ error: "You do not have permission to approve POCs." });
  }
  if (!description) {
      return res.status(400).json({ error: "PoC Description is required for approval." });
  }

  const client = await pool.connect();
  try {
      await client.query('BEGIN');

      const updateResult = await client.query(
          `UPDATE pocs 
           SET workflow_status = 'active', description = $1, updated_at = NOW() 
           WHERE id = $2 AND workflow_status = 'pending_presales_review'
           RETURNING id`,
          [description, pocId]
      );

      if (updateResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: "POC not found or is not pending approval." });
      }

      // Fetch the Lead and AM IDs to send notifications
      const teamIdsResult = await client.query(
          `SELECT employee_id, role 
           FROM poc_employees 
           WHERE poc_id = $1 AND unassigned_at IS NULL AND role IN ($2, $3)`,
          [pocId, POC_ROLE_TECHNICAL_LEAD, POC_ROLE_ACCOUNT_MANAGER]
      );

      const lead = teamIdsResult.rows.find(r => r.role === POC_ROLE_TECHNICAL_LEAD);
      const accountManager = teamIdsResult.rows.find(r => r.role === POC_ROLE_ACCOUNT_MANAGER);
      
      await client.query('COMMIT');
      
      // Asynchronously send notification after committing the transaction
      if (lead && accountManager) {
        sendPoCApprovalNotifications(
          pocId,
          approverId,
          accountManager.employee_id,
          lead.employee_id
        ).catch((err) =>
          console.error("Failed to send POC approval notification:", err)
        );
      }

      res.json({ message: "POC approved and is now active." });
  } catch (err) {
      await client.query('ROLLBACK');
      console.error(`Error approving PoC ${pocId}:`, err);
      const errorMessage = err instanceof Error ? err.message : "Unknown database error";
      res.status(500).json({ error: "Database error during PoC approval", details: errorMessage });
  } finally {
      client.release();
  }
});

// GET a single PoC by ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const pocId = parseInt(id, 10);
  if (isNaN(pocId))
    return res.status(400).json({ error: "Invalid PoC ID format." });
  try {
    const result = await pool.query(getAggregatedPocQueryById, [
      pocId,
      POC_ROLE_TECHNICAL_LEAD,
      POC_ROLE_ACCOUNT_MANAGER,
      POC_ROLE_LEAD_ENGINEER,
    ]);
    if (result.rows.length === 0)
      return res.status(404).json({ error: "PoC not found" });
    res.json(mapPocData(result.rows[0]));
  } catch (err) {
    console.error(`Error fetching PoC ${id}:`, err);
    const errorMessage =
      err instanceof Error ? err.message : "Unknown database error";
    res
      .status(500)
      .json({ error: "Failed to fetch PoC", details: errorMessage });
  }
});

// POST to create a new PoC
router.post("/", async (req, res) => {
  const actorUserId = req.user?.id;
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
    status,
    leadId,
    accountManagerId,
    initialTeamAssignments,
    lastComment,
    isBudgetAllocated,
    isVendorAware,
  } = req.body;

  if (
    !customerId ||
    !title ||
    !technology || !Array.isArray(technology) || technology.length === 0 ||
    !startDate ||
    !status ||
    !leadId ||
    !accountManagerId
  ) {
    return res.status(400).json({
      error:
        "Missing required PoC fields (customerId, title, technology, startDate, endDate, status, leadId, accountManagerId)",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const leadEmpRes = await client.query(
      "SELECT role FROM employees WHERE id = $1",
      [leadId]
    );
    if (
      leadEmpRes.rows.length === 0 ||
      leadEmpRes.rows[0].role !== COMPANY_ROLE_LEAD
    ) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: `Selected Technical Lead (ID: ${leadId}) must have company role '${COMPANY_ROLE_LEAD}'.`,
      });
    }

    const amEmpRes = await client.query(
      "SELECT role FROM employees WHERE id = $1",
      [accountManagerId]
    );
    if (
      amEmpRes.rows.length === 0 ||
      amEmpRes.rows[0].role !== COMPANY_ROLE_ACCOUNT_MANAGER
    ) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: `Selected Account Manager (ID: ${accountManagerId}) must have company role '${COMPANY_ROLE_ACCOUNT_MANAGER}'.`,
      });
    }

    const pocResult = await client.query(
      `INSERT INTO pocs 
        (customer_id, title, technology, start_date, end_date, status, created_at, updated_at, is_budget_allocated, is_vendor_aware) 
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), $7, $8)
       RETURNING id, title`,
      [
        customerId,
        title,
        technology,
        startDate,
        endDate,
        status,
        isBudgetAllocated, // new value
        isVendorAware,    // new value
      ]
    );
    const newPocId = pocResult.rows[0].id;
    const newPocTitle = pocResult.rows[0].title;

    await client.query(
      "INSERT INTO poc_employees (poc_id, employee_id, role, assigned_at) VALUES ($1, $2, $3, $4)",
      [newPocId, leadId, POC_ROLE_TECHNICAL_LEAD, startDate]
    );

    await client.query(
      "INSERT INTO poc_employees (poc_id, employee_id, role, assigned_at) VALUES ($1, $2, $3, $4)",
      [newPocId, accountManagerId, POC_ROLE_ACCOUNT_MANAGER, startDate]
    );

    await logActivity(client, newPocId, actorUserId, "POC_CREATED", {
      title: newPocTitle,
    });

    if (initialTeamAssignments && Array.isArray(initialTeamAssignments)) {
      let leadEngineerAssigned = false;
      for (const assignment of initialTeamAssignments) {
        if (assignment.employeeId && assignment.role) {
          if (
            assignment.employeeId === leadId ||
            assignment.employeeId === accountManagerId
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
              `Skipping team assignment for employee ${assignment.employeeId} to PoC ${newPocId} with role ${assignment.role}: Not part of ${COMPANY_ROLE_TECHNICAL_TEAM}.`
            );
            continue;
          }
          if (assignment.role === POC_ROLE_LEAD_ENGINEER) {
            if (leadEngineerAssigned) {
              await client.query("ROLLBACK");
              return res
                .status(400)
                .json({ error: "A PoC can only have one Lead Engineer." });
            }
            leadEngineerAssigned = true;
          }
          const assignDate = assignment.assignedAt
            ? new Date(assignment.assignedAt).toISOString().split("T")[0]
            : new Date(startDate).toISOString().split("T")[0];
          await client.query(
            "INSERT INTO poc_employees (poc_id, employee_id, role, assigned_at) VALUES ($1, $2, $3, $4)",
            [newPocId, assignment.employeeId, assignment.role, assignDate]
          );
        }
      }
    }

    await client.query(
      "INSERT INTO poc_status_comments (poc_id, started_at, status, ended_at) VALUES ($1, NOW(), $2, NULL)",
      [newPocId, status]
    );

    await client.query("COMMIT");

    // This notification call remains the same, but the service will now fetch the new fields
    sendPoCRequestNotifications(newPocId, actorUserId).catch((err) =>
      console.error("PoC request notification failed to send:", err)
    );

    const createdPocResult = await pool.query(getAggregatedPocQueryById, [
      newPocId,
      POC_ROLE_TECHNICAL_LEAD,
      POC_ROLE_ACCOUNT_MANAGER,
      POC_ROLE_LEAD_ENGINEER,
    ]);
    if (createdPocResult.rows.length === 0) {
      return res.status(500).json({
        error: "Failed to retrieve created PoC details after creation.",
      });
    }
    res.status(201).json(mapPocData(createdPocResult.rows[0]));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating PoC:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Unknown database error";
    res.status(500).json({
      error: "Database error during PoC creation",
      details: errorMessage,
    });
  } finally {
    client.release();
  }
});

// PUT to update PoC info
router.put("/:id", async (req, res) => {
  const actorUserId = req.user?.id;
  if (!actorUserId) {
    return res
      .status(403)
      .json({ error: "User not authenticated or user ID not found." });
  }

  const { id } = req.params;
  const pocId = parseInt(id, 10);
  if (isNaN(pocId))
    return res.status(400).json({ error: "Invalid PoC ID format." });

  const {
    // customerId, // Typically not changed after creation
    title,
    technology,
    startDate, // Typically not changed after creation
    endDate,
    status,
    lastComment,
    leadId, // Employee ID for new PoC Technical Lead (optional)
    accountManagerId, // Employee ID for new PoC Account Manager (optional)
    teamAssignments: newAssignments,
  } = req.body;

  

  



  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // --- Fetch original data for comparison ---
    const originalPocRes = await client.query(
      "SELECT * FROM pocs WHERE id = $1 FOR UPDATE",
      [pocId]
    );
    if (originalPocRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "PoC not found for update." });
    }
    const originalPoc = originalPocRes.rows[0];

    // --- LOG FIELD_UPDATED ---
    const updatedFields: { field: string; from: any; to: any }[] = [];
    if (title !== undefined && title !== originalPoc.title) {
      updatedFields.push({
        field: "Title",
        from: originalPoc.title,
        to: title,
      });
    }
    if (technology !== undefined && JSON.stringify(technology) !== JSON.stringify(originalPoc.technology)) {
      updatedFields.push({
          field: "Technology",
          from: originalPoc.technology,
          to: technology,
      });
  }

    if (
      endDate !== undefined &&
      format(new Date(endDate), "yyyy-MM-dd") !==
        (originalPoc.end_date
          ? format(new Date(originalPoc.end_date), "yyyy-MM-dd")
          : null)
    ) {
      updatedFields.push({
        field: "Target End Date",
        from: originalPoc.end_date,
        to: endDate,
      });
    }
    if (
      startDate !== undefined &&
      format(new Date(startDate), "yyyy-MM-dd") !==
        (originalPoc.start_date
          ? format(new Date(originalPoc.start_date), "yyyy-MM-dd")
          : null)
    ) {
      updatedFields.push({
        field: "Start Date",
        from: originalPoc.start_date,
        to: startDate,
      });
    }
    // Log each field update
    for (const update of updatedFields) {
      await logActivity(client, pocId, actorUserId, "FIELD_UPDATED", update);
    }

    // --- LOG STATUS_UPDATED ---
    if (status !== undefined && status !== originalPoc.status) {
      await logActivity(client, pocId, actorUserId, "STATUS_UPDATED", {
        from: originalPoc.status,
        to: status,
      });
    }

    // --- LOG LEAD_ASSIGNED ---
    const originalLeadRes = await client.query(
      `SELECT employee_id FROM poc_employees WHERE poc_id = $1 AND role = $2 AND unassigned_at IS NULL`,
      [pocId, POC_ROLE_TECHNICAL_LEAD]
    );
    const originalLeadId = originalLeadRes.rows[0]?.employee_id;

    if (leadId !== undefined && leadId !== originalLeadId) {
      const newLeadDetails = await client.query(
        "SELECT first_name, last_name FROM employees WHERE id = $1",
        [leadId]
      );
      const originalLeadDetails = originalLeadId
        ? await client.query(
            "SELECT first_name, last_name FROM employees WHERE id = $1",
            [originalLeadId]
          )
        : null;

      await logActivity(client, pocId, actorUserId, "LEAD_ASSIGNED", {
        from: originalLeadDetails
          ? `${originalLeadDetails.rows[0].first_name} ${originalLeadDetails.rows[0].last_name}`
          : "None",
        to: `${newLeadDetails.rows[0].first_name} ${newLeadDetails.rows[0].last_name}`,
      });
    }

    // --- LOG TEAM_MEMBER (UN)ASSIGNED ---
    if (newAssignments !== undefined && Array.isArray(newAssignments)) {
      const originalAssignmentsRes = await client.query(
        `SELECT pe.employee_id, pe.role, e.first_name, e.last_name FROM poc_employees pe JOIN employees e ON pe.employee_id = e.id WHERE pe.poc_id = $1 AND pe.unassigned_at IS NULL AND pe.role NOT IN ($2, $3)`,
        [pocId, POC_ROLE_TECHNICAL_LEAD, POC_ROLE_ACCOUNT_MANAGER]
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

      // Unassigned
      for (const member of originalTeam) {
        if (!newTeamMap.has(member.employeeId)) {
          await logActivity(
            client,
            pocId,
            actorUserId,
            "TEAM_MEMBER_UNASSIGNED",
            {
              member: member.name,
              role: member.role,
            }
          );
        }
      }
      // Assigned
      for (const member of newAssignments) {
        if (!originalTeamMap.has(member.employeeId)) {
          const memberDetails = await client.query(
            "SELECT first_name, last_name FROM employees WHERE id = $1",
            [member.employeeId]
          );
          const memberName = `${memberDetails.rows[0].first_name} ${memberDetails.rows[0].last_name}`;
          await logActivity(
            client,
            pocId,
            actorUserId,
            "TEAM_MEMBER_ASSIGNED",
            {
              member: memberName,
              role: member.role,
            }
          );
        }
      }
    }

    let originalAssignments: any[] = [];
    if (newAssignments !== undefined && Array.isArray(newAssignments)) {
      // Only fetch if new assignments are provided
      const originalAssignmentsResult = await client.query(
        `SELECT employee_id as "employeeId", role FROM poc_employees WHERE poc_id = $1 AND unassigned_at IS NULL AND role NOT IN ($2, $3)`,
        [pocId, POC_ROLE_TECHNICAL_LEAD, POC_ROLE_ACCOUNT_MANAGER]
      );
      originalAssignments = originalAssignmentsResult.rows;
    }

    const pocUpdateFields = [];
    const pocValues = [];
    let pocParamCount = 1;

    // if (customerId !== undefined) { pocUpdateFields.push(`customer_id = $${pocParamCount++}`); pocValues.push(customerId); }
    if (title !== undefined) {
      pocUpdateFields.push(`title = $${pocParamCount++}`);
      pocValues.push(title);
    }
    if (technology !== undefined) {
      pocUpdateFields.push(`technology = $${pocParamCount++}`);
      pocValues.push(technology);
    }
    if (endDate !== undefined) {
      pocUpdateFields.push(`end_date = $${pocParamCount++}`);
      pocValues.push(endDate);
    }
    if (lastComment !== undefined) {
      pocUpdateFields.push(`last_comment = $${pocParamCount++}`);
      pocValues.push(lastComment === "" ? null : lastComment);
    }

    let statusChanged = false;
    if (status !== undefined) {
      const currentPocStatusRes = await client.query(
        "SELECT status FROM pocs WHERE id = $1",
        [pocId]
      );
      if (currentPocStatusRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return res
          .status(404)
          .json({ error: "PoC not found for status check." });
      }
      if (currentPocStatusRes.rows[0].status !== status) {
        statusChanged = true;
      }
      pocUpdateFields.push(`status = $${pocParamCount++}`);
      pocValues.push(status);
    }

    let mainPocUpdated = false;
    // Inside the PUT /:id handler
    if (pocUpdateFields.length > 0) {
      pocUpdateFields.push(`updated_at = NOW()`);
      pocValues.push(pocId);
      const updateResult = await client.query(
        `UPDATE pocs SET ${pocUpdateFields.join(
          ", "
        )} WHERE id = $${pocParamCount} RETURNING id`,
        pocValues
      );
      // Safely check rowCount:
      // If rowCount is a number and greater than 0, it means rows were affected.
      // If rowCount is null, it typically means the command was not one that returns a row count (like some utility commands),
      // but for UPDATE, it should be a number. A null check is good practice.
      if (updateResult.rowCount && updateResult.rowCount > 0) {
        mainPocUpdated = true;
      } else if (pocUpdateFields.length > 1) {
        // Only error if we tried to update more than just 'updated_at' and nothing changed
        await client.query("ROLLBACK");
        // It's possible the PoC was deleted between the status check and here, or criteria didn't match.
        return res.status(404).json({
          error:
            "PoC not found or no direct fields were updated, leading to no change.",
        });
      }
    }

    // Handle Technical Lead change if leadId is provided and is a valid number
    if (
      leadId !== undefined &&
      leadId !== null &&
      !isNaN(parseInt(leadId as any, 10))
    ) {
      const newLeadIdNum = parseInt(leadId as any, 10);
      const leadEmpRes = await client.query(
        "SELECT role FROM employees WHERE id = $1",
        [newLeadIdNum]
      );
      if (
        leadEmpRes.rows.length === 0 ||
        leadEmpRes.rows[0].role !== COMPANY_ROLE_LEAD
      ) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `New Technical Lead (ID: ${newLeadIdNum}) must have company role '${COMPANY_ROLE_LEAD}'.`,
        });
      }
      // Unassign current active Technical Lead for this PoC if different
      await client.query(
        `UPDATE poc_employees SET unassigned_at = NOW() 
             WHERE poc_id = $1 AND role = $2 AND unassigned_at IS NULL AND employee_id != $3`,
        [pocId, POC_ROLE_TECHNICAL_LEAD, newLeadIdNum]
      );
      const existingLeadAssignment = await client.query(
        `SELECT id FROM poc_employees WHERE poc_id = $1 AND employee_id = $2 AND role = $3 AND unassigned_at IS NULL`,
        [pocId, newLeadIdNum, POC_ROLE_TECHNICAL_LEAD]
      );
      if (existingLeadAssignment.rows.length === 0) {
        await client.query(
          "INSERT INTO poc_employees (poc_id, employee_id, role, assigned_at) VALUES ($1, $2, $3, NOW())",
          [pocId, newLeadIdNum, POC_ROLE_TECHNICAL_LEAD]
        );
      }
      mainPocUpdated = true; // A change was made or attempted
    }

    // Handle Account Manager change if accountManagerId is provided and is a valid number
    if (
      accountManagerId !== undefined &&
      accountManagerId !== null &&
      !isNaN(parseInt(accountManagerId as any, 10))
    ) {
      const newAmIdNum = parseInt(accountManagerId as any, 10);
      const amEmpRes = await client.query(
        "SELECT role FROM employees WHERE id = $1",
        [newAmIdNum]
      );
      if (
        amEmpRes.rows.length === 0 ||
        amEmpRes.rows[0].role !== COMPANY_ROLE_ACCOUNT_MANAGER
      ) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `New Account Manager (ID: ${newAmIdNum}) must have company role '${COMPANY_ROLE_ACCOUNT_MANAGER}'.`,
        });
      }
      await client.query(
        `UPDATE poc_employees SET unassigned_at = NOW() 
             WHERE poc_id = $1 AND role = $2 AND unassigned_at IS NULL AND employee_id != $3`,
        [pocId, POC_ROLE_ACCOUNT_MANAGER, newAmIdNum]
      );
      const existingAmAssignment = await client.query(
        `SELECT id FROM poc_employees WHERE poc_id = $1 AND employee_id = $2 AND role = $3 AND unassigned_at IS NULL`,
        [pocId, newAmIdNum, POC_ROLE_ACCOUNT_MANAGER]
      );
      if (existingAmAssignment.rows.length === 0) {
        await client.query(
          "INSERT INTO poc_employees (poc_id, employee_id, role, assigned_at) VALUES ($1, $2, $3, NOW())",
          [pocId, newAmIdNum, POC_ROLE_ACCOUNT_MANAGER]
        );
      }
      mainPocUpdated = true; // A change was made or attempted
    }

    if (statusChanged) {
      await client.query(
        `UPDATE poc_status_comments SET ended_at = NOW() WHERE poc_id = $1 AND ended_at IS NULL AND status != $2`,
        [pocId, status]
      );
      await client.query(
        "INSERT INTO poc_status_comments (poc_id, started_at, status, ended_at) VALUES ($1, NOW(), $2, NULL)",
        [pocId, status]
      );
      mainPocUpdated = true;
    }

    if (
      !mainPocUpdated &&
      !statusChanged &&
      leadId === undefined &&
      accountManagerId === undefined
    ) {
      // No actual data fields were sent for update
      await client.query("ROLLBACK"); // Or COMMIT if you want updated_at to change anyway
      const currentPocResult = await pool.query(getAggregatedPocQueryById, [
        pocId,
        POC_ROLE_TECHNICAL_LEAD,
        POC_ROLE_ACCOUNT_MANAGER,
        POC_ROLE_LEAD_ENGINEER,
      ]);
      if (currentPocResult.rows.length === 0)
        return res.status(404).json({ error: "PoC not found" });
      return res.json(mapPocData(currentPocResult.rows[0]));
    }

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
            `Unassigning employee ${orig.employeeId} from PoC ${pocId}`
          );
          await client.query(
            "UPDATE poc_employees SET unassigned_at = NOW() WHERE poc_id = $1 AND employee_id = $2 AND unassigned_at IS NULL",
            [pocId, orig.employeeId]
          );
        }
      }

      // 2. Find and handle new or updated members
      for (const newAssign of newAssignments) {
        const origAssign = originalAssignmentMap.get(newAssign.employeeId);
        if (!origAssign) {
          // This is a new assignment
          console.log(
            `Assigning new employee ${newAssign.employeeId} to PoC ${pocId}`
          );
          await client.query(
            "INSERT INTO poc_employees (poc_id, employee_id, role, assigned_at) VALUES ($1, $2, $3, NOW())",
            [pocId, newAssign.employeeId, newAssign.role]
          );
        } else if (origAssign.role !== newAssign.role) {
          // This is an existing assignment with a role change
          console.log(
            `Updating role for employee ${newAssign.employeeId} on PoC ${pocId} to ${newAssign.role}`
          );
          await client.query(
            "UPDATE poc_employees SET role = $1 WHERE poc_id = $2 AND employee_id = $3 AND unassigned_at IS NULL",
            [newAssign.role, pocId, newAssign.employeeId]
          );
        }
        // If they exist in both and the role is the same, do nothing.
      }
    }

    await client.query("COMMIT");

    // C. After successful commit, trigger team change notifications if team was updated
    if (newAssignments !== undefined && leadId) {
      handlePocTeamChangeNotifications(
        pocId,
        originalAssignments,
        newAssignments,
        leadId
      ).catch((err) =>
        console.error("Team change notification failed to send:", err)
      );
    }

    const updatedPocResult = await pool.query(getAggregatedPocQueryById, [
      pocId,
      POC_ROLE_TECHNICAL_LEAD,
      POC_ROLE_ACCOUNT_MANAGER,
      POC_ROLE_LEAD_ENGINEER,
    ]);
    if (updatedPocResult.rows.length === 0)
      return res.status(404).json({ error: "PoC not found after update." });
    res.json(mapPocData(updatedPocResult.rows[0]));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`Error updating PoC ${id}:`, err);
    const errorMessage =
      err instanceof Error ? err.message : "Unknown database error";
    res.status(500).json({
      error: "Database error during PoC update",
      details: errorMessage,
    });
  } finally {
    client.release();
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const pocId = parseInt(id, 10);
  if (isNaN(pocId)) {
    return res.status(400).json({ error: "Invalid PoC ID format." });
  }

  try {
    // Call the database function and get the result message
    const result = await pool.query(
      "SELECT archive_and_delete_poc($1) AS message",
      [pocId]
    );
    const responseMessage = result.rows[0].message;

    // Check if the function returned an error message
    if (responseMessage.startsWith("ERROR: Not Found")) {
      return res.status(404).json({ error: "PoC not found" });
    }
    if (responseMessage.startsWith("ERROR:")) {
      throw new Error(responseMessage);
    }

    res.status(200).json({ message: responseMessage });
  } catch (err) {
    console.error(`Error in PoC delete function for ID ${pocId}:`, err);
    let errorMessage = "An unknown database error occurred.";
    if (err instanceof Error) {
      errorMessage = err.message;
    }
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

    const { id: pocId } = req.params;
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
        `INSERT INTO poc_attachments (poc_id, uploaded_by_id, description, original_filename, mime_type, file_size_bytes, file_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, uuid, description, original_filename, mime_type, file_size_bytes, created_at`,
        [
          pocId,
          actorUserId,
          description,
          file.originalname,
          file.mimetype,
          file.size,
          file.buffer, // Use the file's data buffer from memory
        ]
      );

      // Log the upload activity
      await logActivity(
        pool,
        parseInt(pocId),
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
      console.error("Error uploading PoC attachment:", err);
      res.status(500).json({ error: "Database error during file upload." });
    }
  }
);




export default router;
