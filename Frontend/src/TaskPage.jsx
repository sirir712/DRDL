
import { useParams, Link } from "react-router-dom";
import React, { useRef, useState, useEffect } from "react";
import * as XLSX from "xlsx/dist/xlsx.full.min.js";

export default function TaskPage() {
  const { id } = useParams();

  // control whether the entire Task-1 UI is shown
  const [showTask1, setShowTask1] = useState(false);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h2 style={styles.logo}>🏫 KMIT</h2>
      </header>

      <div style={styles.hamburgerRow}>
        <span style={styles.hamburger} onClick={() => { /* keep existing menu logic if you want */ }}>
          ☰
        </span>
      </div>

      <main style={styles.main}>
        <h1 style={styles.title}>Task {id}</h1>

        {id === "1" && (
          <>
            {/* Single button which toggles the entire Task-1 panel */}
            <button
              onClick={() => setShowTask1((s) => !s)}
              style={{ ...styles.uploadButton, marginBottom: 12 }}
            >
              {showTask1 ? "Close Task 1" : "Open Task 1"}
            </button>

            {/* When showTask1 is true, render the full Task-1 UI (all functionality) */}
            {showTask1 && <Task1Panel />}
          </>
        )}

        <Link to="/" style={styles.backButton}>
          ← Back to Home
        </Link>
      </main>

      <footer style={styles.footer}>© KESHAV MEMORIAL INSTITUTE OF TECHNOLOGY</footer>
    </div>
  );
}

/* ------------------- Task1Panel (all Task 1 functionality) ------------------- */

function Task1Panel() {
  const fileInputRef = useRef(null);
  const [workbook, setWorkbook] = useState(null);
  const [sheetData, setSheetData] = useState([]);
  const [fileName, setFileName] = useState("");

  const [sheets, setSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState("");

  const [query, setQuery] = useState("");
  const [rowCount, setRowCount] = useState(0);

  const [newRow, setNewRow] = useState([]);

  const [showMenu, setShowMenu] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState([]);

  // ⭐ NEW — store ALL sheets for global search
  const [allSheetsData, setAllSheetsData] = useState({});

  // ⭐ divisions
  const [divisions, setDivisions] = useState([]);
  const [selectedDivision, setSelectedDivision] = useState("");
  const [divisionHeader, setDivisionHeader] = useState([]);

  const API_BASE = "http://localhost:5000";

  const handleUploadClick = () => fileInputRef.current?.click();

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

  // ⭐ Detect divisions inside a sheet
  const detectDivisions = (rows) => {
    const divs = [];
    (rows || []).forEach((row, index) => {
      const nonEmpty = (row || []).filter((v) => String(v ?? "").trim() !== "")
        .length;

      if (nonEmpty === 1) {
        const name = (row || []).find((v) => String(v ?? "").trim() !== "");
        divs.push({ name: String(name), index });
      }
    });
    return divs;
  };

  // ⭐ FILE UPLOAD — now loads ALL sheets
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: "array" });

    setWorkbook(wb);
    setSheets(wb.SheetNames || []);

    let allData = {};

    wb.SheetNames.forEach((sheetName) => {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
        header: 1,
        raw: false,
        cellDates: true,
      });
      allData[sheetName] = rows || [];
    });

    setAllSheetsData(allData);

    // Load first sheet
    setSelectedSheet(wb.SheetNames[0]);
    setSheetData(allData[wb.SheetNames[0]]);

    setDivisions(detectDivisions(allData[wb.SheetNames[0]]));

    const maxCols =
      allData[wb.SheetNames[0]].length > 0
        ? Math.max(
            ...allData[wb.SheetNames[0]].map((r) => (r ? r.length : 0))
          )
        : 1;
    setNewRow(Array(maxCols).fill(""));
  };

  // ⭐ CHANGE SHEET
  const handleSheetChange = (e) => {
    const sheetName = e.target.value;
    setSelectedSheet(sheetName);

    const rows = allSheetsData[sheetName] || [];

    setSheetData(rows);
    setDivisions(detectDivisions(rows));

    const maxCols =
      rows.length > 0 ? Math.max(...rows.map((r) => (r ? r.length : 0))) : 1;

    setNewRow(Array(maxCols).fill(""));
  };

  // ⭐ GLOBAL MULTI-SHEET SEARCH
  const filteredData = React.useMemo(() => {
    if (!query) {
      return (sheetData || []).map((row) => ({
        sheet: selectedSheet,
        row,
      }));
    }

    const lower = query.toLowerCase();
    let results = [];

    Object.keys(allSheetsData).forEach((sheetName) => {
      (allSheetsData[sheetName] || []).forEach((row) => {
        if (
          (row || []).some((cell) =>
            String(cell ?? "").toLowerCase().includes(lower)
          )
        ) {
          results.push({ sheet: sheetName, row });
        }
      });
    });

    return results;
  }, [query, sheetData, allSheetsData, selectedSheet]);

  const displayedCount = filteredData?.length ?? 0;
  const foundSheets = [...new Set((filteredData || []).map((i) => i.sheet))];

  // SAVE TO DB
  const saveToDatabase = async () => {
    if (!sheetData || sheetData.length === 0) return alert("No data to save");

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
      alert(result.message || "Saved");
    } catch (err) {
      console.error(err);
      alert("Failed to save");
    }
  };

  // ⭐ ADD ROW
  const addRowToSheet = () => {
    if (!sheetData) return alert("Upload Excel first!");

    let updated = [...sheetData];

    if (selectedDivision) {
      const div = divisions.find((d) => d.name === selectedDivision);
      if (!div) return alert("Division not found");

      const insertAt = Math.min(div.index + 2, updated.length);
      updated.splice(insertAt, 0, [...newRow]);
    } else {
      updated.push([...newRow]);
    }

    setSheetData(updated);

    // update workbook
    if (workbook) {
      const newWs = XLSX.utils.aoa_to_sheet(updated);
      const newWb = {
        ...workbook,
        Sheets: { ...workbook.Sheets, [selectedSheet]: newWs },
      };
      setWorkbook(newWb);

      // update global sheet list
      setAllSheetsData({
        ...allSheetsData,
        [selectedSheet]: updated,
      });
    }

    alert("Row Added!");
    setNewRow(newRow.map(() => ""));
    setSelectedDivision("");
  };

  // DOWNLOAD EXCEL
  const downloadExcel = () => {
    if (!workbook) return alert("No workbook loaded");

    const ws = XLSX.utils.aoa_to_sheet(sheetData || []);
    const newWb = {
      ...workbook,
      Sheets: { ...workbook.Sheets, [selectedSheet]: ws },
    };

    const wbout = XLSX.write(newWb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || "updated.xlsx";
    a.click();

    URL.revokeObjectURL(url);

    setWorkbook(newWb);
  };

  return (
    <div style={{ textAlign: "center", marginTop: 18 }}>
      {/* Keep the Upload Excel button inside the Task1Panel */}
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

      {/* SHEET SELECT */}
      {sheets.length > 1 && (
        <div>
          <span style={{ marginRight: "10px", fontSize: "18px" }}>Sheets:</span>
          <select
            value={selectedSheet}
            onChange={handleSheetChange}
            style={styles.dropdown}
          >
            {sheets.map((sheet, i) => (
              <option key={i} value={sheet}>
                {sheet}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* SEARCH */}
      <div style={styles.searchBar}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search across ALL sheets..."
          style={styles.searchInput}
        />
        <button onClick={() => setQuery("")} style={styles.clearButton}>
          Clear
        </button>
      </div>

      <div style={styles.rowCount}>
        Count: {displayedCount}{" "}
        {foundSheets.length > 0 && (
          <span style={{ marginLeft: "10px", color: "#fff" }}>
            (Found in: {foundSheets.join(", ")})
          </span>
        )}
      </div>

      <button onClick={saveToDatabase} style={styles.saveButton}>
        Save Excel to Database
      </button>

      {/* DIVISION SELECT */}
      {divisions.length > 0 && (
        <div style={{ marginTop: "20px" }}>
          <span
            style={{
              color: "#c9a646",
              fontWeight: "bold",
              marginRight: "10px",
            }}
          >
            Add Row Under Division:
          </span>

          <select
            value={selectedDivision}
            onChange={(e) => {
              const v = e.target.value;
              setSelectedDivision(v);

              const div = divisions.find((d) => d.name === v);
              if (div) setDivisionHeader(sheetData[div.index + 1] || []);
              else setDivisionHeader([]);
            }}
            style={styles.dropdown}
          >
            <option value="">Select Division</option>
            {divisions.map((d, i) => (
              <option key={i} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ADD ROW */}
      <div style={{ marginTop: "20px" }}>
        <h3 style={{ color: "#c9a646" }}>Add New Row</h3>

        <div
          style={{
            display: "flex",
            gap: "8px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {newRow.map((value, idx) => (
            <input
              key={idx}
              value={value}
              onChange={(e) => {
                const updated = [...newRow];
                updated[idx] = e.target.value;
                setNewRow(updated);
              }}
              style={{
                padding: "8px",
                minWidth: "120px",
                borderRadius: "6px",
              }}
              placeholder={`Column ${idx + 1}`}
            />
          ))}
        </div>

        <button
          onClick={addRowToSheet}
          style={{ ...styles.saveButton, marginTop: "10px" }}
        >
          Add Row
        </button>

        <button
          onClick={downloadExcel}
          style={{ ...styles.saveButton, marginTop: "10px", marginLeft: 12 }}
        >
          Download Updated Excel
        </button>
      </div>

      {/* TABLE */}
      {filteredData && (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <tbody>
              {filteredData.map((item, index) => {
                const row = item.row;

                if (!row) return null;

                const nonEmpty = (row || []).filter(
                  (v) => String(v ?? "").trim() !== ""
                ).length;

                if (nonEmpty === 1) {
                  const title = (row || []).find(
                    (v) => String(v ?? "").trim() !== ""
                  );

                  return (
                    <tr key={index}>
                      <td
                        colSpan={50}
                        style={{
                          textAlign: "center",
                          fontWeight: "bold",
                          background: "rgba(255,255,255,0.15)",
                          color: "#ffde7b",
                          padding: "12px",
                          fontSize: "18px",
                          border: "1px solid rgba(255,255,255,0.3)",
                        }}
                      >
                        {title} <span style={{ color: "#6cf" }}>({item.sheet})</span>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={index}>
                    {(row || []).map((cell, c) => (
                      <td key={c} style={styles.cell}>
                        {String(cell ?? "")}
                        {c === 0 && (
                          <span style={{ color: "#6cf", marginLeft: "6px" }}>
                            ({item.sheet})
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Side Menu */}
      {showMenu && (
        <div style={styles.sideMenu}>
          <button style={styles.closeMenuBtn} onClick={() => setShowMenu(false)}>
            X
          </button>

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

      {/* History Panel */}
      {showHistory && (
        <div style={styles.historyPanel}>
          <div style={styles.historyHeader}>
            <h3 style={{ fontSize: "22px" }}>Upload History</h3>
            <button style={styles.closeBtn} onClick={() => setShowHistory(false)}>
              X
            </button>
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
    </div>
  );
}

/* ------------------- STYLES ------------------- */

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
  hamburgerRow: { width: "100%", padding: "10px 40px 0px 40px" },
  hamburger: { fontSize: "28px", color: "#c9a646", cursor: "pointer" },
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
    cursor: "pointer",
  },
  saveButton: {
    marginTop: "15px",
    padding: "10px 20px",
    background: "#c9a646",
    color: "#000",
    fontWeight: "700",
    borderRadius: "8px",
    cursor: "pointer",
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
    cursor: "pointer",
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
    textDecoration: "none",
  },
  footer: {
    marginTop: "40px",
    textAlign: "center",
    padding: "15px",
    background: "#0d2238",
    borderTop: "1px solid #b38b59",
  },
};
