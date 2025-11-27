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
  host: process.env.DB_HOST,       // PostgreSQL host
  user: process.env.DB_USER,       // PostgreSQL user
  password: process.env.DB_PASS,   // PostgreSQL password
  database: process.env.DB_NAME,   // PostgreSQL database name
  port: process.env.DB_PORT || 5432,
  ssl: {
    rejectUnauthorized: false      // Required for many cloud DBs, remove if not needed
  }
});

// Connect and create table if not exists
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
      })
      .catch(err => {
        console.error("❌ Table creation failed:", err);
        client.release();
      });
  })
  .catch(err => console.error("❌ PostgreSQL Connection Error:", err));

/* -------------------------------------------------------
   UPLOAD JSON API (React → Backend → PostgreSQL)
-------------------------------------------------------- */
app.post("/upload-json", async (req, res) => {
  const { file_name, json_data } = req.body;
    console.log("Received /upload-json:", { file_name, json_dataLength: json_data?.length });


  if (!file_name || !json_data) {
    return res.status(400).json({ message: "Invalid payload" });
  }

  const jsonString = JSON.stringify(json_data);

  const query = `
    INSERT INTO uploaded_files (file_name, json_data)
    VALUES ($1, $2)
  `;

  try {
    await pool.query(query, [file_name, jsonString]);
    res.json({ message: "Excel data saved successfully!" });
  } catch (err) {
    console.error("❌ DB Insert Error:", err);
    res.status(500).json({ message: "Database insert failed" });
  }
});

/* -------------------------------------------------------
   HISTORY LIST API
-------------------------------------------------------- */
app.get("/history", async (req, res) => {
  const query = `
    SELECT id, file_name, uploaded_at 
    FROM uploaded_files
    ORDER BY uploaded_at DESC
  `;

  try {
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ History Fetch Error:", err);
    res.status(500).json({ message: "Failed to load history" });
  }
});

/* -------------------------------------------------------
   VIEW A SPECIFIC UPLOADED FILE BY ID
-------------------------------------------------------- */
app.get("/history/:id", async (req, res) => {
  const fileId = req.params.id;

  try {
    const result = await pool.query(
      "SELECT json_data FROM uploaded_files WHERE id = $1",
      [fileId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "File not found" });
    }

    res.json(JSON.parse(result.rows[0].json_data));
  } catch (err) {
    console.error("❌ File Load Error:", err);
    res.status(500).json({ message: "Failed to load file data" });
  }
});

/* -------------------------------------------------------
   START SERVER
-------------------------------------------------------- */
app.listen(5000, () => console.log("🚀 Server running on port 5000"));



