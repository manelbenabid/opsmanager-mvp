import express from 'express';
import pool from '../db'; 

const router = express.Router();

// --- Role Constants ---
// Company Roles (from employee_role_enum)
const COMPANY_ROLE_LEAD = 'Lead';
const COMPANY_ROLE_ACCOUNT_MANAGER = 'Account Manager';
const COMPANY_ROLE_TECHNICAL_TEAM = 'Technical Team';

// PoC Specific Roles (from poc_employee_role_enum)
const POC_ROLE_TECHNICAL_LEAD = 'Technical Lead';
const POC_ROLE_ACCOUNT_MANAGER = 'Account Manager';
const POC_ROLE_LEAD_ENGINEER = 'Lead Engineer';
const POC_ROLE_SUPPORTING_ENGINEER = 'Supporting Engineer';


const mapPocEmployeeData = (dbRow: any) => {
  if (!dbRow) return null;
  return {
    id: dbRow.id,
    pocId: dbRow.poc_id,
    employeeId: dbRow.employee_id,
    role: dbRow.role, 
    assignedAt: dbRow.assigned_at, 
    unassignedAt: dbRow.unassigned_at,
    employee: (dbRow.first_name || dbRow.last_name || dbRow.email) ? { 
        id: dbRow.employee_id, 
        firstName: dbRow.first_name,
        lastName: dbRow.last_name,
        email: dbRow.email,
        jobTitle: dbRow.job_title, 
        companyRole: dbRow.company_role, 
    } : undefined,
  };
};

// GET all PoC employee assignments 
router.get('/', async (req, res) => {
  const { pocId, employeeId } = req.query;
  let queryText = `
    SELECT 
        pe.id, pe.poc_id, pe.employee_id, pe.role, pe.assigned_at, pe.unassigned_at,
        e.first_name, e.last_name, e.email, e.job_title, e.role AS company_role
    FROM poc_employees pe
    JOIN employees e ON pe.employee_id = e.id
  `;
  const queryParams = [];
  const conditions = [];

  if (pocId) {
    queryParams.push(pocId);
    conditions.push(`pe.poc_id = $${queryParams.length}`);
  }
  if (employeeId) {
    queryParams.push(employeeId);
    conditions.push(`pe.employee_id = $${queryParams.length}`);
  }

  if (conditions.length > 0) {
    queryText += ` WHERE ${conditions.join(' AND ')}`;
  }
  queryText += ' ORDER BY pe.poc_id, pe.assigned_at DESC';

  try {
    const result = await pool.query(queryText, queryParams);
    res.json(result.rows.map(mapPocEmployeeData));
  } catch (err) {
    console.error('Error fetching PoC employee assignments:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: 'Failed to fetch PoC employee assignments', details: errorMessage });
  }
});

// GET a single PoC employee assignment by its ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const assignmentId = parseInt(id, 10);
  if (isNaN(assignmentId)) {
    return res.status(400).json({ error: 'Invalid assignment ID format.' });
  }
  try {
    const result = await pool.query(
      `SELECT 
          pe.id, pe.poc_id, pe.employee_id, pe.role, pe.assigned_at, pe.unassigned_at,
          e.first_name, e.last_name, e.email, e.job_title, e.role AS company_role
       FROM poc_employees pe
       JOIN employees e ON pe.employee_id = e.id
       WHERE pe.id = $1`,
      [assignmentId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'PoC employee assignment not found' });
    }
    res.json(mapPocEmployeeData(result.rows[0]));
  } catch (err) {
    console.error(`Error fetching PoC employee assignment ${id}:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: 'Failed to fetch PoC employee assignment', details: errorMessage });
  }
});

// POST to create a new PoC employee assignment (assign employee to PoC)
router.post('/', async (req, res) => {
  const {
    pocId,
    employeeId,
    role, // This is a value from poc_employee_role_enum
    assignedAt, 
  } = req.body;

  if (!pocId || !employeeId || !role) {
    return res.status(400).json({ error: 'Missing required fields: pocId, employeeId, role' });
  }
  
  const assignmentDate = assignedAt ? new Date(assignedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const pocCheck = await client.query('SELECT id FROM pocs WHERE id = $1', [pocId]);
    if (pocCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `PoC with id ${pocId} not found.` });
    }

    const employeeRes = await client.query('SELECT role AS company_role FROM employees WHERE id = $1', [employeeId]);
    if (employeeRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Employee with id ${employeeId} not found.` });
    }
    const companyRole = employeeRes.rows[0].company_role;

    // Role-specific validations
    if (role === POC_ROLE_TECHNICAL_LEAD) {
      if (companyRole !== COMPANY_ROLE_LEAD) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Employee (ID: ${employeeId}) must have company role '${COMPANY_ROLE_LEAD}' to be '${POC_ROLE_TECHNICAL_LEAD}'.` });
      }
      const existing = await client.query("SELECT id FROM poc_employees WHERE poc_id = $1 AND role = $2 AND unassigned_at IS NULL", [pocId, POC_ROLE_TECHNICAL_LEAD]);
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `PoC ${pocId} already has an active Technical Lead.` });
      }
    } else if (role === POC_ROLE_ACCOUNT_MANAGER) {
      if (companyRole !== COMPANY_ROLE_ACCOUNT_MANAGER) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Employee (ID: ${employeeId}) must have company role '${COMPANY_ROLE_ACCOUNT_MANAGER}' to be '${POC_ROLE_ACCOUNT_MANAGER}'.` });
      }
      const existing = await client.query("SELECT id FROM poc_employees WHERE poc_id = $1 AND role = $2 AND unassigned_at IS NULL", [pocId, POC_ROLE_ACCOUNT_MANAGER]);
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `PoC ${pocId} already has an active Account Manager.` });
      }
    } else if (role === POC_ROLE_LEAD_ENGINEER) {
      if (companyRole !== COMPANY_ROLE_TECHNICAL_TEAM) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Employee (ID: ${employeeId}) must have company role '${COMPANY_ROLE_TECHNICAL_TEAM}' to be '${POC_ROLE_LEAD_ENGINEER}'.` });
      }
      const existing = await client.query("SELECT id FROM poc_employees WHERE poc_id = $1 AND role = $2 AND unassigned_at IS NULL", [pocId, POC_ROLE_LEAD_ENGINEER]);
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `PoC ${pocId} already has an active Lead Engineer.` });
      }
    } else if (role === POC_ROLE_SUPPORTING_ENGINEER) {
      if (companyRole !== COMPANY_ROLE_TECHNICAL_TEAM) {
         await client.query('ROLLBACK');
        return res.status(400).json({ error: `Employee (ID: ${employeeId}) must have company role '${COMPANY_ROLE_TECHNICAL_TEAM}' to be '${POC_ROLE_SUPPORTING_ENGINEER}'.` });
      }
    } else {
        await client.query('ROLLBACK'); // Unknown PoC role
        return res.status(400).json({ error: `Invalid PoC role specified: ${role}` });
    }
    
    const duplicateAssignmentCheck = await client.query(
        `SELECT id FROM poc_employees WHERE poc_id = $1 AND employee_id = $2 AND role = $3 AND unassigned_at IS NULL`,
        [pocId, employeeId, role]
    );
    if (duplicateAssignmentCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `Employee (ID: ${employeeId}) is already actively assigned the role '${role}' on this PoC.` });
    }

    const result = await client.query(
      `INSERT INTO poc_employees (poc_id, employee_id, role, assigned_at, unassigned_at) 
      VALUES ($1, $2, $3, $4, NULL)
      RETURNING *`, 
      [pocId, employeeId, role, assignmentDate]
    );
    await client.query('COMMIT');
    
    const newAssignmentDetails = await pool.query( // Use pool for SELECT after commit
         `SELECT pe.*, e.first_name, e.last_name, e.email, e.job_title, e.role AS company_role 
          FROM poc_employees pe JOIN employees e ON pe.employee_id = e.id 
          WHERE pe.id = $1`, [result.rows[0].id]
    );
    res.status(201).json(mapPocEmployeeData(newAssignmentDetails.rows[0]));

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating PoC employee assignment:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: 'Database error during PoC employee assignment creation', details: errorMessage });
  } finally {
    client.release();
  }
});

// PUT to update a PoC employee assignment (e.g., change role, or unassign)
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

    const currentAssignmentRes = await client.query('SELECT poc_id, employee_id, role AS current_poc_role FROM poc_employees WHERE id = $1', [assignmentId]);
    if (currentAssignmentRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Assignment not found.' });
    }
    const { poc_id: currentPocId, employee_id: currentEmployeeId, current_poc_role: currentPocRole } = currentAssignmentRes.rows[0];

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (role !== undefined && role !== currentPocRole) { 
      const employeeRes = await client.query('SELECT role AS company_role FROM employees WHERE id = $1', [currentEmployeeId]);
      const companyRole = employeeRes.rows[0].company_role; 

      let roleConflictMessage = '';
      let companyRoleMismatchMessage = '';

      if (role === POC_ROLE_TECHNICAL_LEAD) {
        if (companyRole !== COMPANY_ROLE_LEAD) companyRoleMismatchMessage = `Employee must have company role '${COMPANY_ROLE_LEAD}' to be '${POC_ROLE_TECHNICAL_LEAD}'.`;
        const existing = await client.query("SELECT id FROM poc_employees WHERE poc_id = $1 AND role = $2 AND unassigned_at IS NULL AND id != $3", [currentPocId, POC_ROLE_TECHNICAL_LEAD, assignmentId]);
        if (existing.rows.length > 0) roleConflictMessage = `PoC ${currentPocId} already has an active Technical Lead.`;
      } else if (role === POC_ROLE_ACCOUNT_MANAGER) {
        if (companyRole !== COMPANY_ROLE_ACCOUNT_MANAGER) companyRoleMismatchMessage = `Employee must have company role '${COMPANY_ROLE_ACCOUNT_MANAGER}' to be '${POC_ROLE_ACCOUNT_MANAGER}'.`;
        const existing = await client.query("SELECT id FROM poc_employees WHERE poc_id = $1 AND role = $2 AND unassigned_at IS NULL AND id != $3", [currentPocId, POC_ROLE_ACCOUNT_MANAGER, assignmentId]);
        if (existing.rows.length > 0) roleConflictMessage = `PoC ${currentPocId} already has an active Account Manager.`;
      } else if (role === POC_ROLE_LEAD_ENGINEER) {
        if (companyRole !== COMPANY_ROLE_TECHNICAL_TEAM) companyRoleMismatchMessage = `Employee must have company role '${COMPANY_ROLE_TECHNICAL_TEAM}' to be '${POC_ROLE_LEAD_ENGINEER}'.`;
        const existing = await client.query("SELECT id FROM poc_employees WHERE poc_id = $1 AND role = $2 AND unassigned_at IS NULL AND id != $3", [currentPocId, POC_ROLE_LEAD_ENGINEER, assignmentId]);
        if (existing.rows.length > 0) roleConflictMessage = `PoC ${currentPocId} already has an active Lead Engineer.`;
      } else if (role === POC_ROLE_SUPPORTING_ENGINEER) {
         if (companyRole !== COMPANY_ROLE_TECHNICAL_TEAM) companyRoleMismatchMessage = `Employee must have company role '${COMPANY_ROLE_TECHNICAL_TEAM}' to be '${POC_ROLE_SUPPORTING_ENGINEER}'.`;
      } else {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Invalid new PoC role specified: ${role}` });
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
          FROM poc_employees pe JOIN employees e ON pe.employee_id = e.id 
          WHERE pe.id = $1`, [assignmentId]
        );
      return res.json(mapPocEmployeeData(currentDetails.rows[0]));
    }

    values.push(assignmentId); 

    const queryText = `
      UPDATE poc_employees 
      SET ${updates.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING *
    `;
    const result = await client.query(queryText, values);
    
    await client.query('COMMIT');

    const updatedAssignmentDetails = await pool.query( // Use pool for SELECT
         `SELECT pe.*, e.first_name, e.last_name, e.email, e.job_title, e.role AS company_role 
          FROM poc_employees pe JOIN employees e ON pe.employee_id = e.id 
          WHERE pe.id = $1`, [result.rows[0].id]
    );
    res.json(mapPocEmployeeData(updatedAssignmentDetails.rows[0]));

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`Error updating PoC employee assignment ${id}:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: 'Database error during PoC employee assignment update', details: errorMessage });
  } finally {
    client.release();
  }
});

// DELETE a PoC employee assignment
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
   const assignmentId = parseInt(id, 10);
   if (isNaN(assignmentId)) {
    return res.status(400).json({ error: 'Invalid assignment ID format.' });
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const assignmentToDelete = await client.query('SELECT role FROM poc_employees WHERE id = $1', [assignmentId]);
    if (assignmentToDelete.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'PoC employee assignment not found' });
    }
    const roleToDelete = assignmentToDelete.rows[0].role;

    // Prevent deletion of the sole active PoC Technical Lead or Account Manager
    // unless you have specific business logic to handle this (e.g., force assignment of a new one first).
    if (roleToDelete === POC_ROLE_TECHNICAL_LEAD || roleToDelete === POC_ROLE_ACCOUNT_MANAGER) {
        const otherSimilarRoles = await client.query(
            `SELECT id FROM poc_employees WHERE poc_id = (SELECT poc_id FROM poc_employees WHERE id = $1) 
             AND role = $2 AND unassigned_at IS NULL AND id != $1`,
            [assignmentId, roleToDelete]
        );
        if (otherSimilarRoles.rows.length === 0) { // This means it's the only one
             await client.query('ROLLBACK');
             return res.status(400).json({ error: `Cannot delete the only active ${roleToDelete} for this PoC. Assign a new one first or unassign this member.`});
        }
    }

    const result = await client.query(
      'DELETE FROM poc_employees WHERE id = $1 RETURNING *',
      [assignmentId]
    );
    // No need to check result.rows.length again, already done.
    
    await client.query('COMMIT');
    res.status(200).json({ 
        message: 'PoC employee assignment deleted successfully', 
        deletedAssignment: { // Return basic info as employee details might not be easily joinable after delete
            id: result.rows[0].id,
            pocId: result.rows[0].poc_id,
            employeeId: result.rows[0].employee_id,
            role: result.rows[0].role
        }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`Error deleting PoC employee assignment ${id}:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: 'Database error during PoC employee assignment deletion', details: errorMessage });
  } finally {
    client.release();
  }
});

export default router;
