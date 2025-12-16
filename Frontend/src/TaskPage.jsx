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
const [newColumnName, setNewColumnName] = useState("");
const [editingRowIndex, setEditingRowIndex] = useState(null);
  // const [divisions, setDivisions] = useState([]);
  const [divisionsBySheet, setDivisionsBySheet] = useState({});
  const [selectedDivision, setSelectedDivision] = useState("");
  const API_BASE = "http://localhost:5000";

  // ⭐ NEW
  const [showMenu, setShowMenu] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [insertIndex, setInsertIndex] = useState("");

const currentDivisions = divisionsBySheet[selectedSheet] || [];

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
    // setDivisions(detectDivisions(rows));
    setDivisionsBySheet({
  [wb.SheetNames[0]]: detectDivisions(rows),
});


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
    // setDivisions(detectDivisions(rows));
    setDivisionsBySheet(prev => ({
  ...prev,
  [name]: detectDivisions(rows),
}));


    const maxCols = Math.max(...rows.map((r) => r.length), 1);
    setNewRow(Array(maxCols).fill(""));
  };
const getDivisionDataIndexes = () => {
  const rows = sheetData;
  if (!Array.isArray(rows)) return [];

  let insideDivision = selectedDivision ? false : true;
  let skipHeader = false;
  const indexes = [];

  rows.forEach((row, index) => {
    const nonEmpty = row.filter(v => String(v ?? "").trim() !== "").length;

    // Division title
    if (nonEmpty === 1) {
      const title = row.find(v => v);
      if (selectedDivision && title === selectedDivision) {
        insideDivision = true;
        skipHeader = true;
        return;
      }
      if (selectedDivision && insideDivision) {
        insideDivision = false;
      }
      return;
    }

    if (!insideDivision) return;

    // Skip column header
    if (skipHeader && nonEmpty > 1) {
      skipHeader = false;
      return;
    }

    // Actual data
    if (nonEmpty > 1) {
      indexes.push(index);
    }
  });

  return indexes;
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


const getDataRowIndexes = (start = 0, end = sheetData.length) => {
  if (!Array.isArray(sheetData)) return [];

  const indexes = [];
  let skipNextMultiCell = false;

  for (let i = start; i < end; i++) {
    const row = sheetData[i];
    if (!Array.isArray(row)) continue;

    const nonEmpty = row.filter(
      v => String(v ?? "").trim() !== ""
    ).length;

    // Section title
    if (nonEmpty === 1) {
      skipNextMultiCell = true;
      continue;
    }

    // Column header (after section title)
    if (nonEmpty > 1 && skipNextMultiCell) {
      skipNextMultiCell = false;
      continue;
    }

    // Data row
    if (nonEmpty > 1) {
      indexes.push(i);
    }
  }

  return indexes;
};



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

const getDivisionRowIndexes = () => {
  if (!sheetData || !selectedDivision) return [];

  let insideDivision = false;
  let skipHeader = false;
  const dataRows = [];
  let headerRowIndex = -1;

  sheetData.forEach((row, index) => {
    const nonEmpty = row.filter(v => String(v ?? "").trim() !== "").length;

    // Division title row
    if (nonEmpty === 1) {
      const title = row.find(v => v);
      if (title === selectedDivision) {
        insideDivision = true;
        skipHeader = true;
      } else if (insideDivision) {
        insideDivision = false;
      }
      return;
    }

    if (!insideDivision) return;

    // Column header row
    if (skipHeader && nonEmpty > 1) {
      headerRowIndex = index;
      skipHeader = false;
      return;
    }

    // Data rows
    if (nonEmpty > 1) {
      dataRows.push(index);
    }
  });

  return { headerRowIndex, dataRows };
};


const addRowToSheet = () => {
  if (!sheetData) return alert("Upload Excel first!");
  if (!insertIndex) return alert("Enter row position");

  const updated = [...sheetData];
  const pos = Number(insertIndex);
  const dataIndexes = getDivisionDataIndexes();

  if (isNaN(pos) || pos < 1 || pos > dataIndexes.length + 1) {
    return alert("Invalid row position");
  }

  let insertAt;

  if (dataIndexes.length === 0) {
    insertAt = updated.length;
  } else if (pos === dataIndexes.length + 1) {
    insertAt = dataIndexes[dataIndexes.length - 1] + 1;
  } else {
    insertAt = dataIndexes[pos - 1];
  }

  updated.splice(insertAt, 0, [...newRow]);

  setSheetData(updated);
  workbook.Sheets[selectedSheet] = XLSX.utils.aoa_to_sheet(updated);

  setNewRow(newRow.map(() => ""));
  setInsertIndex("");

  alert("Row inserted correctly");
};



const addColumn = () => {
  if (!sheetData) return alert("Upload Excel first!");

  const updated = [...sheetData];
  const divisions = divisionsBySheet[selectedSheet] || [];

  // ✅ CASE 1: NO DIVISIONS → ADD COLUMN TO WHOLE SHEET
  if (divisions.length === 0) {
    updated.forEach((row, rowIndex) => {
      // Add header name only to first row
      if (rowIndex === 0) {
        row.push(newColumnName || `Column ${row.length + 1}`);
      } else {
        row.push("");
      }
    });

    setSheetData(updated);
    workbook.Sheets[selectedSheet] = XLSX.utils.aoa_to_sheet(updated);
    setNewRow((prev) => [...prev, ""]);
    setNewColumnName("");

    alert("Column added to sheet");
    return;
  }

  // ❌ HAS DIVISIONS BUT NONE SELECTED
  if (!selectedDivision) {
    return alert("Select a division first!");
  }

  // ✅ CASE 2: ADD COLUMN ONLY TO SELECTED DIVISION
  const { headerRowIndex, dataRows } = getDivisionRowIndexes();

  if (headerRowIndex === -1) {
    return alert("Invalid division structure");
  }

  updated[headerRowIndex].push(
    newColumnName || `Column ${updated[headerRowIndex].length + 1}`
  );

  dataRows.forEach((rowIndex) => {
    updated[rowIndex].push("");
  });

  setSheetData(updated);
  workbook.Sheets[selectedSheet] = XLSX.utils.aoa_to_sheet(updated);
  setNewColumnName("");

  alert(`Column added to ${selectedDivision}`);
};
const isDateString = (value) => {
  return typeof value === "string" &&
    /^\d{2}-\d{2}-\d{4}/.test(value);
};

const parseToExcelDate = (value) => {
  const [date, time = "00:00:00"] = value.split(" ");
  const [dd, mm, yyyy] = date.split("-").map(Number);
  const [hh, mi, ss] = time.split(":").map(Number);

  return new Date(yyyy, mm - 1, dd, hh, mi, ss);
};


  // const downloadExcel = () => {
  //   const ws = XLSX.utils.aoa_to_sheet(sheetData);
  //   workbook.Sheets[selectedSheet] = ws;

  //   const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });

  //   const blob = new Blob([wbout], { type: "application/octet-stream" });
  //   const url = URL.createObjectURL(blob);

  //   const a = document.createElement("a");
  //   a.href = url;
  //   a.download = fileName || "updated.xlsx";
  //   a.click();

  //   URL.revokeObjectURL(url);
  // };
  const downloadExcel = () => {
  const converted = sheetData.map(row =>
    row.map(cell => {
      if (isDateString(cell)) {
        return parseToExcelDate(cell); // 👈 real Date object
      }
      return cell;
    })
  );

  const ws = XLSX.utils.aoa_to_sheet(converted);

  // ⭐ Format date columns properly
  Object.keys(ws).forEach((key) => {
    if (ws[key] && ws[key].v instanceof Date) {
      ws[key].t = "d";
      ws[key].z = "dd-mm-yyyy hh:mm:ss";
    }
  });

  workbook.Sheets[selectedSheet] = ws;

  const wbout = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
    cellDates: true
  });

  const blob = new Blob([wbout], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = fileName || "updated.xlsx";
  a.click();

  URL.revokeObjectURL(url);
};

const handleCellChange = (rowIndex, colIndex, value) => {
  const updated = [...sheetData];
  updated[rowIndex][colIndex] = value;

  setSheetData(updated);
  workbook.Sheets[selectedSheet] = XLSX.utils.aoa_to_sheet(updated);
};



const viewHistoryFile = async (item) => {
  const res = await fetch(`${API_BASE}/history/${item.id}`);
  const data = await res.json();

  if (!data.json_data) {
    alert("No data available to view");
    return;
  }

  setSheetData(data.json_data);
  setFileName(data.file_name);
  setSheets(["History"]);
  setSelectedSheet("History");

  setDivisionsBySheet({
    History: detectDivisions(data.json_data),
  });

  setShowMenu(false);
};

// ⭐ DOWNLOAD HISTORY FILE
const downloadHistoryFile = async (item) => {
  try {
    const res = await fetch(`${API_BASE}/history/${item.id}`);
    const data = await res.json();

    if (!data.json_data) {
      alert("No data available to download");
      return;
    }

    const ws = XLSX.utils.aoa_to_sheet(data.json_data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = data.file_name || "download.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert("Failed to download history file");
  }
};

 const isDataRow = (row, rowIndex) => {
  if (!Array.isArray(row)) return false;

  const nonEmpty = row.filter(
    v => String(v ?? "").trim() !== ""
  ).length;

  // ❌ exclude division titles
  if (nonEmpty === 1) return false;

  // ❌ exclude headers
  if (isHeaderRow(rowIndex)) return false;

  // ✅ real data row
  return nonEmpty > 1;
};

const isHeaderRow = (rowIndex) => {
  if (!sheetData || rowIndex === 0) return true;

  const currentRow = sheetData[rowIndex];
  const prevRow = sheetData[rowIndex - 1];

  const currentNonEmpty = currentRow.filter(
    v => String(v ?? "").trim() !== ""
  ).length;

  const prevNonEmpty = prevRow.filter(
    v => String(v ?? "").trim() !== ""
  ).length;

  // Case 1: division title row
  if (currentNonEmpty === 1) return true;

  // Case 2: column header row (after division title)
  if (currentNonEmpty > 1 && prevNonEmpty === 1) return true;

  return false; // ✅ data row
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

    <span style={{ fontSize: "12px", opacity: 0.7 }}>
      {formatTimestamp(item)}
    </span>

    <div style={{ marginTop: 8, display: "flex", gap: "8px" }}>
      <button
        style={styles.historyBtn}
        onClick={() => viewHistoryFile(item)}
      >
        👁 View
      </button>

      <button
        style={styles.historyBtn}
        onClick={() => downloadHistoryFile(item)}
      >
        ⬇ Download
      </button>
    </div>
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
              Count: { filteredData.filter(item =>
                        isDataRow(item.row, sheetData.indexOf(item.row))).length}
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
              {currentDivisions.length > 0 && (
                <select
                  value={selectedDivision}
                  onChange={(e) => setSelectedDivision(e.target.value)}
                  style={styles.dropdown}
                >
                  <option value="">Select Division</option>
                  {currentDivisions.map((d) => (
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
              {/* INSERT ROW POSITION */}
<div style={{ marginTop: 10 }}>
  <input
    type="number"
    value={insertIndex}
    onChange={(e) => setInsertIndex(e.target.value)}
    placeholder="Insert at row number (1-based)"
    style={styles.input}
  />
  <p style={{ fontSize: "12px", opacity: 0.7 }}>
    {/* x  */}
  </p>
</div>


              <button onClick={addRowToSheet} style={styles.saveButton}>
                Add Row
              </button>

              <button onClick={downloadExcel} style={styles.saveButton}>
                Download Updated Excel
              </button>
              {/* ADD COLUMN */}
<div style={{ marginTop: 30 }}>
  <h3 style={{ color: "#c9a646" }}>Add Column</h3>

  <input
    value={newColumnName}
    onChange={(e) => setNewColumnName(e.target.value)}
    placeholder="Column name (optional)"
    style={styles.input}
  />

  <br />

  <button onClick={addColumn} style={styles.saveButton}>
    Add Column
  </button>
</div>

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
    {editingRowIndex === index ? (
      
      <input
  value={cell ?? ""}
  onChange={(e) => handleCellChange(index, c, e.target.value)}
  style={{
    width: "100%",
    height: "28px",
    padding: "2px 6px",
    fontSize: "13px",
    borderRadius: "4px",
    border: "1px solid #ccc",
    outline: "none",
  }}
/>

    ) : (
      <span>{String(cell ?? "")}</span>
    )}
  </td>
))}
<td style={styles.cell}>
  {editingRowIndex === index ? (
    <>
      {/* <button
        onClick={() => setEditingRowIndex(null)}
        style={styles.saveBtn}
      >
        💾
      </button>
       */}
       <button
  onClick={() => setEditingRowIndex(null)}
  style={styles.iconBtn}
  title="Save"
>
  💾
</button>

    </>
  ) : (
    
    <button
  onClick={() => setEditingRowIndex(index)}
  style={styles.iconBtn}
  title="Edit"
>
  ✏️
</button>

  )}
</td>


                        {/* {row.map((cell, c) => (
                          <td key={c} style={styles.cell}>
                            {String(cell ?? "")}
                          </td>
                        ))} */}
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
historyBtn: {
  padding: "6px 12px",
  borderRadius: "6px",
  border: "none",
  cursor: "pointer",
  fontSize: "13px",
  fontWeight: 600,
  background: "#c9a646",
  color: "#000",
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
editBtn: {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontSize: "18px",
},

saveBtn: {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontSize: "18px",
  color: "#2ecc71",
},

  historyItem: {
    background: "rgba(255,255,255,0.1)",
    padding: "10px",
    borderRadius: "8px",
    marginTop: "10px",
  },
  iconBtn: {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontSize: "14px",   // 🔥 SMALL ICON
  padding: "4px",
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
