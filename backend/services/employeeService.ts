import pool from '../db'; // Assuming your DB pool is here

export async function getEmployeeProfileDetails(email: string): Promise<any | null> { // Define a proper type for Employee details
  try {

    const result = await pool.query(
      `SELECT 
         id, first_name, last_name, email, phone_number, 
         work_ext, job_title, role, manager_email, status, 
         skills, certificates, location, created_at, updated_at 
       FROM employees WHERE email = $1`,
      [email]
    );
    if (result.rows.length > 0) {
      // return mapEmployeeData(result.rows[0]); // If you have a mapping function
      const dbRow = result.rows[0];
      return {
        id: dbRow.id,
        name: `${dbRow.first_name} ${dbRow.last_name}`,
        phone: dbRow.phone_number,
        email: dbRow.email,
        workExt: dbRow.work_ext,
        jobTitle: dbRow.job_title,
        role: dbRow.role,
        managerEmail: dbRow.manager_email,
        status: dbRow.status,
        skills: dbRow.skills,
        certificates: dbRow.certificates,
        location: dbRow.location
      };
    }
    return null;
  } catch (err) {
    console.error(`Error fetching employee by email ${email} from DB:`, err);
    throw err; // Or handle more gracefully
  }
}


export async function getEmployeeProfileDetailsByID(id: number): Promise<any | null> { // Define a proper type for Employee details
  try {

    const result = await pool.query(
      `SELECT 
         id, first_name, last_name, email, phone_number, 
         work_ext, job_title, role, manager_email, status, 
         skills, certificates, location, created_at, updated_at 
       FROM employees WHERE id = $1`,
      [id]
    );
    if (result.rows.length > 0) {
      // return mapEmployeeData(result.rows[0]); // If you have a mapping function
      const dbRow = result.rows[0];
      return {
        id: dbRow.id,
        name: `${dbRow.first_name} ${dbRow.last_name}`,
        phone: dbRow.phone_number,
        email: dbRow.email,
        workExt: dbRow.work_ext,
        jobTitle: dbRow.job_title,
        role: dbRow.role,
        managerEmail: dbRow.manager_email,
        status: dbRow.status,
        skills: dbRow.skills,
        certificates: dbRow.certificates,
        location: dbRow.location
      };
    }
    return null;
  } catch (err) {
    console.error(`Error fetching employee by email ${id} from DB:`, err);
    throw err; // Or handle more gracefully
  }
}