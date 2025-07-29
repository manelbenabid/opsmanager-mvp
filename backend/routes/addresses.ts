import express from "express";
import pool from "../db"; // Ensure this path is correct

const router = express.Router();

// Helper to map DB row to a more frontend-friendly Address object
// Your frontend Address interface should align with this structure.
const mapAddressData = (dbRow: any) => {
  if (!dbRow) return null;
  return {
    id: dbRow.id,
    customerId: dbRow.customer_id,
    street: dbRow.street,
    district: dbRow.district,
    postalCode: dbRow.postal_code,
    city: dbRow.city,
    country: dbRow.country,
    type: dbRow.type,
    locationUrl: dbRow.location_url,
  };
};

// GET all addresses (optionally filter by customer_id)
router.get("/", async (req, res) => {
  const { customerId } = req.query; // e.g., /api/addresses?customerId=1

  try {
    let queryText = `
      SELECT id, customer_id, street, district, postal_code, city, country, type, location_url 
      FROM addresses
    `;
    const queryParams = [];

    if (customerId) {
      queryText += " WHERE customer_id = $1";
      queryParams.push(customerId);
    }
    queryText += " ORDER BY city, street";

    const result = await pool.query(queryText, queryParams);
    res.json(result.rows.map(mapAddressData));
  } catch (err) {
    console.error("Error fetching addresses:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Unknown database error";
    res
      .status(500)
      .json({ error: "Failed to fetch addresses", details: errorMessage });
  }
});

// GET a single address by ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, customer_id, street, district, postal_code, city, country, type, location_url 
       FROM addresses WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Address not found" });
    }
    res.json(mapAddressData(result.rows[0]));
  } catch (err) {
    console.error(`Error fetching address ${id}:`, err);
    const errorMessage =
      err instanceof Error ? err.message : "Unknown database error";
    res
      .status(500)
      .json({ error: "Failed to fetch address", details: errorMessage });
  }
});

// POST to create a new address
router.post("/", async (req, res) => {
  const { customerId, street, district, postalCode, city, type, locationUrl } =
    req.body;
  const country = "KSA";

  // Basic validation
  if (!customerId || !city || !type || !locationUrl) {
    return res
      .status(400)
      .json({
        error:
          "Missing required address fields (customerId, street, district, city)",
      });
  }
  // Validate country if provided and not KSA (or handle as fixed)

  try {
    // Check if customer_id exists
    const customerCheck = await pool.query(
      "SELECT id FROM customers WHERE id = $1",
      [customerId]
    );
    if (customerCheck.rows.length === 0) {
      return res
        .status(404)
        .json({ error: `Customer with id ${customerId} not found.` });
    }

    const result = await pool.query(
      `INSERT INTO addresses 
          (customer_id, street, district, postal_code, city, country, type, location_url) 
        VALUES 
          ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
      [
        customerId,
        street || null,
        district || null,
        postalCode || null,
        city,
        country,
        type,
        locationUrl,
      ]
    );
    res.status(201).json(mapAddressData(result.rows[0]));
  } catch (err) {
    console.error("Error creating address:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Unknown database error";
    // PostgreSQL error code for foreign key violation is '23503'
    if (err instanceof Error && "code" in err && err.code === "23503") {
      return res
        .status(400)
        .json({
          error: "Invalid customer_id. Customer does not exist.",
          details: err.message,
        });
    }
    res
      .status(500)
      .json({
        error: "Database error during address creation",
        details: errorMessage,
      });
  }
});

// PUT to update address info
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  // Map frontend camelCase keys to backend snake_case columns
  const keyMapping: { [key: string]: string } = {
    street: 'street',
    district: 'district',
    postalCode: 'postal_code',
    city: 'city',
    type: 'type',
    locationUrl: 'location_url',
  };

  Object.entries(data).forEach(([key, value]) => {
    const dbColumn = keyMapping[key];
    if (dbColumn && value !== undefined) {
      if (dbColumn === "country" && value !== "KSA") {
        // Skip or error out if trying to set country to something other than KSA
        console.warn(
          `Attempt to update country to an invalid value (${value}) for address ${id}. Ignoring.`
        );
        return;
      }
      updates.push(`${dbColumn} = $${paramCount++}`);
      values.push(value === '' ? null : value);
    }
  });

  if (updates.length === 0) {
    try {
      const currentDataResult = await pool.query(
        `SELECT * FROM addresses WHERE id = $1`, [id]
      );
      if (currentDataResult.rows.length === 0) {
        return res.status(404).json({ error: "Address not found" });
      }
      return res.json(mapAddressData(currentDataResult.rows[0]));
    } catch (fetchErr) {
      console.error(
        `Error fetching address ${id} during no-op update:`,
        fetchErr
      );
      return res.status(500).json({ error: "Failed to fetch address data" });
    }
  }

  values.push(id); // Add id as the last parameter for WHERE clause

  try {
    // If customerId is being updated, check if the new customer_id exists
    if (data.customerId) {
      const customerCheck = await pool.query(
        "SELECT id FROM customers WHERE id = $1",
        [data.customerId]
      );
      if (customerCheck.rows.length === 0) {
        return res
          .status(404)
          .json({
            error: `Customer with id ${data.customerId} not found for updating address.`,
          });
      }
    }

    const queryText = `
      UPDATE addresses
      SET ${updates.join(", ")}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    const result = await pool.query(queryText, values);

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Address not found or not updated" });
    }
    res.json(mapAddressData(result.rows[0]));
  } catch (err) {
    console.error(`Error updating address ${id}:`, err);
    const errorMessage =
      err instanceof Error ? err.message : "Unknown database error";
    if (err instanceof Error && "code" in err && err.code === "23503") {
      // Foreign key violation
      return res
        .status(400)
        .json({
          error: "Invalid customer_id. Customer does not exist.",
          details: err.message,
        });
    }
    res
      .status(500)
      .json({
        error: "Database error during address update",
        details: errorMessage,
      });
  }
});

// DELETE an address
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM addresses WHERE id = $1 RETURNING id", // Return something to confirm
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Address not found" });
    }
    res
      .status(200)
      .json({
        message: "Address deleted successfully",
        deletedAddress: mapAddressData(result.rows[0]),
      });
  } catch (err) {
    console.error(`Error deleting address ${id}:`, err);
    const errorMessage =
      err instanceof Error ? err.message : "Unknown database error";
    res
      .status(500)
      .json({
        error: "Database error during address deletion",
        details: errorMessage,
      });
  }
});

export default router;
