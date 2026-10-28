import { ImageResponse } from "next/og";

export const alt = "Glassbox: an AI analytics agent that shows its work";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social preview: the demo's core idea in one frame (assumptions, a reviewed chart, a footnote). */
export default function OpengraphImage() {
  const ink = "#1a1915";
  const muted = "#6a665d";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#f5f3ee", padding: "64px 72px", fontFamily: "sans-serif", color: ink }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 9, background: ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="26" height="26" viewBox="0 0 20 20">
              <rect x="2.5" y="2.5" width="15" height="15" rx="3" fill="none" stroke="#f5f3ee" strokeWidth="1.6" />
              <path d="M6 13.5l2.5-3 2 1.75L14 7" fill="none" stroke="#e9a23b" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ fontSize: 30, fontWeight: 600 }}>Glassbox</div>
        </div>
        <div style={{ marginTop: 44, fontSize: 66, lineHeight: 1.05, letterSpacing: -1.5, maxWidth: 900 }}>An analytics agent that shows its work.</div>
        <div style={{ marginTop: 22, fontSize: 27, color: muted, maxWidth: 940, lineHeight: 1.35 }}>
          Explicit assumptions you can edit. A second agent reviews every query. Every number links to its SQL and rows.
        </div>
        <div style={{ marginTop: "auto", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 12 }}>
            {[
              ["Active window", "30 days", false],
              ["Exclude test orgs", "Yes", false],
              ["Period", "Last quarter", true],
            ].map(([k, v, changed]) => (
              <div key={k as string} style={{ display: "flex", gap: 8, fontSize: 22, padding: "10px 16px", borderRadius: 10, border: `2px solid ${changed ? "#e9a23b" : "#cdc8bc"}`, background: changed ? "#f8e6c0" : "#fbfaf6" }}>
                <span style={{ color: muted }}>{k}</span>
                <span style={{ fontFamily: "monospace", color: changed ? "#8f5600" : ink }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <svg width="230" height="80" viewBox="0 0 230 80">
              <path d="M4 66 L40 58 L76 61 L112 44 L148 47 L184 26 L222 14" fill="none" stroke="#2a78d6" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
              <circle cx="222" cy="14" r="7" fill="#2a78d6" stroke="#f5f3ee" strokeWidth="3" />
            </svg>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18, color: "#2e6b30", background: "#e2eedd", padding: "4px 12px", borderRadius: 999 }}>
              <svg width="16" height="16" viewBox="0 0 16 16">
                <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="#2e6b30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
