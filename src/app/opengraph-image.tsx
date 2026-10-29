import { ImageResponse } from "next/og";

export const alt = "Glassbox: an AI analytics agent that shows its work";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social preview: the demo's core idea in one frame (assumptions, a reviewed chart, a footnote). */
export default function OpengraphImage() {
  const ink = "#f4f3ef";
  const muted = "#8f8d85";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#0c0c0b", padding: "64px 72px", fontFamily: "sans-serif", color: ink }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#141413", border: "2px solid #363632", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="26" height="26" viewBox="0 0 20 20">
              <rect x="2.5" y="2.5" width="15" height="15" rx="4" fill="none" stroke="#f4f3ef" strokeWidth="1.6" />
              <path d="M6 13.5l2.5-3 2 1.75L14 7" fill="none" stroke="#25ee86" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: 4, textTransform: "uppercase" }}>Glassbox</div>
        </div>
        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", fontSize: 76, fontWeight: 800, lineHeight: 1, letterSpacing: -2.5, textTransform: "uppercase", maxWidth: 1000 }}>
          <span>An analyst that</span>
          <span style={{ color: "#25ee86" }}>shows its work</span>
        </div>
        <div style={{ marginTop: 24, fontSize: 26, color: muted, maxWidth: 940, lineHeight: 1.35 }}>
          Explicit assumptions you can edit. A second agent reviews every query. Every number links to its SQL and rows.
        </div>
        <div style={{ marginTop: "auto", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 12 }}>
            {[
              ["Active window", "30 days", false],
              ["Exclude test orgs", "Yes", false],
              ["Period", "Last quarter", true],
            ].map(([k, v, changed]) => (
              <div key={k as string} style={{ display: "flex", gap: 8, fontSize: 22, padding: "10px 16px", borderRadius: 10, border: `2px solid ${changed ? "#f2b544" : "#363632"}`, background: changed ? "#3a2d14" : "#141413" }}>
                <span style={{ color: muted }}>{k}</span>
                <span style={{ fontFamily: "monospace", color: changed ? "#f2b544" : ink }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <svg width="230" height="80" viewBox="0 0 230 80">
              <path d="M4 66 L40 58 L76 61 L112 44 L148 47 L184 26 L222 14" fill="none" stroke="#3987e5" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
              <circle cx="222" cy="14" r="7" fill="#3987e5" stroke="#0c0c0b" strokeWidth="3" />
            </svg>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18, color: "#4fd6cb", background: "#0f2a28", padding: "4px 12px", borderRadius: 999 }}>
              <svg width="16" height="16" viewBox="0 0 16 16">
                <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="#4fd6cb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Reviewed · SQL [1]
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
