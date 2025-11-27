
import React, { useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx/dist/xlsx.full.min.js";

export default function Home() {
  const tasks = [1, 2, 3, 4, 5];
  const fileInputRef = useRef(null);
  const searchInputRef = useRef(null);
  const [sheetData, setSheetData] = useState(null); // array of arrays
  const [fileName, setFileName] = useState("");

  // search state
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState([]); // [{r,c,text}]
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("excel", file);

  // 1. Upload to backend
  try {
    const res = await fetch("http://localhost:5000/upload", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    console.log("Uploaded:", data);
  } catch (err) {
    console.error("Upload failed:", err);
  }

  // 2. Continue with your existing frontend logic (sheet display, search)
  setFileName(file.name);
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  setWorkbook(wb);
  setSheetNames(wb.SheetNames);
  setSelectedSheet(wb.SheetNames[0]);
  const arr = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  setSheetData(arr);
    // const file = e.target.files?.[0];
    // if (!file) return;
    // setFileName(file.name);

    // try {
    //   const data = await file.arrayBuffer();
    //   const workbook = XLSX.read(data, { type: "array" });
    //   const firstSheetName = workbook.SheetNames[0];
    //   const worksheet = workbook.Sheets[firstSheetName];
    //   const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    //   setSheetData(rows);
    //   // reset search
    //   setQuery("");
    //   setMatches([]);
    //   setCurrentMatchIndex(0);
    // } catch (err) {
    //   console.error("Failed to parse file:", err);
    //   setSheetData([["Error parsing file"]]);
    // }

    // e.target.value = null;
  };

  // compute matches whenever sheetData or query changes
  useEffect(() => {
    if (!sheetData || !query) {
      setMatches([]);
      setCurrentMatchIndex(0);
      return;
    }

    const q = String(query).toLowerCase();
    const newMatches = [];
    sheetData.forEach((row, r) => {
      (row || []).forEach((cell, c) => {
        const text = cell == null ? "" : String(cell);
        if (text.toLowerCase().includes(q)) {
          newMatches.push({ r, c, text });
        }
      });
    });

    setMatches(newMatches);
    setCurrentMatchIndex(newMatches.length ? 0 : 0);
  }, [sheetData, query]);

  // scroll into view when currentMatchIndex changes
  useEffect(() => {
    if (!matches.length) return;
    const cur = matches[currentMatchIndex % matches.length];
    if (!cur) return;
    const el = document.getElementById(cellId(cur.r, cur.c));
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  }, [currentMatchIndex, matches]);

  // keyboard shortcut: focus search on Ctrl+F (or Cmd+F on Mac) — prevents default browser find
  useEffect(() => {
    const handler = (e) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const metaKey = isMac ? e.metaKey : e.ctrlKey;
      if (metaKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const nextMatch = () => {
    if (!matches.length) return;
    setCurrentMatchIndex((i) => (i + 1) % matches.length);
  };
  const prevMatch = () => {
    if (!matches.length) return;
    setCurrentMatchIndex((i) => (i - 1 + matches.length) % matches.length);
  };

  const cellId = (r, c) => `cell-${r}-${c}`;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h2 style={styles.logo}>🏫 KMIT</h2>
        <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: 'center' }}>
          {/* <button onClick={handleUploadClick} style={styles.uploadButton} title="Upload Excel">
            Upload Excel
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFile}
            style={{ display: "none" }} */}
          />
        </div>
      </header>

      <main style={styles.main}>
        <h1 style={styles.title}>Welcome to KMIT</h1>
        <p style={styles.subtitle}>
          Powered by Genesis.
        </p>

        <div style={styles.buttonContainer}>
          {tasks.map((num) => (
            <Link key={num} to={`/task/${num}`} style={styles.button}>
              Task {num}
            </Link>
          ))}
        </div>

        {/* Uploaded file info and search controls */}
        {fileName && (
          <div style={{ marginTop: 24, color: "#e6e6e6", display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center' }}>
            <strong>Uploaded:</strong> {fileName}

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                ref={searchInputRef}
                placeholder="Search..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={styles.searchInput}
              />

              <button onClick={prevMatch} style={styles.smallButton} title="Previous match">
                ◀
              </button>
              <button onClick={nextMatch} style={styles.smallButton} title="Next match">
                ▶
              </button>

              <div style={{ color: '#cbd5e1' }}>
                {matches.length ? `${currentMatchIndex + 1} of ${matches.length}` : '0 matches'}
              </div>

              <button onClick={() => { setQuery(''); setMatches([]); setCurrentMatchIndex(0); }} style={styles.clearButton}>
                Clear
              </button>
            </div>
          </div>
        )}

        {sheetData && (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                {sheetData[0] && (
                  <tr>
                    {sheetData[0].map((cell, i) => (
                      <th key={i} style={styles.th}>
                        {cell ?? ""}
                      </th>
                    ))}
                  </tr>
                )}
              </thead>
              <tbody>
                {sheetData.slice(1).map((row, rIdx) => (
                  <tr key={rIdx} style={rIdx % 2 ? styles.oddRow : {}}>
                    {Array.from({ length: Math.max(...sheetData.map(r => r.length)) }).map((_, cIdx) => {
                      const cell = (row || [])[cIdx];
                      const isMatch = matches.some(m => m.r === rIdx + 1 && m.c === cIdx);
                      const matchIndex = matches.findIndex(m => m.r === rIdx + 1 && m.c === cIdx);
                      const isCurrent = matchIndex === currentMatchIndex;

                      return (
                        <td
                          id={cellId(rIdx + 1, cIdx)}
                          key={cIdx}
                          style={{
                            ...styles.td,
                            background: isCurrent ? 'rgba(242, 215, 91, 0.9)' : isMatch ? 'rgba(252, 211, 77, 0.18)' : undefined,
                            color: isCurrent ? '#0b1220' : styles.td.color,
                          }}
                        >
                          {String(cell ?? "")}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <footer style={styles.footer}>© KESHAV MEMORIAL INSTITUTE OF TECHNOLOGY</footer>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    width: "100vw",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "center",
    background: "linear-gradient(180deg, #12385b 0%, #12263a 100%)",
    color: "#f1f5f9",
    fontFamily: "'Poppins', sans-serif",
  },
  header: {
    width: "100%",
    padding: "12px 32px",
    backgroundColor: "#0d2238",
    borderBottom: "2px solid #b38b59",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
  },
  logo: {
    fontWeight: 700,
    fontSize: "1.2rem",
    color: "#c9a646",
  },
  uploadButton: {
    padding: "8px 14px",
    backgroundColor: "#2b6cb0",
    color: "#fff",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    boxShadow: "0 4px 8px rgba(0,0,0,0.15)",
  },
  main: {
    textAlign: "center",
    marginTop: "40px",
    width: "100%",
    padding: "0 20px",
  },
  title: {
    fontSize: "2.4rem",
    fontWeight: 700,
    color: "#c9a646",
    marginBottom: "0.5rem",
    letterSpacing: "1px",
  },
  subtitle: {
    fontSize: "1.0rem",
    color: "#d1d5db",
    marginBottom: "2rem",
    maxWidth: "900px",
    marginInline: "auto",
  },
  buttonContainer: {
    display: "flex",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: "14px",
  },
  button: {
    padding: "10px 20px",
    backgroundColor: "#b38b59",
    borderRadius: "8px",
    fontWeight: 600,
    color: "#fff",
    fontSize: "15px",
    textDecoration: "none",
    transition: "all 0.2s ease",
    boxShadow: "0 4px 8px rgba(0,0,0,0.15)",
  },
  tableWrapper: {
    width: "95%",
    maxWidth: 1100,
    marginTop: 24,
    marginInline: "auto",
    overflow: "auto",
    background: "rgba(255,255,255,0.03)",
    padding: 12,
    borderRadius: 10,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "auto",
  },
  th: {
    textAlign: "left",
    padding: "10px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    fontWeight: 700,
    color: "#f8fafc",
    background: "rgba(0,0,0,0.05)",
  },
  td: {
    padding: "10px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.03)",
    color: "#e6eef8",
    verticalAlign: "top",
    whiteSpace: "nowrap",
  },
  oddRow: {
    background: "rgba(255,255,255,0.01)",
  },
  footer: {
    width: "100%",
    textAlign: "center",
    padding: "12px 0",
    fontSize: "0.9rem",
    color: "#9ca3af",
    backgroundColor: "#0d2238",
    borderTop: "1px solid #b38b59",
  },
  searchInput: {
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.02)',
    color: '#e6eef8',
    outline: 'none',
    minWidth: 260,
  },
  smallButton: {
    padding: '6px 10px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    background: 'rgba(255,255,255,0.03)',
    color: '#e6eef8',
  },
  clearButton: {
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.06)',
    cursor: 'pointer',
    background: 'transparent',
    color: '#e6eef8',
  }
};