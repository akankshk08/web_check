import { ImageResponse } from "next/og";

export const alt = "AgencyOS — One workspace. Every project. Every client.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Link-preview image used when the site is shared on social media or chat apps. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#151923", padding: 80, color: "white", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 40, fontWeight: 700 }}>
          <div style={{ width: 64, height: 64, borderRadius: 14, background: "#536DFE", display: "flex" }} />
          AgencyOS
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1 }}>One workspace. Every project. Every client.</div>
          <div style={{ fontSize: 30, color: "#c9cfdc" }}>Projects, approvals, client portals, files and invoices for digital agencies.</div>
        </div>
      </div>
    ),
    size,
  );
}
