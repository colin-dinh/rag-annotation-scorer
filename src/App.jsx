import { useState, useCallback } from "react";

// ── Scoring weights ────────────────────────────────────────────
const WEIGHTS = {
  factualAccuracy: 0.35,
  sourceSupport: 0.25,
  sourceCredibility: 0.20,
  hallucinationRisk: 0.20,
};

const DIMENSIONS = [
  {
    key: "factualAccuracy",
    label: "Factual Accuracy",
    weight: 0.35,
    description: "Does the claim correctly represent what the cited source says?",
    anchors: { 0: "Contradicts source", 0.5: "Partially correct", 1: "Exact match" },
  },
  {
    key: "sourceSupport",
    label: "Source Support",
    weight: 0.25,
    description: "Does the cited source actually back this specific claim?",
    anchors: { 0: "Irrelevant / inaccessible", 0.5: "Tangentially related", 1: "Directly supports" },
  },
  {
    key: "sourceCredibility",
    label: "Source Credibility",
    weight: 0.20,
    description: "How authoritative / primary is the source?",
    anchors: { 0: "News media / blog", 0.5: "Legal advisory", 1: "Official law / gov decree" },
  },
  {
    key: "hallucinationRisk",
    label: "Hallucination Risk",
    weight: 0.20,
    description: "How verifiable is this claim? (inverted — higher = safer)",
    anchors: { 0: "Cannot be verified", 0.5: "Partial risk", 1: "Fully verified" },
  },
];

const BANDS = [
  { min: 0.90, max: 1.00, label: "Excellent",    action: "Publish as-is",                    color: "#16a34a", bg: "#dcfce7", border: "#86efac" },
  { min: 0.70, max: 0.89, label: "Good",         action: "Add citations → publish",           color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
  { min: 0.50, max: 0.69, label: "Borderline",   action: "Human review required",             color: "#92400e", bg: "#fef3c7", border: "#fcd34d" },
  { min: 0.25, max: 0.49, label: "Poor",         action: "Revise or remove claim",            color: "#b91c1c", bg: "#fee2e2", border: "#fca5a5" },
  { min: 0.00, max: 0.24, label: "Block",        action: "Block from RAG — escalate to legal",color: "#7f1d1d", bg: "#fecdd3", border: "#f43f5e" },
];

function getBand(score) {
  return BANDS.find(b => score >= b.min && score <= b.max) || BANDS[BANDS.length - 1];
}

function composite(scores) {
  return Object.entries(WEIGHTS).reduce((sum, [k, w]) => sum + (scores[k] ?? 0) * w, 0);
}

// ── Slider component ───────────────────────────────────────────
function ScoreSlider({ dimKey, value, onChange, dim }) {
  const pct = Math.round(value * 100);
  const color = value >= 0.7 ? "#16a34a" : value >= 0.5 ? "#d97706" : "#dc2626";

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <div>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 13, color: "#1e293b", letterSpacing: "0.01em" }}>
            {dim.label}
          </span>
          <span style={{ marginLeft: 8, fontSize: 11, color: "#64748b", fontFamily: "'DM Sans', sans-serif" }}>
            weight {Math.round(dim.weight * 100)}%
          </span>
        </div>
        <span style={{
          fontFamily: "'DM Mono', monospace",
          fontWeight: 700,
          fontSize: 16,
          color,
          minWidth: 36,
          textAlign: "right",
          transition: "color 0.2s",
        }}>
          {value.toFixed(2)}
        </span>
      </div>

      <p style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", margin: "0 0 6px", lineHeight: 1.4 }}>
        {dim.description}
      </p>

      <div style={{ position: "relative", height: 36 }}>
        {/* Track */}
        <div style={{
          position: "absolute", top: "50%", left: 0, right: 0, height: 6,
          background: "#e2e8f0", borderRadius: 3, transform: "translateY(-50%)",
        }} />
        {/* Fill */}
        <div style={{
          position: "absolute", top: "50%", left: 0, width: `${pct}%`, height: 6,
          background: `linear-gradient(90deg, #dc2626 0%, #d97706 45%, #16a34a 90%)`,
          borderRadius: 3, transform: "translateY(-50%)",
          transition: "width 0.15s",
        }} />
        <input
          type="range" min={0} max={1} step={0.05}
          value={value}
          onChange={e => onChange(dimKey, parseFloat(e.target.value))}
          style={{
            position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
            width: "100%", opacity: 0, cursor: "pointer", zIndex: 2,
          }}
        />
        {/* Thumb visual */}
        <div style={{
          position: "absolute", top: "50%",
          left: `calc(${pct}% - 10px)`,
          width: 20, height: 20,
          background: "#fff",
          border: `3px solid ${color}`,
          borderRadius: "50%",
          transform: "translateY(-50%)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
          transition: "left 0.1s, border-color 0.2s",
          pointerEvents: "none",
        }} />
      </div>

      {/* Anchors */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
        {Object.entries(dim.anchors).map(([score, text]) => (
          <span key={score} style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", maxWidth: 80, textAlign: score == 0 ? "left" : score == 1 ? "right" : "center" }}>
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Composite gauge ────────────────────────────────────────────
function CompositeGauge({ score }) {
  const band = getBand(score);
  const pct = score * 100;
  const circumference = 2 * Math.PI * 54;
  const strokeDash = (pct / 100) * circumference;

  const gaugeColor = score >= 0.7 ? "#16a34a" : score >= 0.5 ? "#d97706" : "#dc2626";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 0 12px" }}>
      <div style={{ position: "relative", width: 140, height: 140 }}>
        <svg width="140" height="140" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="70" cy="70" r="54" fill="none" stroke="#e2e8f0" strokeWidth="12" />
          <circle
            cx="70" cy="70" r="54" fill="none"
            stroke={gaugeColor} strokeWidth="12"
            strokeDasharray={`${strokeDash} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.4s ease, stroke 0.3s" }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{
            fontFamily: "'DM Mono', monospace", fontWeight: 700,
            fontSize: 30, color: gaugeColor, lineHeight: 1,
            transition: "color 0.3s",
          }}>
            {score.toFixed(2)}
          </span>
          <span style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>
            composite
          </span>
        </div>
      </div>

      <div style={{
        marginTop: 12,
        background: band.bg,
        border: `2px solid ${band.border}`,
        borderRadius: 10,
        padding: "8px 20px",
        textAlign: "center",
        transition: "all 0.3s",
      }}>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 800, fontSize: 15, color: band.color, letterSpacing: "0.05em" }}>
          {band.label.toUpperCase()}
        </div>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: band.color, marginTop: 2, opacity: 0.85 }}>
          {band.action}
        </div>
      </div>
    </div>
  );
}

// ── Dimension breakdown bar ────────────────────────────────────
function DimBar({ dim, value }) {
  const color = value >= 0.7 ? "#16a34a" : value >= 0.5 ? "#d97706" : "#dc2626";
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 11, fontFamily: "'DM Sans', sans-serif", color: "#475569", fontWeight: 600 }}>{dim.label}</span>
        <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", fontWeight: 700, color }}>{value.toFixed(2)}</span>
      </div>
      <div style={{ height: 6, background: "#e2e8f0", borderRadius: 3, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${value * 100}%`,
          background: color, borderRadius: 3,
          transition: "width 0.3s, background 0.3s",
        }} />
      </div>
    </div>
  );
}

// ── Claim row in log ───────────────────────────────────────────
function ClaimRow({ claim, index, onRemove }) {
  const score = composite(claim.scores);
  const band = getBand(score);
  return (
    <div style={{
      padding: "10px 14px",
      background: index % 2 === 0 ? "#f8fafc" : "#fff",
      borderBottom: "1px solid #e2e8f0",
      display: "flex", alignItems: "flex-start", gap: 10,
    }}>
      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#94a3b8", minWidth: 22, paddingTop: 2 }}>
        {String(index + 1).padStart(2, "0")}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: "0 0 4px", fontSize: 12, fontFamily: "'DM Sans', sans-serif",
          color: "#1e293b", lineHeight: 1.4,
          overflow: "hidden", textOverflow: "ellipsis",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        }}>
          {claim.text || <span style={{ color: "#94a3b8", fontStyle: "italic" }}>No claim text</span>}
        </p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {DIMENSIONS.map(d => (
            <span key={d.key} style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "#64748b" }}>
              {d.key.replace(/([A-Z])/g, ' $1').trim().split(' ')[0].slice(0,2).toUpperCase()}:{claim.scores[d.key]?.toFixed(2)}
            </span>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
        <span style={{
          fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 14,
          color: score >= 0.7 ? "#16a34a" : score >= 0.5 ? "#d97706" : "#dc2626",
        }}>
          {score.toFixed(2)}
        </span>
        <span style={{
          fontSize: 9, fontFamily: "'DM Sans', sans-serif", fontWeight: 700,
          color: band.color, background: band.bg, border: `1px solid ${band.border}`,
          borderRadius: 4, padding: "1px 6px", letterSpacing: "0.06em",
        }}>
          {band.label.toUpperCase()}
        </span>
        <button
          onClick={() => onRemove(index)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 10, color: "#cbd5e1", padding: 0, marginTop: 2,
          }}
        >✕ remove</button>
      </div>
    </div>
  );
}

// ── Summary stats ──────────────────────────────────────────────
function SummaryPanel({ claims }) {
  if (claims.length === 0) return null;
  const scores = claims.map(c => composite(c.scores));
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const bandCounts = BANDS.map(b => ({
    ...b,
    count: scores.filter(s => s >= b.min && s <= b.max).length,
  }));

  return (
    <div style={{ padding: "14px 16px", background: "#f8fafc", borderTop: "2px solid #e2e8f0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 12, color: "#334155", letterSpacing: "0.05em" }}>
          BATCH SUMMARY — {claims.length} CLAIMS
        </span>
        <span style={{
          fontFamily: "'DM Mono', monospace", fontWeight: 800, fontSize: 18,
          color: avg >= 0.7 ? "#16a34a" : avg >= 0.5 ? "#d97706" : "#dc2626",
        }}>
          avg {avg.toFixed(2)}
        </span>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {bandCounts.filter(b => b.count > 0).map(b => (
          <div key={b.label} style={{
            background: b.bg, border: `1px solid ${b.border}`,
            borderRadius: 6, padding: "4px 10px", textAlign: "center",
          }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 800, fontSize: 16, color: b.color }}>{b.count}</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, color: b.color, fontWeight: 700, letterSpacing: "0.05em" }}>{b.label.toUpperCase()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════
export default function RAGAnnotationScorer() {
  const defaultScores = { factualAccuracy: 0.75, sourceSupport: 0.75, sourceCredibility: 0.75, hallucinationRisk: 0.75 };
  const [scores, setScores] = useState({ ...defaultScores });
  const [claimText, setClaimText] = useState("");
  const [section, setSection] = useState("");
  const [sources, setSources] = useState("");
  const [notes, setNotes] = useState("");
  const [annotatorId, setAnnotatorId] = useState("");
  const [claims, setClaims] = useState([]);
  const [activeTab, setActiveTab] = useState("score"); // "score" | "log"

  const handleScore = useCallback((key, val) => {
    setScores(s => ({ ...s, [key]: val }));
  }, []);

  const compScore = composite(scores);
  const band = getBand(compScore);

  const handleSave = () => {
    setClaims(prev => [...prev, {
      text: claimText, section, sources, notes, annotatorId,
      scores: { ...scores },
      timestamp: new Date().toLocaleTimeString(),
    }]);
    setClaimText("");
    setSources("");
    setNotes("");
    setScores({ ...defaultScores });
    setActiveTab("log");
  };

  const handleRemove = (idx) => {
    setClaims(prev => prev.filter((_, i) => i !== idx));
  };

  const handleExportCSV = () => {
    const rows = [
      ["#", "Section", "Claim", "Sources", "Factual Accuracy", "Source Support", "Source Credibility", "Hallucination Risk", "Composite", "Band", "Notes", "Annotator", "Time"],
      ...claims.map((c, i) => {
        const cs_ = composite(c.scores);
        return [
          i + 1, c.section, `"${c.text}"`, `"${c.sources}"`,
          c.scores.factualAccuracy, c.scores.sourceSupport,
          c.scores.sourceCredibility, c.scores.hallucinationRisk,
          cs_.toFixed(3), getBand(cs_).label,
          `"${c.notes}"`, c.annotatorId, c.timestamp,
        ];
      }),
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "rag_annotation_output.csv"; a.click();
  };

  return (
    <div style={{
      fontFamily: "'DM Sans', sans-serif",
      background: "#f1f5f9",
      minHeight: "100vh",
      padding: "0",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&family=DM+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; }
        input[type=range] { -webkit-appearance: none; appearance: none; }
        textarea:focus, input:focus { outline: 2px solid #3b82f6; outline-offset: 1px; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
      `}</style>

      {/* Header */}
      <div style={{
        background: "#0f172a",
        padding: "16px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#475569", letterSpacing: "0.15em", marginBottom: 2 }}>
            RAG KNOWLEDGE BASE
          </div>
          <h1 style={{ margin: 0, fontFamily: "'DM Sans', sans-serif", fontWeight: 800, fontSize: 18, color: "#f8fafc", letterSpacing: "-0.01em" }}>
            Annotation Scoring Tool
          </h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["score", "log"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "6px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 12,
                letterSpacing: "0.05em",
                background: activeTab === tab ? "#3b82f6" : "#1e293b",
                color: activeTab === tab ? "#fff" : "#64748b",
                transition: "all 0.2s",
              }}
            >
              {tab === "score" ? "SCORE" : `LOG (${claims.length})`}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "score" && (
        <div style={{ display: "flex", gap: 0, height: "calc(100vh - 58px)", overflow: "hidden" }}>

          {/* LEFT — input form */}
          <div style={{
            width: "38%", background: "#fff", borderRight: "1px solid #e2e8f0",
            overflowY: "auto", padding: "20px 20px",
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.12em", marginBottom: 12 }}>
              CLAIM DETAILS
            </div>

            {[
              { label: "Claim Text", key: "claimText", val: claimText, set: setClaimText, rows: 3, placeholder: "Paste the extracted claim from the article..." },
              { label: "Section", key: "section", val: section, set: setSection, rows: 1, placeholder: "e.g. Định nghĩa và Phạm vi" },
              { label: "Cited Source(s)", key: "sources", val: sources, set: setSources, rows: 2, placeholder: "e.g. [1] accgroup.vn, [2] baochinhphu.vn" },
              { label: "Annotator Notes", key: "notes", val: notes, set: setNotes, rows: 2, placeholder: "Supporting reasoning, discrepancies, flags..." },
              { label: "Annotator ID", key: "annotatorId", val: annotatorId, set: setAnnotatorId, rows: 1, placeholder: "e.g. ANT-01" },
            ].map(({ label, key, val, set, rows, placeholder }) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 4, letterSpacing: "0.03em" }}>
                  {label}
                </label>
                <textarea
                  rows={rows}
                  value={val}
                  onChange={e => set(e.target.value)}
                  placeholder={placeholder}
                  style={{
                    width: "100%", padding: "8px 10px",
                    border: "1.5px solid #e2e8f0", borderRadius: 8,
                    fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#1e293b",
                    resize: "vertical", background: "#f8fafc", lineHeight: 1.5,
                  }}
                />
              </div>
            ))}
          </div>

          {/* MIDDLE — sliders */}
          <div style={{
            flex: 1, overflowY: "auto", padding: "20px 24px",
            background: "#fff",
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.12em", marginBottom: 16 }}>
              DIMENSION SCORES
            </div>
            {DIMENSIONS.map(dim => (
              <ScoreSlider
                key={dim.key}
                dimKey={dim.key}
                value={scores[dim.key]}
                onChange={handleScore}
                dim={dim}
              />
            ))}

            {/* Composite formula display */}
            <div style={{
              marginTop: 4, padding: "10px 14px",
              background: "#f8fafc", borderRadius: 10,
              border: "1px solid #e2e8f0", fontSize: 11,
              fontFamily: "'DM Mono', monospace", color: "#64748b", lineHeight: 1.8,
            }}>
              <div style={{ fontWeight: 700, color: "#334155", marginBottom: 4 }}>Composite Formula</div>
              {DIMENSIONS.map(d => (
                <div key={d.key}>
                  ({scores[d.key].toFixed(2)} × {Math.round(d.weight * 100)}%) = <span style={{ color: "#3b82f6" }}>{(scores[d.key] * d.weight).toFixed(3)}</span>
                </div>
              ))}
              <div style={{ borderTop: "1px solid #e2e8f0", marginTop: 6, paddingTop: 6, fontWeight: 700, color: "#1e293b" }}>
                Total = <span style={{ color: compScore >= 0.7 ? "#16a34a" : compScore >= 0.5 ? "#d97706" : "#dc2626" }}>{compScore.toFixed(3)}</span>
              </div>
            </div>

            <button
              onClick={handleSave}
              style={{
                marginTop: 18, width: "100%",
                background: "#1e293b", color: "#fff",
                border: "none", borderRadius: 10, padding: "12px",
                fontFamily: "'DM Sans', sans-serif", fontWeight: 800, fontSize: 13,
                letterSpacing: "0.06em", cursor: "pointer",
                transition: "background 0.2s",
              }}
              onMouseOver={e => e.target.style.background = "#3b82f6"}
              onMouseOut={e => e.target.style.background = "#1e293b"}
            >
              SAVE CLAIM TO LOG →
            </button>
          </div>

          {/* RIGHT — gauge + breakdown */}
          <div style={{
            width: "26%", background: "#0f172a",
            overflowY: "auto", padding: "20px 18px",
            borderLeft: "1px solid #1e293b",
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.12em", marginBottom: 4 }}>
              LIVE SCORE
            </div>

            <CompositeGauge score={compScore} />

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.10em", marginBottom: 10 }}>
                DIMENSION BREAKDOWN
              </div>
              {DIMENSIONS.map(d => (
                <DimBar key={d.key} dim={d} value={scores[d.key]} />
              ))}
            </div>

            {/* Band legend */}
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.10em", marginBottom: 8 }}>
                SCORE BANDS
              </div>
              {BANDS.map(b => (
                <div key={b.label} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "5px 8px", marginBottom: 4, borderRadius: 6,
                  background: compScore >= b.min && compScore <= b.max ? b.bg : "#1e293b",
                  border: `1px solid ${compScore >= b.min && compScore <= b.max ? b.border : "#334155"}`,
                  transition: "all 0.3s",
                }}>
                  <span style={{
                    fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 11,
                    color: compScore >= b.min && compScore <= b.max ? b.color : "#475569",
                  }}>
                    {b.label}
                  </span>
                  <span style={{
                    fontFamily: "'DM Mono', monospace", fontSize: 10,
                    color: compScore >= b.min && compScore <= b.max ? b.color : "#475569",
                  }}>
                    {b.min.toFixed(2)}–{b.max.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "log" && (
        <div style={{ height: "calc(100vh - 58px)", display: "flex", flexDirection: "column", background: "#fff" }}>
          {/* Log header */}
          <div style={{
            padding: "12px 20px", background: "#fff",
            borderBottom: "2px solid #e2e8f0",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#475569", fontWeight: 700, letterSpacing: "0.1em" }}>
              ANNOTATION LOG — {claims.length} CLAIM{claims.length !== 1 ? "S" : ""}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setActiveTab("score")}
                style={{
                  padding: "6px 14px", borderRadius: 8,
                  border: "1.5px solid #e2e8f0", cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 11,
                  background: "#fff", color: "#475569",
                }}
              >
                + Add Claim
              </button>
              {claims.length > 0 && (
                <button
                  onClick={handleExportCSV}
                  style={{
                    padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 11,
                    background: "#1e293b", color: "#fff",
                  }}
                >
                  Export CSV ↓
                </button>
              )}
            </div>
          </div>

          {/* Log body */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {claims.length === 0 ? (
              <div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600 }}>No claims scored yet</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Score your first claim in the Score tab</div>
              </div>
            ) : (
              <>
                {/* Column header */}
                <div style={{
                  display: "flex", padding: "6px 14px",
                  background: "#f8fafc", borderBottom: "1px solid #e2e8f0",
                  fontSize: 10, fontWeight: 700, color: "#94a3b8",
                  fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.08em",
                }}>
                  <span style={{ minWidth: 32 }}>#</span>
                  <span style={{ flex: 1 }}>CLAIM</span>
                  <span style={{ minWidth: 80, textAlign: "right" }}>SCORE / BAND</span>
                </div>
                {claims.map((c, i) => (
                  <ClaimRow key={i} claim={c} index={i} onRemove={handleRemove} />
                ))}
              </>
            )}
          </div>

          <SummaryPanel claims={claims} />
        </div>
      )}
    </div>
  );
}
