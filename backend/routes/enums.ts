import express from 'express';
import pool from '../db'; // Ensure this path is correct

const router = express.Router();

// Helper function to fetch enum values
const getEnumValues = async (enumTypeName: string, res: express.Response) => {
  try {
    // Make sure enumTypeName is sanitized or from a controlled list to prevent SQL injection
    // For this example, we assume enumTypeName is a valid, known enum type name.
    const query = `SELECT unnest(enum_range(NULL::${enumTypeName})) AS value;`;
    const result = await pool.query(query);
    res.json(result.rows.map(row => row.value));
  } catch (err) {
    console.error(`Error fetching enum values for ${enumTypeName}:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: `Failed to fetch ${enumTypeName} values`, details: errorMessage });
  }
};

// Endpoint for PoC Statuses
router.get('/poc-statuses', async (req, res) => {
  await getEnumValues('poc_status_enum', res);
});

// Endpoint for Project statuses
router.get('/project-statuses', async (req, res) => {
  await getEnumValues('project_status_enum', res);
});

// Endpoint for Employee Roles
router.get('/employee-roles', async (req, res) => {
  await getEnumValues('employee_role_enum', res);
});

// Endpoint for Employee Locations
router.get('/employee-locations', async (req, res) => {
  await getEnumValues('employee_location_enum', res);
});

// Endpoint for Employee Statuses
router.get('/employee-statuses', async (req, res) => {
  await getEnumValues('employee_status_enum', res);
});

// Endpoint for Industry Types
router.get('/industries', async (req, res) => {
  await getEnumValues('industry_enum', res);
});

// Endpoint for Organization Types
router.get('/organization-types', async (req, res) => {
  await getEnumValues('organization_type_enum', res);
});

// Endpoint for PoC Employee Roles
router.get('/poc-employee-roles', async (req, res) => {
  await getEnumValues('poc_employee_role_enum', res);
});

router.get('/project-employee-roles', async (req, res) => {
  await getEnumValues('project_employee_role_enum', res);
});

router.get('/address-types', async (req, res) => {
  await getEnumValues('address_type', res);
});

router.get('/task-statuses', async (req, res) => {
  await getEnumValues('task_status_enum', res);
});


export default router;
