import { useParams, Link } from "react-router-dom";
import React, { useRef, useState, useEffect } from "react";
import * as XLSX from "xlsx/dist/xlsx.full.min.js";

export default function TaskPage() {
  const { id } = useParams();

  const fileInputRef = useRef(null);
  const [workbook, setWorkbook] = useState(null);
  const [sheetData, setSheetData] = useState(null);
  const [fileName, setFileName] = useState("");

  const [sheets, setSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState("");

  const [query, setQuery] = useState("");

  const [newRow, setNewRow] = useState([]);

  const [divisions, setDivisions] = useState([]);
  const [selectedDivision, setSelectedDivision] = useState("");

  const API_BASE = "https://drdl-dynamic.onrender.com";

  // ⭐ NEW
  const [showMenu, setShowMenu] = useState(false);
  const [historyData, setHistoryData] = useState([]);

  const handleUploadClick = () => fileInputRef.current?.click();

  // ⭐ NEW — FETCH HISTORY
  const loadHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/history`);
      const data = await res.json();
      setHistoryData(data);
    } catch (err) {
      console.log("History error", err);
    }
  };

  useEffect(() => {
    if (showMenu) loadHistory();
  }, [showMenu]);

  // ----------------------------
  // Robust timestamp formatter
  // ----------------------------
  // Place this inside the component (already here).
  const formatTimestamp = (raw) => {
    // If the whole history item was passed accidentally, try to find timestamp-like fields
    const guessFromObject = (obj) => {
      if (!obj || typeof obj !== "object") return null;
      const candidates = [
        "timestamp",
        "time",
        "created_at",
        "createdAt",
        "date",
        "uploaded_at",
        "uploadedAt",
        "ts",
        "datetime",
      ];
      for (const key of candidates) {
        if (key in obj && obj[key] != null) return obj[key];
      }
      // If object has numeric fields, return first numeric-like
      for (const k of Object.keys(obj)) {
        if (
          typeof obj[k] === "number" ||
          (typeof obj[k] === "string" && /^\d+$/.test(obj[k]))
        ) {
          return obj[k];
        }
      }
      // fallback null
      return null;
    };

    let ts = raw;

    // If raw is the entire item (object with many fields), attempt to extract
    if (ts && typeof ts === "object" && !Array.isArray(ts) && !(ts instanceof Date)) {
      const guess = guessFromObject(ts);
      if (guess != null) ts = guess;
      else {
        // if cannot guess, return compact debug string so you can see what backend actually returned
        try {
          return JSON.stringify(ts);
        } catch {
          return String(ts);
        }
      }
    }

    if (ts instanceof Date) {
      if (isNaN(ts)) return "Invalid date";
      return ts.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZoneName: "short",
      });
    }

    // If it's a plain string like "2025-12-03 23:16:00" MySQL DATETIME -> try replace space w/ T
    if (typeof ts === "string") {
      const s = ts.trim();
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
        const iso = s.replace(" ", "T") + "Z"; // assume UTC if your backend stores UTC; remove "Z" if local
        const d = new Date(iso);
        if (!isNaN(d)) {
          return d.toLocaleString(undefined, {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
            timeZoneName: "short",
          });
        }
        // try without timezone suffix
        const d2 = new Date(s.replace(" ", "T"));
        if (!isNaN(d2)) {
          return d2.toLocaleString(undefined, {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
            timeZoneName: "short",
          });
        }
      }

      // If numeric string (epoch)
      if (/^\d+$/.test(s)) {
        const n = Number(s);
        // 10-digit seconds -> ms
        const ms = s.length === 10 ? n * 1000 : n;
        const d = new Date(ms);
        if (!isNaN(d)) {
          return d.toLocaleString(undefined, {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
            timeZoneName: "short",
          });
        }
      }

      // Try parsing ISO or other string
      const parsed = new Date(s);
      if (!isNaN(parsed)) {
        return parsed.toLocaleString(undefined, {
          year: "numeric",
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
          timeZoneName: "short",
        });
      }

      // If all fails, return raw string so you can inspect it in UI
      return s;
    }

    if (typeof ts === "number") {
      // detect seconds vs ms
      const ms = ts.toString().length === 10 ? ts * 1000 : ts;
      const d = new Date(ms);
      if (isNaN(d)) return "Invalid date";
      return d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZoneName: "short",
      });
    }

    // fallback
    try {
      return String(ts);
    } catch {
      return "Invalid date";
    }
  };
  // ----------------------------

  // Detect divisions (single header rows)
  const detectDivisions = (rows) => {
    const divs = [];
    rows.forEach((row, index) => {
      const nonEmptyCount = row.filter((v) => String(v ?? "").trim() !== "")
        .length;
      if (nonEmptyCount === 1) {
        const name = row.find((v) => String(v ?? "").trim() !== "");
        divs.push({ name, index });
      }
    });
    return divs;
  };

  // Upload excel
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: "array" });

    setWorkbook(wb);
    setSheets(wb.SheetNames);
    setSelectedSheet(wb.SheetNames[0]);

    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
      header: 1,
      raw: false,
    });

    setSheetData(rows);
    setDivisions(detectDivisions(rows));

    const maxCols = Math.max(...rows.map((r) => r.length), 1);
    setNewRow(Array(maxCols).fill(""));
  };

  // Change sheet
  const handleSheetChange = (e) => {
    const name = e.target.value;
    setSelectedSheet(name);

    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], {
      header: 1,
      raw: false,
    });

    setSheetData(rows);
    setDivisions(detectDivisions(rows));

    const maxCols = Math.max(...rows.map((r) => r.length), 1);
    setNewRow(Array(maxCols).fill(""));
  };

  // Search
  const filteredData = React.useMemo(() => {
    if (!workbook) return [];
    if (!query) {
      return Array.isArray(sheetData)
        ? sheetData.map((row) => ({ sheet: selectedSheet, row }))
        : [];
    }

    const lower = query.toLowerCase();
    const results = [];

    workbook.SheetNames.forEach((sheet) => {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheet], {
        header: 1,
        raw: false,
      });

      rows.forEach((row) => {
        if (
          row.some((cell) =>
            String(cell ?? "").toLowerCase().includes(lower)
          )
        ) {
          results.push({ sheet, row });
        }
      });
    });

    return results;
  }, [query, workbook, selectedSheet, sheetData]);

  const foundSheets = [...new Set(filteredData.map((i) => i.sheet))];

  const saveToDatabase = async () => {
    if (!sheetData) return alert("Upload Excel first!");

    try {
      const res = await fetch(`${API_BASE}/upload-json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_name: fileName,
          json_data: sheetData,
        }),
      });

      const result = await res.json();
      alert(result.message);
    } catch (err) {
      alert("Failed to save");
    }
  };

  const addRowToSheet = () => {
    if (!sheetData) return alert("Upload Excel first!");

    const updated = [...sheetData];

    if (selectedDivision) {
      const div = divisions.find((d) => d.name === selectedDivision);
      const insertAt = div.index + 2;
      updated.splice(insertAt, 0, [...newRow]);
    } else {
      updated.push([...newRow]);
    }

    setSheetData(updated);
    workbook.Sheets[selectedSheet] = XLSX.utils.aoa_to_sheet(updated);

    alert("Row Added!");
    setNewRow(newRow.map(() => ""));
  };

  const downloadExcel = () => {
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    workbook.Sheets[selectedSheet] = ws;

    const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });

    const blob = new Blob([wbout], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || "updated.xlsx";
    a.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div style={styles.container}>

      {/* ⭐ HAMBURGER BUTTON */}
      <div style={styles.hamburger} onClick={() => setShowMenu(true)}>
        ☰
      </div>

      {/* ⭐ SIDE MENU */}
      {showMenu && (
        <div style={styles.sideMenu}>
          <button style={styles.closeBtn} onClick={() => setShowMenu(false)}>
            ✕
          </button>

          <h3 style={{ color: "#ffde7b" }}>Upload History</h3>

          {historyData.map((item, i) => (
            <div key={i} style={styles.historyItem}>
              <strong>{item.file_name}</strong>
              <br />

              {/* Use robust formatter: pass the whole item so it can attempt to pick the right field */}
              <span style={{ fontSize: "12px", opacity: 0.7 }}>
                {formatTimestamp(item)}
              </span>
            </div>
          ))}
        </div>
      )}

      <header style={styles.header}>
        <h2 style={styles.logo}>🏫 KMIT</h2>
      </header>

      <main style={styles.main}>
        <h1 style={styles.title}>Task {id}</h1>

        {!sheetData && (
          <>
            <button onClick={handleUploadClick} style={styles.uploadButton}>
              Upload Excel
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFile}
              style={{ display: "none" }}
            />

            <Link to="/" style={styles.backButton}>
              ← Back to Home
            </Link>
          </>
        )}

        {sheetData && (
          <>
            <p style={styles.fileName}>Uploaded: {fileName}</p>

            {sheets.length > 1 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: "10px",
                  marginTop: "10px",
                }}
              >
                <span
                  style={{
                    fontSize: "18px",
                    fontWeight: "600",
                    color: "#c9a646",
                  }}
                >
                  Sheets:
                </span>

                <select
                  value={selectedSheet}
                  onChange={handleSheetChange}
                  style={styles.dropdown}
                >
                  {sheets.map((sheet) => (
                    <option key={sheet} value={sheet}>
                      {sheet}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={styles.searchBar}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search across all sheets..."
                style={styles.searchInput}
              />
              <button
                onClick={() => setQuery("")}
                style={styles.clearButton}
              >
                Clear
              </button>
            </div>

            <div style={styles.rowCount}>
              Count: {filteredData.length}
              {foundSheets.length > 0 && (
                <span style={{ marginLeft: 10 }}>
                  (Found in: {foundSheets.join(", ")})
                </span>
              )}
            </div>

            <button onClick={saveToDatabase} style={styles.saveButton}>
              Save Excel to Database
            </button>

            {/* ADD ROW */}
            <div style={{ marginTop: 20 }}>
              {divisions.length > 0 && (
                <select
                  value={selectedDivision}
                  onChange={(e) => setSelectedDivision(e.target.value)}
                  style={styles.dropdown}
                >
                  <option value="">Select Division</option>
                  {divisions.map((d) => (
                    <option key={d.name} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              )}

              <h3 style={{ color: "#c9a646" }}>Add Row</h3>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                {newRow.map((value, idx) => (
                  <input
                    key={idx}
                    value={value}
                    onChange={(e) => {
                      const t = [...newRow];
                      t[idx] = e.target.value;
                      setNewRow(t);
                    }}
                    placeholder={`Column ${idx + 1}`}
                    style={styles.input}
                  />
                ))}
              </div>

              <button onClick={addRowToSheet} style={styles.saveButton}>
                Add Row
              </button>

              <button onClick={downloadExcel} style={styles.saveButton}>
                Download Updated Excel
              </button>
            </div>

            {/* TABLE */}
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <tbody>
                  {filteredData.map((item, index) => {
                    const row = item.row;

                    const nonEmpty = row.filter(
                      (v) => String(v ?? "").trim() !== ""
                    ).length;

                    if (nonEmpty === 1) {
                      return (
                        <tr key={index}>
                          <td colSpan={50} style={styles.headingCell}>
                            {row.find((v) => v)}
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={index}>
                        {row.map((cell, c) => (
                          <td key={c} style={styles.cell}>
                            {String(cell ?? "")}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Link to="/" style={styles.backButton}>
              ← Back to Home
            </Link>
          </>
        )}
      </main>
    </div>
  );
}

const styles = {
  container: {
    width: "100vw",
    minHeight: "100vh",
    background: "#12385b",
    color: "#fff",
    fontFamily: "Poppins",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    overflowX: "hidden",
  },

  hamburger: {
    position: "fixed",
    top: "150px",
    left: "20px",
    fontSize: "28px",
    cursor: "pointer",
    zIndex: 2000,
    color: "#c9a646",
    background: "rgba(0,0,0,0.3)",
    padding: "8px 12px",
    borderRadius: "6px",
  },

  sideMenu: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "260px",
    height: "100%",
    background: "#0d2238",
    padding: "20px",
    zIndex: 3000,
    borderRight: "2px solid #b38b59",
    overflowY: "auto",
  },

  closeBtn: {
    fontSize: "20px",
    background: "transparent",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    float: "right",
  },

  historyItem: {
    background: "rgba(255,255,255,0.1)",
    padding: "10px",
    borderRadius: "8px",
    marginTop: "10px",
  },

  header: {
    width: "100%",
    padding: "20px 30px",
    background: "#0d2238",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    borderBottom: "2px solid #b38b59",
  },

  logo: {
    color: "#c9a646",
    fontSize: "1.6rem",
    fontWeight: 700,
  },

  main: {
    width: "100%",
    maxWidth: "1200px",
    padding: "20px",
    textAlign: "center",
  },

  title: { fontSize: "32px", color: "#c9a646", marginBottom: "20px" },

  uploadButton: {
    padding: "12px 25px",
    background: "#2b6cb0",
    color: "#fff",
    borderRadius: 8,
    fontWeight: 600,
    cursor: "pointer",
  },

  saveButton: {
    marginTop: 15,
    padding: "10px 20px",
    background: "#c9a646",
    borderRadius: 8,
    fontWeight: "600",
    color: "#000",
    cursor: "pointer",
  },

  backButton: {
    marginTop: 20,
    display: "inline-block",
    padding: "12px 30px",
    background: "#b38b59",
    borderRadius: 8,
    color: "#fff",
    fontWeight: "600",
  },

  dropdown: {
    padding: 8,
    borderRadius: 8,
    marginTop: 10,
    minWidth: "150px",
  },

  searchBar: {
    marginTop: 20,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "10px",
    width: "100%",
  },

  searchInput: {
    padding: 10,
    width: "260px",
    borderRadius: 8,
  },

  clearButton: {
    padding: "10px 20px",
    borderRadius: 8,
    background: "#b38b59",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },

  rowCount: {
    marginTop: 10,
    color: "#c9a646",
    fontSize: "18px",
    fontWeight: "600",
  },

  tableWrapper: {
    marginTop: 20,
    overflowX: "auto",
    width: "100%",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    background: "rgba(255,255,255,0.04)",
  },

  cell: {
    padding: "10px",
    border: "1px solid rgba(255,255,255,0.3)",
  },

  headingCell: {
    padding: 10,
    background: "rgba(255,255,255,0.1)",
    fontWeight: "bold",
    color: "#ffde7b",
    textAlign: "center",
    border: "1px solid rgba(255,255,255,0.3)",
  },

  input: {
    padding: 8,
    minWidth: 120,
    borderRadius: 6,
    background: "#fff",
    color: "#000",
  },
};
