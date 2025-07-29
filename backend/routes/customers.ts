import express from "express";
import pool from "../db"; // Ensure this path is correct to your database connection pool
import { Pool } from "pg";

const router = express.Router();

// Helper to map DB row to a more frontend-friendly Customer object
// Your frontend Customer interface should align with this structure.
const mapCustomerData = (dbRow: any) => {
  if (!dbRow) return null;
  return {
    id: dbRow.id,
    name: dbRow.name,
    website: dbRow.website,
    contactPerson: dbRow.contact_person,
    contactEmail: dbRow.contact_email,
    contactPhone: dbRow.contact_phone,
    industry: dbRow.industry,
    organizationType: dbRow.organization_type,
    createdAt: dbRow.created_at,
    updatedAt: dbRow.updated_at,
    addresses: dbRow.addresses,
    accountManagerId: dbRow.account_manager_id,
    accountManager: dbRow.account_manager,
  };
};

// GET all customers
// In backend/routes/customers.ts

// GET all customers with their addresses (using a more compatible query)
// In backend/routes/customers.ts

// GET all customers with their addresses (Single-line query for maximum compatibility)
router.get("/", async (req, res) => {
  const { employeeId, applicationRole } = req.user || {};
  try {
    // This query is functionally identical to the last one, but formatted as a single line
    // to prevent any errors from invisible characters or whitespace during copy-pasting.
    let query = `
    SELECT
      c.id, c.name, c.website, c.contact_person, c.contact_email, c.contact_phone,
      c.industry, c.organization_type, c.created_at, c.updated_at, c.account_manager_id,
      COALESCE(addr.addresses, '[]'::json) as addresses,
      json_build_object(
        'id', am.id,
        'firstName', am.first_name,
        'lastName', am.last_name
      ) AS account_manager
    FROM customers c
    LEFT JOIN (
      SELECT
        customer_id,
        json_agg(
          json_build_object(
            'id', id, 'customerId', customer_id, 'street', street,
            'district', district, 'postalCode', postal_code, 'city', city,
            'country', country, 'type', type, 'locationUrl', location_url
          ) ORDER BY type, id
        ) as addresses
      FROM addresses
      GROUP BY customer_id
    ) addr ON c.id = addr.customer_id
    LEFT JOIN employees am ON c.account_manager_id = am.id
  `;
    const queryParams = [];

    // If the user is an Account Manager, filter the results
    if (applicationRole === "account_manager") {
      queryParams.push(employeeId);
      query += ` WHERE c.account_manager_id = $${queryParams.length}`;
    }

    query += " ORDER BY c.name;";

    const result = await pool.query(query);
    res.json(result.rows.map(mapCustomerData));
  } catch (err) {
    console.error("Error fetching customers:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Unknown database error";
    res
      .status(500)
      .json({ error: "Failed to fetch customers", details: errorMessage });
  }
});

// GET a single customer by ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const query = `
      SELECT
        c.id, c.name, c.website, c.contact_person, c.contact_email, c.contact_phone,
        c.industry, c.organization_type, c.created_at, c.updated_at, c.account_manager_id,
        COALESCE(addr.addresses, '[]'::json) as addresses,
        json_build_object(
          'id', am.id,
          'firstName', am.first_name,
          'lastName', am.last_name
        ) AS account_manager
      FROM customers c
      LEFT JOIN (
        SELECT
          customer_id,
          json_agg(
            json_build_object(
              'id', id, 'customerId', customer_id, 'street', street,
              'district', district, 'postalCode', postal_code, 'city', city,
              'country', country, 'type', type, 'locationUrl', location_url
            ) ORDER BY type, id
          ) as addresses
        FROM addresses
        GROUP BY customer_id
      ) addr ON c.id = addr.customer_id
      LEFT JOIN employees am ON c.account_manager_id = am.id
      WHERE c.id = $1;
    `;
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.json(mapCustomerData(result.rows[0]));
  } catch (err) {
    console.error(`Error fetching customer ${id}:`, err);
    const errorMessage =
      err instanceof Error ? err.message : "Unknown database error";
    res
      .status(500)
      .json({ error: "Failed to fetch customer", details: errorMessage });
  }
});

// POST to create a new customer
router.post("/", async (req, res) => {
  const {
    name,
    website,
    contactPerson,
    contactEmail,
    contactPhone,
    industry,
    organizationType,
    addresses = [],
    accountManagerId,
  } = req.body;

  if (
    !name ||
    !contactPerson ||
    !contactEmail ||
    !contactPhone ||
    !industry ||
    !organizationType
  ) {
    return res.status(400).json({ error: "Missing required customer fields" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN"); // 1. Insert the new customer with the corrected query including timestamps

    const customerInsertQuery = `
  INSERT INTO customers (
    name, website, contact_person, contact_email, contact_phone, 
    industry, organization_type, account_manager_id, created_at, updated_at
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) 
  RETURNING id
`;
    const customerResult = await client.query(customerInsertQuery, [
      name,
      website || null,
      contactPerson,
      contactEmail,
      contactPhone,
      industry,
      organizationType,
      accountManagerId || null,
    ]);
    const newCustomerId = customerResult.rows[0].id;

    if (addresses && addresses.length > 0) {
      for (const addr of addresses) {
        if (!addr.city || !addr.type || !addr.locationUrl) {
          throw new Error(
            "Each address must have a city, type, and location URL."
          );
        }
        await client.query(
          `INSERT INTO addresses (customer_id, street, district, postal_code, city, country, type, location_url) VALUES ($1, $2, $3, $4, $5, 'KSA', $6, $7)`,
          [
            newCustomerId,
            addr.street || null,
            addr.district || null,
            addr.postalCode || null,
            addr.city,
            addr.type,
            addr.locationUrl,
          ]
        );
      }
    }

    await client.query("COMMIT"); // 3. Fetch and return the complete new customer object
    const finalResultQuery = `
    SELECT 
      c.id, c.name, c.website, c.contact_person, c.contact_email, c.contact_phone, 
      c.industry, c.organization_type, c.created_at, c.updated_at, c.account_manager_id,
      COALESCE(
        json_agg(
          json_build_object(
            'id', a.id, 'customerId', a.customer_id, 'street', a.street, 
            'district', a.district, 'postalCode', a.postal_code, 'city', a.city, 
            'country', a.country, 'type', a.type, 'locationUrl', a.location_url
          )
        ) FILTER (WHERE a.id IS NOT NULL), 
        '[]'::json
      ) AS addresses,
      json_build_object(
        'id', am.id, 
        'firstName', am.first_name, 
        'lastName', am.last_name
      ) AS account_manager
    FROM customers c
    LEFT JOIN addresses a ON c.id = a.customer_id
    LEFT JOIN employees am ON c.account_manager_id = am.id
    WHERE c.id = $1
    GROUP BY c.id, am.id;
  `;
    const finalResult = await client.query(finalResultQuery, [newCustomerId]);
    res.status(201).json(mapCustomerData(finalResult.rows[0]));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating customer with addresses:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Unknown database error";
    res.status(500).json({
      error: "Database error during customer creation",
      details: errorMessage,
    });
  } finally {
    client.release();
  }
});

// PUT to update customer info
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const {
    name,
    website,
    contactPerson,
    contactEmail,
    contactPhone,
    industry,
    organizationType,
    addresses = [],
    accountManagerId,
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN"); // 1. Update the main customer details

    await client.query(
      `UPDATE customers SET name = $1, website = $2, contact_person = $3, contact_email = $4, contact_phone = $5, industry = $6, organization_type = $7, account_manager_id = $8, updated_at = NOW() WHERE id = $9`,
      [
        name,
        website || null,
        contactPerson,
        contactEmail,
        contactPhone,
        industry,
        organizationType,
        accountManagerId,
        id,
      ]
    ); // 2. Get existing address IDs from the database

    const existingAddrsResult = await client.query(
      "SELECT id FROM addresses WHERE customer_id = $1",
      [id]
    );
    const existingAddrIds = new Set(existingAddrsResult.rows.map((r) => r.id)); // 3. Loop through addresses from the form, and update or insert them

    for (const addr of addresses) {
      if (addr.id && existingAddrIds.has(addr.id)) {
        // This is an EXISTING address, so we UPDATE it.
        await client.query(
          `UPDATE addresses SET street = $1, district = $2, postal_code = $3, city = $4, type = $5, location_url = $6 WHERE id = $7 AND customer_id = $8`,
          [
            addr.street || null,
            addr.district || null,
            addr.postalCode || null,
            addr.city,
            addr.type,
            addr.locationUrl,
            addr.id,
            id,
          ]
        );
        existingAddrIds.delete(addr.id); // Mark as processed
      } else if (!addr.id) {
        // This is a NEW address (no id), so we INSERT it.
        await client.query(
          `INSERT INTO addresses (customer_id, street, district, postal_code, city, country, type, location_url) VALUES ($1, $2, $3, $4, $5, 'KSA', $6, $7)`,
          [
            id,
            addr.street || null,
            addr.district || null,
            addr.postalCode || null,
            addr.city,
            addr.type,
            addr.locationUrl,
          ]
        );
      }
    } // 4. Delete any addresses that were removed in the UI

    if (existingAddrIds.size > 0) {
      const idsToDelete = Array.from(existingAddrIds);
      await client.query("DELETE FROM addresses WHERE id = ANY($1::int[])", [
        idsToDelete,
      ]);
    }

    await client.query("COMMIT"); // 5. Fetch and return the fully updated customer object to the frontend

    const finalResultQuery = `
    SELECT 
      c.id, c.name, c.website, c.contact_person, c.contact_email, c.contact_phone, 
      c.industry, c.organization_type, c.created_at, c.updated_at, c.account_manager_id,
      COALESCE(
        json_agg(
          json_build_object(
            'id', a.id, 'customerId', a.customer_id, 'street', a.street, 
            'district', a.district, 'postalCode', a.postal_code, 'city', a.city, 
            'country', a.country, 'type', a.type, 'locationUrl', a.location_url
          )
        ) FILTER (WHERE a.id IS NOT NULL), 
        '[]'::json
      ) AS addresses,
      json_build_object(
        'id', am.id, 
        'firstName', am.first_name, 
        'lastName', am.last_name
      ) AS account_manager
    FROM customers c
    LEFT JOIN addresses a ON c.id = a.customer_id
    LEFT JOIN employees am ON c.account_manager_id = am.id
    WHERE c.id = $1
    GROUP BY c.id, am.id;
  `;
    const finalResult = await client.query(finalResultQuery, [id]);
    res.json(mapCustomerData(finalResult.rows[0]));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`Error updating customer ${id}:`, err);
    const errorMessage =
      err instanceof Error ? err.message : "Unknown database error";
    res.status(500).json({
      error: "Database error during customer update",
      details: errorMessage,
    });
  } finally {
    client.release();
  }
});

// DELETE route for customers
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const customerId = parseInt(id, 10);
  if (isNaN(customerId)) {
    return res.status(400).json({ error: "Invalid Customer ID format." });
  }

  try {
    const result = await pool.query(
      "SELECT archive_and_delete_customer($1) AS message",
      [customerId]
    );
    const responseMessage = result.rows[0].message;

    if (responseMessage.startsWith("ERROR: Not Found")) {
      return res.status(404).json({ error: "Customer not found" });
    }
    if (responseMessage.startsWith("ERROR:")) {
      throw new Error(responseMessage);
    }

    res.status(200).json({ message: responseMessage });
  } catch (err) {
    console.error(
      `Error in customer delete function for ID ${customerId}:`,
      err
    );
    let errorMessage = "An unknown database error occurred.";
    if (err instanceof Error) {
      errorMessage = err.message;
    }
    res
      .status(500)
      .json({ error: "Database function call failed", details: errorMessage });
  }
});

export default router;
