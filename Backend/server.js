import express from "express";
import cors from "cors";
import { Pool } from "pg";
import bodyParser from "body-parser";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

/* ------------------ POSTGRESQL CONNECTION ------------------ */
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
  ssl: {
    rejectUnauthorized: false
  }
});

// Create table if not exists
pool.connect()
  .then(client => {
    console.log("✅ PostgreSQL Connected!");

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS uploaded_files (
        id SERIAL PRIMARY KEY,
        file_name VARCHAR(255),
        json_data TEXT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    return client.query(createTableQuery)
      .then(() => {
        console.log("✅ Table 'uploaded_files' is ready!");
        client.release();
      });
  })
  .catch(err => console.error("❌ PostgreSQL Connection Error:", err));

/* -------------------------------------------------------
   UPLOAD JSON API
-------------------------------------------------------- */
app.post("/upload-json", async (req, res) => {
  const { file_name, json_data } = req.body;

  if (!file_name || !json_data) {
    return res.status(400).json({ message: "Invalid payload" });
  }

  try {
    await pool.query(
      "INSERT INTO uploaded_files (file_name, json_data) VALUES ($1, $2)",
      [file_name, JSON.stringify(json_data)]
    );

    res.json({ message: "Excel data saved successfully!" });
  } catch (err) {
    console.error("❌ DB Insert Error:", err);
    res.status(500).json({ message: "Database insert failed" });
  }
});

/* -------------------------------------------------------
   HISTORY LIST API (SIDEBAR)
-------------------------------------------------------- */
app.get("/history", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, file_name, uploaded_at
      FROM uploaded_files
      ORDER BY uploaded_at DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("❌ History Fetch Error:", err);
    res.status(500).json({ message: "Failed to load history" });
  }
});

/* -------------------------------------------------------
   VIEW / DOWNLOAD A FILE BY ID  ✅ FIXED
-------------------------------------------------------- */
app.get("/history/:id", async (req, res) => {
  const fileId = req.params.id;

  try {
    const result = await pool.query(
      "SELECT file_name, json_data FROM uploaded_files WHERE id = $1",
      [fileId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "File not found" });
    }

    res.json({
      file_name: result.rows[0].file_name,
      json_data: JSON.parse(result.rows[0].json_data)
    });

  } catch (err) {
    console.error("❌ File Load Error:", err);
    res.status(500).json({ message: "Failed to load file data" });
  }
});

/* -------------------------------------------------------
   START SERVER
-------------------------------------------------------- */
app.listen(5000, () => {
  console.log("🚀 Server running on port 5000");
});
