import express from 'express';
import pool from '../db'; // Ensure this path is correct

const router = express.Router();

const getLevelFromGradeBE = (grade?: string | null): string | null => {
  if (!grade) return null;
  const gradeNum = parseInt(grade.replace('G', ''), 10);
  if (isNaN(gradeNum)) return null;

  if (gradeNum === 1) return 'Fresh';
  if (gradeNum >= 2 && gradeNum <= 4) return `Junior ${'I'.repeat(gradeNum - 1)}`;
  if (gradeNum >= 5 && gradeNum <= 6) return `Specialist ${'I'.repeat(gradeNum - 4)}`;
  if (gradeNum >= 7 && gradeNum <= 8) return 'Specialist III';
  if (gradeNum >= 9 && gradeNum <= 11) return `Senior ${'I'.repeat(gradeNum - 8)}`;
  if (gradeNum === 12) return 'Lead';
  if (gradeNum === 13) return 'Senior Lead';
  if (gradeNum === 14) return 'Associate Technical Manager';
  if (gradeNum === 15) return 'Senior Technical Manager';
  
  return null; // Return null if grade is out of range
};

// Helper to map DB row to a more frontend-friendly Employee object
// Note: Your frontend Employee interface should be updated to match this structure
const mapEmployeeData = (dbRow: any) => {
  if (!dbRow) return null;
  return {
    id: dbRow.id,
    firstName: dbRow.first_name,
    lastName: dbRow.last_name,
    email: dbRow.email,
    phoneNumber: dbRow.phone_number,
    workExt: dbRow.work_ext, // integer
    jobTitle: dbRow.job_title,
    role: dbRow.role, // Assuming employee_role_enum comes as string
    managerEmail: dbRow.manager_email,
    status: dbRow.status, // Assuming employee_status_enum comes as string
    skills: dbRow.skills, // pg driver should parse JSON
    certificates: dbRow.certificates, // pg driver should parse JSON
    location: dbRow.location, // Assuming employee_location_enum comes as string
    createdAt: dbRow.created_at,
    updatedAt: dbRow.updated_at,
  };
};

const mapEmployeeProfileData = (dbRow: any) => {
  if (!dbRow) return null;
  return {
    id: dbRow.id.toString(),
    firstName: dbRow.first_name,
    lastName: dbRow.last_name,
    name: `${dbRow.first_name} ${dbRow.last_name}`,
    email: dbRow.email,
    jobTitle: dbRow.job_title,
    team: dbRow.team,
    level: dbRow.level, // The level stored in the DB (which should be kept up-to-date)
    grade: dbRow.grade,
    yearsOfExperience: dbRow.years_of_experience,
    skills: dbRow.skills || [],
    certificates: dbRow.certificates || [],
    fields_covered: dbRow.fields_covered || [],
    technical_development_plan: dbRow.technical_development_plan || [],
  };
};

const mapCombinedEmployeeData = (dbRow: any) => {
  if (!dbRow) return null;
  return {
    id: dbRow.id,
    firstName: dbRow.first_name,
    lastName: dbRow.last_name,
    name: `${dbRow.first_name} ${dbRow.last_name}`,
    email: dbRow.email,
    phoneNumber: dbRow.phone_number,
    workExt: dbRow.work_ext,
    jobTitle: dbRow.job_title,
    role: dbRow.role, 
    managerEmail: dbRow.manager_email,
    status: dbRow.status,
    location: dbRow.location,
    createdAt: dbRow.created_at,
    updatedAt: dbRow.updated_at,
    // Profile-specific fields (will be null if no profile exists)
    team: dbRow.team,
    level: dbRow.level,
    grade: dbRow.grade,
    yearsOfExperience: dbRow.years_of_experience,
    skills: dbRow.skills || [], // Default to empty array if null
    certificates: dbRow.certificates || [], // Default to empty array if null
    fields_covered: dbRow.fields_covered || [],
    technical_development_plan: dbRow.technical_development_plan || [],
  };
};

// GET all employees
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        id, first_name, last_name, email, phone_number, 
        work_ext, job_title, role, manager_email, status, 
        skills, certificates, location, created_at, updated_at 
      FROM employees ORDER BY last_name, first_name`
    );
    res.json(result.rows.map(mapEmployeeData));
  } catch (err) {
    console.error('Error fetching employees:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: 'Failed to fetch employees', details: errorMessage });
  }
});

// GET a single employee by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT 
        id, first_name, last_name, email, phone_number, 
        work_ext, job_title, role, manager_email, status, 
        skills, certificates, location, created_at, updated_at 
      FROM employees WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json(mapEmployeeData(result.rows[0]));
  } catch (err) {
    console.error(`Error fetching employee ${id}:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: 'Failed to fetch employee', details: errorMessage });
  }
});


// router.get('/technical-profile/:employeeId', async (req, res) => {
//   const { employeeId } = req.params;
//   try {
//     const result = await pool.query(
//       `SELECT
//           e.id,          -- From employees table
//           e.first_name,                 -- From employees table
//           e.last_name,                  -- From employees table
//           e.email,                      -- From employees table
//           e.job_title,                  -- From employees table
//           ep.team,                      -- From employee_profiles table
//           ep.level,                     -- From employee_profiles table
//           ep.grade,                     -- From employee_profiles table
//           ep.years_of_experience,       -- From employee_profiles table
//           ep.skills,                    -- From employee_profiles table (TEXT[] type)
//           ep.certificates               -- From employee_profiles table (TEXT[] type)
//       FROM
//           employees e                   -- Alias employees table as 'e'
//       INNER JOIN
//           employee_profiles ep          -- Alias employee_profiles table as 'ep'
//       ON
//           e.id = ep.employee_id         -- The join condition
//       WHERE
//           e.id = $1;                    -- Placeholder for the specific employee ID you're fetching`,
//       [employeeId]
//     );
//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: 'Employee not found' });
//     }
//     res.json(mapEmployeeProfileData(result.rows[0]));
//   } catch (err) {
//     console.error(`Error fetching employee ${employeeId}:`, err);
//     const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
//     res.status(500).json({ error: 'Failed to fetch employee profile', details: errorMessage });
//   }
// });

router.get('/technical-profile/:employeeId', async (req, res) => {
  const { employeeId } = req.params;
  try {
    const result = await pool.query(
      `SELECT
          e.id, e.first_name, e.last_name, e.email, e.job_title,
          ep.team, ep.level, ep.grade, ep.years_of_experience,
          ep.skills, ep.certificates,
          ep.fields_covered, ep.technical_development_plan -- Added new fields
       FROM employees e
       INNER JOIN employee_profiles ep ON e.id = ep.employee_id
       WHERE e.id = $1;`,
      [employeeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found or has no technical profile.' });
    }
    res.json(mapEmployeeProfileData(result.rows[0]));

  } catch (err) {
    console.error(`Error fetching employee ${employeeId}:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: 'Failed to fetch employee profile', details: errorMessage });
  }
});

// GET a single employee by email
router.get('/:email', async (req, res) => {
  const { email } = req.params;
  try {
    const result = await pool.query(
      `SELECT 
        id, first_name, last_name, email, phone_number, 
        work_ext, job_title, role, manager_email, status, 
        skills, certificates, location, created_at, updated_at 
      FROM employees WHERE email = $1`,
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json(mapEmployeeData(result.rows[0]));
  } catch (err) {
    console.error(`Error fetching employee ${email}:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: 'Failed to fetch employee', details: errorMessage });
  }
});

/// POST to create a new employee
router.post('/', async (req, res) => {
  const {
    firstName, lastName, email, phoneNumber, workExt, // workExt is NOT NULL in DB
    jobTitle, role, managerEmail, status, skills, certificates, location
  } = req.body;

  // Validate required fields based on DB schema (NOT NULL constraints)
  if (
    !firstName || !lastName || !email || !phoneNumber || 
    workExt === undefined || workExt === null || // Check for presence since it's NOT NULL
    !jobTitle || !role || !status || 
    !skills || !certificates // skills and certificates are NOT NULL in your schema
  ) {
    return res.status(400).json({ 
      error: 'Missing required fields. Required: firstName, lastName, email, phoneNumber, workExt, jobTitle, role, status, skills, certificates. Optional: managerEmail, location.' 
    });
  }

  // Validate email formats
  if (!/^[A-Za-z0-9._%+-]+@taqniyat\.com\.sa$/i.test(email)) {
      return res.status(400).json({ error: 'Invalid email format. Must be @taqniyat.com.sa' });
  }
  if (managerEmail && !/^[A-Za-z0-9._%+-]+@taqniyat\.com\.sa$/i.test(managerEmail)) {
      return res.status(400).json({ error: 'Invalid manager email format. Must be @taqniyat.com.sa' });
  }

  // Validate and parse workExt
  const workExtNum = parseInt(workExt, 10);
  if (isNaN(workExtNum)) { // Also check if original workExt was empty string if parsing fails
      return res.status(400).json({ error: 'Work extension must be a valid number.' });
  }

  try {

    await pool.query('BEGIN');
    const result = await pool.query(
      `INSERT INTO employees 
        (first_name, last_name, email, phone_number, work_ext, job_title, role, manager_email, status, skills, certificates, location, created_at, updated_at) 
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      RETURNING *`, 
      [
        firstName, lastName, email, phoneNumber, workExtNum, 
        jobTitle, role, managerEmail || null, status, 
        JSON.stringify(skills), // skills is NOT NULL, ensure frontend sends at least []
        JSON.stringify(certificates), // certificates is NOT NULL
        location || null
      ]
    );

    const newEmployee = result.rows[0];
    const newEmployeeId = newEmployee.id;
    const newEmployeeRole = newEmployee.role;

    // 2. Check if the employee's role requires a detailed profile
    const rolesThatNeedProfile = ['Technical Team', 'Managed Services'];
    if (rolesThatNeedProfile.includes(newEmployeeRole)) {
        console.log(`Role '${newEmployeeRole}' requires a profile. Creating default profile for employee ID: ${newEmployeeId}`);

        // 3. Create the default profile and insert it into 'employee_profiles'
        const defaultGrade = 'G1';
        const derivedLevel = getLevelFromGradeBE(defaultGrade);

        const profileInsertQuery = `
            INSERT INTO employee_profiles (
                employee_id, team, grade, level, years_of_experience,
                skills, certificates, fields_covered, technical_development_plan,
                created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        `;
        await pool.query(profileInsertQuery, [
            newEmployeeId, 'Delivery', defaultGrade, derivedLevel, '0',
            '{}', '{}', '{}', '{}'
        ]);
    }

    // 4. If everything was successful, commit the transaction
    await pool.query('COMMIT');

    const getCreatedEmployeeQuery = `
      SELECT
          e.*, -- Select all columns from employees
          ep.team, ep.level, ep.grade, ep.years_of_experience,
          ep.fields_covered, ep.technical_development_plan
          -- Note: we use e.skills and e.certificates from the main table, 
          -- as employee_profiles might have more specific ones later. Adjust if needed.
      FROM
          employees e
      LEFT JOIN 
          employee_profiles ep ON e.id = ep.employee_id
      WHERE
          e.id = $1;
    `;
    
    const createdEmployeeResult = await pool.query(getCreatedEmployeeQuery, [newEmployeeId]);
    
    if (createdEmployeeResult.rows.length === 0) {
      return res.status(500).json({ error: "Failed to retrieve created employee details after creation." });
    }
    
    // Use a single, comprehensive mapping function for the response
    res.status(201).json(mapCombinedEmployeeData(createdEmployeeResult.rows[0]));

    
  } catch (err: any) {
    await pool.query('ROLLBACK');
    console.error('Error creating new employee and profile:', err);
    if (err.code === '23505') { 
      return res.status(409).json({ error: `Employee creation failed: ${err.detail || 'A unique field (like email or phone) already exists.'}` });
    }
    if (err.code === '23514' && err.constraint?.includes('_check')) { 
        return res.status(400).json({ error: `Invalid input: ${err.detail || err.message}`});
    }
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: 'Database error during employee creation', details: errorMessage });
  }
});


// PUT to update employee info
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const employeeId = parseInt(id, 10);
  if (isNaN(employeeId)) {
    return res.status(400).json({ error: 'Invalid employee ID format.' });
  }

  const dataToUpdate = req.body;
  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  const fieldMapping: { [key: string]: string } = {
    firstName: 'first_name', lastName: 'last_name', email: 'email',
    phoneNumber: 'phone_number', workExt: 'work_ext', jobTitle: 'job_title',
    role: 'role', managerEmail: 'manager_email', status: 'status',
    skills: 'skills', certificates: 'certificates', location: 'location',
  };

  for (const key in dataToUpdate) {
    if (Object.prototype.hasOwnProperty.call(dataToUpdate, key) && fieldMapping[key]) {
      const dbColumn = fieldMapping[key];
      let value = dataToUpdate[key];

      if (dbColumn === 'work_ext') {
        if (value === null || value === '' || value === undefined) { // work_ext is NOT NULL
            return res.status(400).json({ error: `Work extension is required and must be a valid number.` });
        }
        value = parseInt(value, 10);
        if (isNaN(value)) {
            return res.status(400).json({ error: `Invalid value for work extension: ${dataToUpdate[key]}` });
        }
      } else if (dbColumn === 'skills' || dbColumn === 'certificates') { // skills/certs are NOT NULL
        if (!Array.isArray(value)) { // If not an array, try to parse from comma-separated string
             value = value ? String(value).split(',').map(s => s.trim()).filter(Boolean) : [];
        }
        value = JSON.stringify(value); 
      } else if (value === '' && (dbColumn === 'manager_email' || dbColumn === 'location')) { 
            value = null; // Allow clearing optional text fields
      }
      
      updates.push(`${dbColumn} = $${paramCount++}`);
      values.push(value);
    }
  }

  if (updates.length === 0) {
    try {
        const currentDataResult = await pool.query("SELECT * FROM employees WHERE id = $1", [employeeId]);
        if (currentDataResult.rows.length === 0) return res.status(404).json({ error: 'Employee not found' });
        return res.json(mapEmployeeData(currentDataResult.rows[0]));
    } catch (fetchErr) {
        console.error(`Error fetching employee ${employeeId} during no-op update:`, fetchErr);
        return res.status(500).json({ error: 'Failed to fetch employee data' });
    }
  }

  updates.push(`updated_at = NOW()`);
  values.push(employeeId); 

  try {
    if (dataToUpdate.email && !/^[A-Za-z0-9._%+-]+@taqniyat\.com\.sa$/i.test(dataToUpdate.email)) {
      return res.status(400).json({ error: 'Invalid email format. Must be @taqniyat.com.sa' });
    }
    if (dataToUpdate.managerEmail && dataToUpdate.managerEmail !== null && !/^[A-Za-z0-9._%+-]+@taqniyat\.com\.sa$/i.test(dataToUpdate.managerEmail)) {
        return res.status(400).json({ error: 'Invalid manager email format. Must be @taqniyat.com.sa' });
    }

    const queryText = `
      UPDATE employees
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING * `; 
    const result = await pool.query(queryText, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found or not updated' });
    }
    res.json(mapEmployeeData(result.rows[0]));
  } catch (err: any) {
    console.error(`Error updating employee ${id}:`, err);
     if (err.code === '23505') { 
      return res.status(409).json({ error: `Update failed: ${err.detail || 'A unique field (like email or phone) already exists for another employee.'}` });
    }
    if (err.code === '23514' && err.constraint?.includes('_check')) {
        return res.status(400).json({ error: `Invalid input: ${err.detail || err.message}`});
    }
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: 'Database error during employee update', details: errorMessage });
  }
});

// DELETE an employee
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const employeeId = parseInt(id, 10);
  if (isNaN(employeeId)) {
    return res.status(400).json({ error: 'Invalid employee ID format.' });
  }
  try {
    const result = await pool.query(
      'DELETE FROM employees WHERE id = $1 RETURNING id, first_name, last_name', 
      [employeeId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.status(200).json({ message: 'Employee deleted successfully', deletedEmployee: result.rows[0] });
  } catch (err: any) {
    console.error(`Error deleting employee ${id}:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: 'Database error during employee deletion', details: errorMessage });
  }
});

// router.put('/technical-profile/:employeeId', async (req, res) => {
//   const { employeeId: employeeIdParam } = req.params;
//   const payload: any = req.body; // Treat payload as any, similar to the reference

//   if (!employeeIdParam) {
//     return res.status(400).json({ error: 'Employee ID is required in the URL.' });
//   }

//   const parsedEmployeeId = parseInt(employeeIdParam, 10);
//   if (isNaN(parsedEmployeeId)) {
//     return res.status(400).json({ error: 'Invalid Employee ID format.' });
//   }

//   const updates: string[] = [];
//   const values: any[] = [];
//   let paramCount = 1;

//   // Field mapping from potential payload keys to database column names for employee_profiles
//   // This allows flexibility in what the frontend sends, but only mapped fields will be processed.
//   const fieldMapping: { [key: string]: string } = {
//     team: 'team',
//     level: 'level',
//     grade: 'grade',
//     yearsOfExperience: 'years_of_experience',
//     skills: 'skills',
//     certificates: 'certificates',
//   };

//   for (const key in payload) {
//     if (Object.prototype.hasOwnProperty.call(payload, key) && fieldMapping[key]) {
//       const dbColumn = fieldMapping[key];
//       let value = payload[key];

//       // Specific type handling or validation based on your reference logic
//       if (dbColumn === 'years_of_experience') {
//         if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
//             return res.status(400).json({ error: `Years of experience is required and must be a valid number.` });
//         }
//         const numValue = Number(value);
//         if (isNaN(numValue) || numValue < 0) {
//             return res.status(400).json({ error: `Invalid value for years of experience: ${value}` });
//         }
//         value = numValue.toString(); // Store as VARCHAR as per previous DB schema
//       } else if (dbColumn === 'skills' || dbColumn === 'certificates') {
//         if (!Array.isArray(value)) {
//             value = value ? String(value).split(',').map((s: string) => s.trim()).filter(Boolean) : [];
//         }
//         // For TEXT[] columns, the pg driver handles array conversion directly.
//         // No JSON.stringify needed.
//       } else if (value === '' && (dbColumn === 'team' || dbColumn === 'level' || dbColumn === 'grade')) {
//         // If your DB columns for these allow NULL and an empty string should mean NULL:
//         // value = null;
//         // Otherwise, if they are ENUMs or have NOT NULL constraints,
//         // an empty string might be invalid or handled by DB constraints.
//         // For now, let it pass as is, assuming frontend sends valid ENUM values or DB handles it.
//       }
      
//       updates.push(`${dbColumn} = $${paramCount++}`);
//       values.push(value);
//     }
//   }

//   if (updates.length === 0) {
//     // No valid fields to update were provided. Fetch and return current data.
//     try {
//         const combinedProfileQuery = `
//             SELECT e.id, e.first_name, e.last_name, e.email, e.job_title,
//                    ep.team, ep.level, ep.grade, ep.years_of_experience, ep.skills, ep.certificates
//             FROM employees e LEFT JOIN employee_profiles ep ON e.id = ep.employee_id
//             WHERE e.id = $1;`;
//         const currentDataResult = await pool.query(combinedProfileQuery, [parsedEmployeeId]);
//         if (currentDataResult.rows.length === 0) {
//             return res.status(404).json({ error: 'Employee not found' });
//         }
//         const dbRow = currentDataResult.rows[0];
//         const responseProfile = {
//             id: dbRow.id.toString(),
//             name: `${dbRow.first_name} ${dbRow.last_name}`,
//             email: dbRow.email,
//             jobTitle: dbRow.job_title,
//             team: dbRow.team,
//             level: dbRow.level,
//             grade: dbRow.grade,
//             yearsOfExperience: dbRow.years_of_experience,
//             skills: dbRow.skills || [],
//             certificates: dbRow.certificates || [],
//         };
//         return res.json(responseProfile);
//     } catch (fetchErr) {
//         console.error(`Error fetching employee profile for ID ${parsedEmployeeId} during no-op update:`, fetchErr);
//         const errorMessage = fetchErr instanceof Error ? fetchErr.message : 'Unknown database error';
//         return res.status(500).json({ error: 'Failed to fetch employee data', details: errorMessage });
//     }
//   }

//   updates.push(`updated_at = CURRENT_TIMESTAMP`);
//   values.push(parsedEmployeeId); // Add employeeId for the WHERE clause

//   try {
//     const updateQuery = `
//       UPDATE employee_profiles
//       SET ${updates.join(', ')}
//       WHERE employee_id = $${paramCount}
//       RETURNING employee_id; 
//     `;
    
//     const result = await pool.query(updateQuery, values);

//     if (result.rowCount === 0) {
//       return res.status(404).json({ error: `Employee profile not found or not updated for employee_id: ${parsedEmployeeId}. Ensure a profile exists.` });
//     }

//     // Fetch the full combined profile to return, ensuring data consistency
//     const combinedProfileQuery = `
//         SELECT
//             e.id, 
//             e.first_name,
//             e.last_name,
//             e.email,
//             e.job_title,
//             ep.team,
//             ep.level,
//             ep.grade,
//             ep.years_of_experience,
//             ep.skills,
//             ep.certificates
//         FROM
//             employees e
//         INNER JOIN 
//             employee_profiles ep ON e.id = ep.employee_id
//         WHERE
//             e.id = $1;
//     `;
//     const combinedResult = await pool.query(combinedProfileQuery, [parsedEmployeeId]);

//     if (combinedResult.rows.length === 0) {
//         return res.status(404).json({ error: 'Updated employee profile data could not be retrieved (post-update fetch failed).' });
//     }
    
//     const dbRow = combinedResult.rows[0];
//     // This structure should match TechnicalTeamMemberProfile in the frontend
//     const responseProfile = { 
//         id: dbRow.id, 
//         name: `${dbRow.first_name} ${dbRow.last_name}`, 
//         email: dbRow.email,
//         jobTitle: dbRow.job_title,
//         team: dbRow.team,
//         level: dbRow.level,
//         grade: dbRow.grade,
//         yearsOfExperience: dbRow.years_of_experience,
//         skills: dbRow.skills || [],
//         certificates: dbRow.certificates || [],
//     };

//     res.json(responseProfile);

//   } catch (err: any) {
//     console.error(`Error updating employee profile for employee_id ${parsedEmployeeId}:`, err);
//     if (err.code === '23503') { 
//         return res.status(400).json({ error: `Invalid employee ID or related data. Ensure employee exists.` });
//     }
//     if (err.code === '23514') { // Check constraint violation (e.g., invalid ENUM value)
//         return res.status(400).json({ error: `Invalid input for a field: ${err.constraint || err.detail || err.message}`});
//     }
//     // Add other specific PostgreSQL error codes as needed
//     const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
//     res.status(500).json({ error: 'Database error during employee profile update', details: errorMessage });
//   }
// });

router.put('/technical-profile/:employeeId', async (req, res) => {
  const { employeeId: employeeIdParam } = req.params;
  const payload: any = req.body;

  const parsedEmployeeId = parseInt(employeeIdParam, 10);
  if (isNaN(parsedEmployeeId)) {
    return res.status(400).json({ error: 'Invalid employee ID format.' });
  }

  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  const fieldMapping: { [key: string]: string } = {
    team: 'team',
    grade: 'grade',
    yearsOfExperience: 'years_of_experience',
    skills: 'skills',
    certificates: 'certificates',
    fields_covered: 'fields_covered',
    technical_development_plan: 'technical_development_plan',
  };

  // If 'grade' is part of the payload, derive 'level' and add it to be updated
  if (payload.grade) {
      const derivedLevel = getLevelFromGradeBE(payload.grade);
      if (derivedLevel) {
          updates.push(`level = $${paramCount++}`);
          values.push(derivedLevel);
      }
  }

  for (const key in payload) {
    if (Object.prototype.hasOwnProperty.call(payload, key) && fieldMapping[key]) {
      const dbColumn = fieldMapping[key];
      let value = payload[key];

      if (dbColumn === 'years_of_experience') {
        const numValue = Number(value);
        if (isNaN(numValue) || numValue < 0) {
            return res.status(400).json({ error: `Invalid value for years of experience: ${value}` });
        }
        value = numValue.toString();
      } else if (['skills', 'certificates', 'fields_covered', 'technical_development_plan'].includes(dbColumn)) {
        if (!Array.isArray(value)) {
            value = value ? String(value).split(',').map((s: string) => s.trim()).filter(Boolean) : [];
        }
      }
      
      updates.push(`${dbColumn} = $${paramCount++}`);
      values.push(value);
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid fields provided for update.' });
  }

  updates.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(parsedEmployeeId);

  try {
    const updateQuery = `
      UPDATE employee_profiles
      SET ${updates.join(', ')}
      WHERE employee_id = $${paramCount}
      RETURNING employee_id; 
    `;
    
    const result = await pool.query(updateQuery, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: `Employee profile not found for employee_id: ${parsedEmployeeId}.` });
    }

    // Fetch and return the full, combined profile after update
    const combinedProfileQuery = `
        SELECT
            e.id, e.first_name, e.last_name, e.email, e.job_title,
            ep.team, ep.level, ep.grade, ep.years_of_experience,
            ep.skills, ep.certificates, ep.fields_covered, ep.technical_development_plan
        FROM employees e
        INNER JOIN employee_profiles ep ON e.id = ep.employee_id
        WHERE e.id = $1;
    `;
    const combinedResult = await pool.query(combinedProfileQuery, [parsedEmployeeId]);

    res.json(mapEmployeeProfileData(combinedResult.rows[0]));

  } catch (err: any) {
    console.error(`Error updating employee profile for employee_id ${parsedEmployeeId}:`, err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
    res.status(500).json({ error: 'Database error during profile update', details: errorMessage });
  }
});

router.get('/search/mentions', async (req, res) => {
  const query = req.query.q as string;

  // Basic validation for the query parameter
  if (!query || typeof query !== 'string' || query.trim().length < 1) { 
    // Require at least 1 char for search, adjust as needed
    // Return empty array for invalid/short queries, or a 400 error if preferred
    return res.status(400).json({ error: 'A search query string (q) is required and must be at least 1 character long.' });
    // Alternatively, to silently return no results:
    // return res.json([]); 
  }

  try {
    // Case-insensitive search for first_name, last_name, or full name containing the query
    // The '||' operator is for string concatenation in PostgreSQL.
    // ILIKE is for case-insensitive pattern matching.
    const searchQuery = `
      SELECT
        id,          
        first_name,
        last_name,
        email,       
        job_title    
      FROM
        employees
      WHERE
        first_name ILIKE $1 OR
        last_name ILIKE $1 OR
        (first_name || ' ' || last_name) ILIKE $1 OR
        email ILIKE $1 
      ORDER BY
        first_name ASC, last_name ASC
      
    `;
    
    const values = [`%${query}%`]; // '%' are wildcards for 'contains' search

    const result = await pool.query(searchQuery, values);

    // Format the results for react-mentions (id, display)
    // and include any other data you might want for custom suggestion rendering
    const suggestions = result.rows.map(emp => ({
      id: emp.id.toString(), // react-mentions expects id to be string or number for its key
      display: `${emp.first_name} ${emp.last_name}`, // This is what's shown in dropdown & inserted by default
      // You can add more fields if you use a custom renderSuggestion function in react-mentions
      firstName: emp.first_name,
      lastName: emp.last_name,
      email: emp.email,
      jobTitle: emp.job_title,
    }));

    res.json(suggestions);

  } catch (err) {
    console.error(`Error searching employees for mention with query "${query}":`, err);
    // Generic error for the client, specific error logged on the server
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
    res.status(500).json({ error: 'Failed to search employees due to a server error.', details: errorMessage });
  }
});

export default router;
