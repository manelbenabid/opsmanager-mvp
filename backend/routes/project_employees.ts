import express from 'express';
import pool from '../db'; 

const router = express.Router();

// --- Role Constants ---
const COMPANY_ROLE_LEAD = 'Lead';
const COMPANY_ROLE_ACCOUNT_MANAGER = 'Account Manager';
const COMPANY_ROLE_PROJECT_MANAGER = 'Project Manager';
const COMPANY_ROLE_TECHNICAL_TEAM = 'Technical Team';

const PROJECT_ROLE_TECHNICAL_LEAD = 'Technical Lead';
const PROJECT_ROLE_ACCOUNT_MANAGER = 'Account Manager';
const PROJECT_ROLE_PROJECT_MANAGER = 'Project Manager';
const PROJECT_ROLE_LEAD_ENGINEER = 'Lead Engineer';
const PROJECT_ROLE_SUPPORTING_ENGINEER = 'Supporting Engineer';


const mapProjectEmployeeData = (dbRow: any) => {
  if (!dbRow) return null;
  return {
    id: dbRow.id,
    projectId: dbRow.project_id,
    employeeId: dbRow.employee_id,
    role: dbRow.role, 
    assignedAt: dbRow.assigned_at, 
    unassignedAt: dbRow.unassigned_at,
    employee: (dbRow.first_name) ? { 
        id: dbRow.employee_id, 
        firstName: dbRow.first_name,
        lastName: dbRow.last_name,
        email: dbRow.email,
        jobTitle: dbRow.job_title, 
        companyRole: dbRow.company_role, 
    } : undefined,
  };
};

// GET all project employee assignments 
router.get('/', async (req, res) => {
  const { projectId, employeeId } = req.query;
  let queryText = `
    SELECT 
        pe.id, pe.project_id, pe.employee_id, pe.role, pe.assigned_at, pe.unassigned_at,
        e.first_name, e.last_name, e.email, e.job_title, e.role AS company_role
    FROM project_employees pe
    JOIN employees e ON pe.employee_id = e.id
  `;
  const queryParams = [];
  const conditions = [];

  if (projectId) {
    queryParams.push(projectId);
    conditions.push(`pe.project_id = $${queryParams.length}`);
  }
  if (employeeId) {
    queryParams.push(employeeId);
    conditions.push(`pe.employee_id = $${queryParams.length}`);
  }

  if (conditions.length > 0) {
    queryText += ` WHERE ${conditions.join(' AND ')}`;
  }
  queryText += ' ORDER BY pe.project_id, pe.assigned_at DESC';

  try {
    const result = await pool.query(queryText, queryParams);
    res.json(result.rows.map(mapProjectEmployeeData));
  } catch (err) {
    console.error('Error fetching project employee assignments:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: 'Failed to fetch project employee assignments', details: errorMessage });
  }
});

// GET a single project employee assignment by its ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const assignmentId = parseInt(id, 10);
  if (isNaN(assignmentId)) {
    return res.status(400).json({ error: 'Invalid assignment ID format.' });
  }
  try {
    const result = await pool.query(
      `SELECT 
          pe.id, pe.project_id, pe.employee_id, pe.role, pe.assigned_at, pe.unassigned_at,
          e.first_name, e.last_name, e.email, e.job_title, e.role AS company_role
       FROM project_employees pe
       JOIN employees e ON pe.employee_id = e.id
       WHERE pe.id = $1`,
      [assignmentId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'project employee assignment not found' });
    }
    res.json(mapProjectEmployeeData(result.rows[0]));
  } catch (err) {
    console.error(`Error fetching project employee assignment ${id}:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: 'Failed to fetch project employee assignment', details: errorMessage });
  }
});

// POST to create a new project employee assignment (assign employee to project)
router.post('/', async (req, res) => {
  const {
    projectId,
    employeeId,
    role, // This is a value from project_employee_role_enum
    assignedAt, 
  } = req.body;

  if (!projectId || !employeeId || !role) {
    return res.status(400).json({ error: 'Missing required fields: projectId, employeeId, role' });
  }
  
  const assignmentDate = assignedAt ? new Date(assignedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const projectCheck = await client.query('SELECT id FROM projects WHERE id = $1', [projectId]);
    if (projectCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `project with id ${projectId} not found.` });
    }

    const employeeRes = await client.query('SELECT role AS company_role FROM employees WHERE id = $1', [employeeId]);
    if (employeeRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Employee with id ${employeeId} not found.` });
    }
    const companyRole = employeeRes.rows[0].company_role;

    // Role-specific validations
    if (role === PROJECT_ROLE_TECHNICAL_LEAD) {
      if (companyRole !== COMPANY_ROLE_LEAD) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Employee (ID: ${employeeId}) must have company role '${COMPANY_ROLE_LEAD}' to be '${PROJECT_ROLE_TECHNICAL_LEAD}'.` });
      }
      const existing = await client.query("SELECT id FROM project_employees WHERE project_id = $1 AND role = $2 AND unassigned_at IS NULL", [projectId, PROJECT_ROLE_TECHNICAL_LEAD]);
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `project ${projectId} already has an active Technical Lead.` });
      }
    } else if (role ===PROJECT_ROLE_ACCOUNT_MANAGER) {
      if (companyRole !== COMPANY_ROLE_ACCOUNT_MANAGER) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Employee (ID: ${employeeId}) must have company role '${COMPANY_ROLE_ACCOUNT_MANAGER}' to be '${PROJECT_ROLE_ACCOUNT_MANAGER}'.` });
      }
      const existing = await client.query("SELECT id FROM project_employees WHERE project_id = $1 AND role = $2 AND unassigned_at IS NULL", [projectId, PROJECT_ROLE_ACCOUNT_MANAGER]);
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `project ${projectId} already has an active Account Manager.` });
      }
    } else if (role === PROJECT_ROLE_PROJECT_MANAGER) {
        if (companyRole !== COMPANY_ROLE_PROJECT_MANAGER) {
            throw new Error(`Employee must have company role '${COMPANY_ROLE_PROJECT_MANAGER}' to be '${PROJECT_ROLE_PROJECT_MANAGER}'.`);
        }
        const existing = await client.query("SELECT id FROM project_employees WHERE project_id = $1 AND role = $2 AND unassigned_at IS NULL", [projectId, PROJECT_ROLE_PROJECT_MANAGER]);
        if (existing.rows.length > 0) {
            throw new Error(`Project ${projectId} already has an active Project Manager.`);
        }
    } else if (role === PROJECT_ROLE_LEAD_ENGINEER) {
      if (companyRole !== COMPANY_ROLE_TECHNICAL_TEAM) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Employee (ID: ${employeeId}) must have company role '${COMPANY_ROLE_TECHNICAL_TEAM}' to be '${PROJECT_ROLE_LEAD_ENGINEER}'.` });
      }
      const existing = await client.query("SELECT id FROM project_employees WHERE project_id = $1 AND role = $2 AND unassigned_at IS NULL", [projectId, PROJECT_ROLE_LEAD_ENGINEER]);
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `project ${projectId} already has an active Lead Engineer.` });
      }
    } else if (role === PROJECT_ROLE_SUPPORTING_ENGINEER) {
      if (companyRole !== COMPANY_ROLE_TECHNICAL_TEAM) {
         await client.query('ROLLBACK');
        return res.status(400).json({ error: `Employee (ID: ${employeeId}) must have company role '${COMPANY_ROLE_TECHNICAL_TEAM}' to be '${PROJECT_ROLE_SUPPORTING_ENGINEER}'.` });
      }
    } else {
        await client.query('ROLLBACK'); // Unknown project role
        return res.status(400).json({ error: `Invalid project role specified: ${role}` });
    }
    
    const duplicateAssignmentCheck = await client.query(
        `SELECT id FROM project_employees WHERE project_id = $1 AND employee_id = $2 AND role = $3 AND unassigned_at IS NULL`,
        [projectId, employeeId, role]
    );
    if (duplicateAssignmentCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `Employee (ID: ${employeeId}) is already actively assigned the role '${role}' on this project.` });
    }

    const result = await client.query(
      `INSERT INTO project_employees (project_id, employee_id, role, assigned_at, unassigned_at) 
      VALUES ($1, $2, $3, $4, NULL)
      RETURNING *`, 
      [projectId, employeeId, role, assignmentDate]
    );
    await client.query('COMMIT');
    
    const newAssignmentDetails = await pool.query( // Use pool for SELECT after commit
         `SELECT pe.*, e.first_name, e.last_name, e.email, e.job_title, e.role AS company_role 
          FROM project_employees pe JOIN employees e ON pe.employee_id = e.id 
          WHERE pe.id = $1`, [result.rows[0].id]
    );
    res.status(201).json(mapProjectEmployeeData(newAssignmentDetails.rows[0]));

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating project employee assignment:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: 'Database error during project employee assignment creation', details: errorMessage });
  } finally {
    client.release();
  }
});

// PUT to update a project employee assignment (e.g., change role, or unassign)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const assignmentId = parseInt(id, 10);
   if (isNaN(assignmentId)) {
    return res.status(400).json({ error: 'Invalid assignment ID format.' });
  }

  const {
    role, 
    unassignedAt, 
  } = req.body;

  if (role === undefined && unassignedAt === undefined) {
    return res.status(400).json({ error: 'No fields provided for update. Provide role or unassignedAt.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const currentAssignmentRes = await client.query('SELECT project_id, employee_id, role AS current_project_role FROM project_employees WHERE id = $1', [assignmentId]);
    if (currentAssignmentRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Assignment not found.' });
    }
    const { project_id: currentprojectId, employee_id: currentEmployeeId, current_project_role: currentprojectRole } = currentAssignmentRes.rows[0];

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (role !== undefined && role !== currentprojectRole) { 
      const employeeRes = await client.query('SELECT role AS company_role FROM employees WHERE id = $1', [currentEmployeeId]);
      const companyRole = employeeRes.rows[0].company_role; 

      let roleConflictMessage = '';
      let companyRoleMismatchMessage = '';

      if (role === PROJECT_ROLE_TECHNICAL_LEAD) {
        if (companyRole !== COMPANY_ROLE_LEAD) companyRoleMismatchMessage = `Employee must have company role '${COMPANY_ROLE_LEAD}' to be '${PROJECT_ROLE_TECHNICAL_LEAD}'.`;
        const existing = await client.query("SELECT id FROM project_employees WHERE project_id = $1 AND role = $2 AND unassigned_at IS NULL AND id != $3", [currentprojectId, PROJECT_ROLE_TECHNICAL_LEAD, assignmentId]);
        if (existing.rows.length > 0) roleConflictMessage = `project ${currentprojectId} already has an active Technical Lead.`;
      } else if (role === PROJECT_ROLE_PROJECT_MANAGER) {
        if (companyRole !== COMPANY_ROLE_PROJECT_MANAGER) companyRoleMismatchMessage = `Employee must have company role '${COMPANY_ROLE_PROJECT_MANAGER}' to be '${PROJECT_ROLE_PROJECT_MANAGER}'.`;
        const existing = await client.query("SELECT id FROM project_employees WHERE project_id = $1 AND role = $2 AND unassigned_at IS NULL AND id != $3", [currentprojectId, PROJECT_ROLE_PROJECT_MANAGER, assignmentId]);
        if (existing.rows.length > 0) roleConflictMessage = `project ${currentprojectId} already has an active Project Manager.`;
      } else if (role === PROJECT_ROLE_ACCOUNT_MANAGER) {
        if (companyRole !== COMPANY_ROLE_ACCOUNT_MANAGER) companyRoleMismatchMessage = `Employee must have company role '${COMPANY_ROLE_ACCOUNT_MANAGER}' to be '${PROJECT_ROLE_ACCOUNT_MANAGER}'.`;
        const existing = await client.query("SELECT id FROM project_employees WHERE project_id = $1 AND role = $2 AND unassigned_at IS NULL AND id != $3", [currentprojectId, PROJECT_ROLE_ACCOUNT_MANAGER, assignmentId]);
        if (existing.rows.length > 0) roleConflictMessage = `project ${currentprojectId} already has an active Account Manager.`;
      } else if (role === PROJECT_ROLE_LEAD_ENGINEER) {
        if (companyRole !== COMPANY_ROLE_TECHNICAL_TEAM) companyRoleMismatchMessage = `Employee must have company role '${COMPANY_ROLE_TECHNICAL_TEAM}' to be '${PROJECT_ROLE_LEAD_ENGINEER}'.`;
        const existing = await client.query("SELECT id FROM project_employees WHERE project_id = $1 AND role = $2 AND unassigned_at IS NULL AND id != $3", [currentprojectId, PROJECT_ROLE_LEAD_ENGINEER, assignmentId]);
        if (existing.rows.length > 0) roleConflictMessage = `project ${currentprojectId} already has an active Lead Engineer.`;
      } else if (role === PROJECT_ROLE_SUPPORTING_ENGINEER) {
         if (companyRole !== COMPANY_ROLE_TECHNICAL_TEAM) companyRoleMismatchMessage = `Employee must have company role '${COMPANY_ROLE_TECHNICAL_TEAM}' to be '${PROJECT_ROLE_SUPPORTING_ENGINEER}'.`;
      } else {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Invalid new project role specified: ${role}` });
      }

      if (companyRoleMismatchMessage) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: companyRoleMismatchMessage });
      }
      if (roleConflictMessage) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: roleConflictMessage });
      }
      updates.push(`role = $${paramCount++}`);
      values.push(role);
    }

    if (unassignedAt !== undefined) { 
      updates.push(`unassigned_at = $${paramCount++}`);
      values.push(unassignedAt ? new Date(unassignedAt).toISOString().split('T')[0] : null);
    }

    if (updates.length === 0) {
      await client.query('ROLLBACK');
      const currentDetails = await pool.query( // Use pool for SELECT
         `SELECT pe.*, e.first_name, e.last_name, e.email, e.job_title, e.role AS company_role 
          FROM project_employees pe JOIN employees e ON pe.employee_id = e.id 
          WHERE pe.id = $1`, [assignmentId]
        );
      return res.json(mapProjectEmployeeData(currentDetails.rows[0]));
    }

    values.push(assignmentId); 

    const queryText = `
      UPDATE project_employees 
      SET ${updates.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING *
    `;
    const result = await client.query(queryText, values);
    
    await client.query('COMMIT');

    const updatedAssignmentDetails = await pool.query( // Use pool for SELECT
         `SELECT pe.*, e.first_name, e.last_name, e.email, e.job_title, e.role AS company_role 
          FROM project_employees pe JOIN employees e ON pe.employee_id = e.id 
          WHERE pe.id = $1`, [result.rows[0].id]
    );
    res.json(mapProjectEmployeeData(updatedAssignmentDetails.rows[0]));

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`Error updating project employee assignment ${id}:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: 'Database error during project employee assignment update', details: errorMessage });
  } finally {
    client.release();
  }
});

// DELETE a project employee assignment
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
   const assignmentId = parseInt(id, 10);
   if (isNaN(assignmentId)) {
    return res.status(400).json({ error: 'Invalid assignment ID format.' });
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const assignmentToDelete = await client.query('SELECT project_id, role FROM project_employees WHERE id = $1', [assignmentId]);
    if (assignmentToDelete.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Project employee assignment not found' });
    }
    const { project_id: projectId, role: roleToDelete } = assignmentToDelete.rows[0];

    // *** CHANGE 3: ADDED CHECK TO PREVENT DELETING THE LAST PROJECT MANAGER ***
    if ([PROJECT_ROLE_TECHNICAL_LEAD, PROJECT_ROLE_ACCOUNT_MANAGER, PROJECT_ROLE_PROJECT_MANAGER].includes(roleToDelete)) {
        const otherSimilarRoles = await client.query(
            `SELECT id FROM project_employees WHERE project_id = $1 AND role = $2 AND unassigned_at IS NULL AND id != $1`,
            [projectId, roleToDelete]
        );
        if (otherSimilarRoles.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Cannot delete the only active ${roleToDelete} for this project. Assign a new one first or unassign this member.`});
        }
    }

    const result = await client.query(
      'DELETE FROM project_employees WHERE id = $1 RETURNING *',
      [assignmentId]
    );
    // No need to check result.rows.length again, already done.
    
    await client.query('COMMIT');
    res.status(200).json({ 
        message: 'project employee assignment deleted successfully', 
        deletedAssignment: { // Return basic info as employee details might not be easily joinable after delete
            id: result.rows[0].id,
            projectId: result.rows[0].project_id,
            employeeId: result.rows[0].employee_id,
            role: result.rows[0].role
        }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`Error deleting project employee assignment ${id}:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: 'Database error during project employee assignment deletion', details: errorMessage });
  } finally {
    client.release();
  }
});

export default router;
