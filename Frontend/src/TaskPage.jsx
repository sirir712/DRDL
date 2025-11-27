
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
  const [rowCount, setRowCount] = useState(0);
  const [duplicateMap, setDuplicateMap] = useState({});

  // UI states
  const [showMenu, setShowMenu] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState([]);

  const handleUploadClick = () => fileInputRef.current?.click();

  // 🔥 YOUR RAILWAY BACKEND URL HERE
  // const API_BASE = "https://kmit-backend-production.up.railway.app";
const API_BASE = "http://localhost:5000";

  // LOAD HISTORY
  const loadHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/history`);
      const data = await res.json();
      setHistoryData(data);
    } catch (err) {
      console.error("ERROR:", err);
    }
  };

  useEffect(() => {
    if (showHistory) loadHistory();
  }, [showHistory]);

  // DUPLICATE DETECTION
  const processDuplicates = (rows) => {
    const freq = {};
    rows.forEach((row, r) => {
      row.forEach((cell, c) => {
        const key = String(cell ?? "");
        if (!freq[key]) freq[key] = [];
        freq[key].push({ r, c });
      });
    });

    const dup = {};
    Object.keys(freq).forEach((key) => {
      if (freq[key].length > 1 && key !== "") {
        freq[key].forEach(({ r, c }) => {
          dup[`${r}-${c}`] = true;
        });
      }
    });

    setDuplicateMap(dup);
  };

  // FILE UPLOAD
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
      cellDates: true,
    });

    setSheetData(rows);

    const count = rows.filter((r) =>
      r.some((cell) => cell !== null && cell !== "")
    ).length;

    setRowCount(count);
    processDuplicates(rows);
    setQuery("");
  };

  // CHANGE SHEET
  const handleSheetChange = (e) => {
    const sheetName = e.target.value;
    setSelectedSheet(sheetName);

    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      raw: false,
      cellDates: true,
    });

    setSheetData(rows);

    const count = rows.filter((r) =>
      r.some((cell) => cell !== null && cell !== "")
    ).length;

    setRowCount(count);
    processDuplicates(rows);
  };

  // FILTER
  const filteredData = React.useMemo(() => {
    if (!sheetData || !query) return sheetData;

    const lower = query.toLowerCase();
    return sheetData.filter((row) =>
      row.some((cell) => String(cell ?? "").toLowerCase().includes(lower))
    );
  }, [sheetData, query]);

  const displayedCount = filteredData ? filteredData.length : 0;

  // SAVE TO DB
  const saveToDatabase = async () => {
    if (!sheetData) return alert("No data to save");

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

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h2 style={styles.logo}>🏫 KMIT</h2>
      </header>

      <div style={styles.hamburgerRow}>
        <span style={styles.hamburger} onClick={() => setShowMenu(true)}>☰</span>
      </div>

      {/** SIDE MENU */}
      {showMenu && (
        <div style={styles.sideMenu}>
          <button style={styles.closeMenuBtn} onClick={() => setShowMenu(false)}>X</button>

          <h3 style={{ color: "#c9a646" }}>Menu</h3>

          <button
            style={styles.menuItem}
            onClick={() => {
              setShowHistory(true);
              setShowMenu(false);
            }}
          >
            📁 Upload History
          </button>
        </div>
      )}

      {/** HISTORY PANEL */}
      {showHistory && (
        <div style={styles.historyPanel}>
          <div style={styles.historyHeader}>
            <h3 style={{ fontSize: "22px" }}>Upload History</h3>
            <button style={styles.closeBtn} onClick={() => setShowHistory(false)}>X</button>
          </div>

          <div style={styles.historyList}>
            {historyData.map((item) => (
              <div key={item.id} style={styles.historyItem}>
                <div style={styles.historyTextBox}>
                  <strong>{item.file_name}</strong>
                  <div style={{ fontSize: "12px", opacity: 0.7 }}>
                    {new Date(item.uploaded_at).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/** MAIN CONTENT */}
      <main style={styles.main}>
        <h1 style={styles.title}>Task {id}</h1>

        {id === "1" && (
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

            {fileName && <p style={styles.fileName}>Uploaded: {fileName}</p>}

            {sheets.length > 1 && (
              <select value={selectedSheet} onChange={handleSheetChange} style={styles.dropdown}>
                {sheets.map((sheet, i) => (
                  <option key={i} value={sheet}>{sheet}</option>
                ))}
              </select>
            )}

            {sheetData && (
              <div style={styles.searchBar}>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search..."
                  style={styles.searchInput}
                />
                <button onClick={() => setQuery("")} style={styles.clearButton}>
                  Clear
                </button>
              </div>
            )}

            {sheetData && (
              <div style={styles.rowCount}>Count: {displayedCount}</div>
            )}

            {sheetData && (
              <button onClick={saveToDatabase} style={styles.saveButton}>
                Save Excel to Database
              </button>
            )}

            {filteredData && (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <tbody>
                    {filteredData.map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, c) => (
                          <td
                            key={c}
                            style={{
                              ...styles.cell,
                              background: duplicateMap[`${r}-${c}`]
                                ? "#ffcc00"
                                : "transparent",
                              color: duplicateMap[`${r}-${c}`] ? "#000" : "#fff",
                            }}
                          >
                            {String(cell ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        <Link to="/" style={styles.backButton}>← Back to Home</Link>
      </main>

      <footer style={styles.footer}>
        © KESHAV MEMORIAL INSTITUTE OF TECHNOLOGY
      </footer>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    width: "100vw",
    background: "linear-gradient(180deg, #12385b, #12263a)",
    color: "#fff",
    fontFamily: "Poppins",
  },

  header: {
    padding: "18px 40px",
    background: "#0d2238",
    borderBottom: "2px solid #b38b59",
  },

  logo: { fontSize: "1.5rem", color: "#c9a646", fontWeight: 700 },

  hamburgerRow: {
    width: "100%",
    padding: "10px 40px 0px 40px",
  },

  hamburger: {
    fontSize: "28px",
    color: "#c9a646",
    cursor: "pointer",
  },

  sideMenu: {
    position: "fixed",
    top: "80px",
    left: 0,
    width: "240px",
    height: "100vh",
    background: "#0d2238",
    borderRight: "2px solid #b38b59",
    padding: "20px",
    zIndex: 99999,
  },

  closeMenuBtn: {
    background: "red",
    color: "#fff",
    border: "none",
    padding: "5px 10px",
    borderRadius: "5px",
    float: "right",
    cursor: "pointer",
  },

  menuItem: {
    width: "100%",
    marginTop: "20px",
    padding: "12px",
    background: "rgba(255,255,255,0.2)",
    color: "#fff",
    borderRadius: "8px",
    cursor: "pointer",
    textAlign: "left",
  },

  historyPanel: {
    position: "fixed",
    top: "80px",
    right: 0,
    width: "360px",
    height: "calc(100vh - 80px)",
    background: "#0d2238",
    borderLeft: "2px solid #b38b59",
    padding: "20px",
    overflowY: "auto",
    zIndex: 999999,
  },

  historyHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
  },

  closeBtn: {
    background: "red",
    border: "none",
    padding: "6px 10px",
    color: "#fff",
    borderRadius: "6px",
    cursor: "pointer",
  },

  historyList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  historyItem: {
    background: "rgba(255,255,255,0.1)",
    padding: "12px",
    borderRadius: "8px",
    display: "flex",
    flexDirection: "column",
  },

  historyTextBox: {
    width: "100%",
    wordBreak: "break-word",
    overflowWrap: "break-word",
    whiteSpace: "normal",
  },

  main: { textAlign: "center", marginTop: "40px" },

  title: { fontSize: "2.4rem", color: "#c9a646" },

  uploadButton: {
    marginTop: "20px",
    padding: "10px 20px",
    background: "#2b6cb0",
    borderRadius: "8px",
    color: "#fff",
  },

  saveButton: {
    marginTop: "15px",
    padding: "10px 20px",
    background: "#c9a646",
    color: "#000",
    fontWeight: "700",
    borderRadius: "8px",
  },

  fileName: { marginTop: "10px" },

  dropdown: {
    marginTop: "15px",
    padding: "8px",
    borderRadius: "8px",
  },

  searchBar: {
    marginTop: "20px",
    display: "flex",
    justifyContent: "center",
    gap: "10px",
  },

  searchInput: {
    padding: "8px 12px",
    width: "260px",
    borderRadius: "8px",
  },

  clearButton: {
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid white",
    color: "white",
    background: "transparent",
  },

  rowCount: {
    marginTop: "10px",
    color: "#c9a646",
  },

  tableWrapper: { marginTop: "15px", overflowX: "auto" },

  table: { minWidth: "100%", borderCollapse: "collapse" },

  cell: {
    padding: "10px",
    border: "1px solid rgba(255,255,255,0.3)",
  },

  backButton: {
    marginTop: "20px",
    display: "inline-block",
    padding: "12px 30px",
    background: "#b38b59",
    color: "#fff",
    borderRadius: "8px",
  },

  footer: {
    marginTop: "40px",
    textAlign: "center",
    padding: "15px",
    background: "#0d2238",
    borderTop: "1px solid #b38b59",
  },
};
