import { ImageResponse } from "next/og";
export const runtime = "edge";
export async function GET() {
  return new ImageResponse(
    (<div style={{ width: "1200px", height: "630px", background: "#0b0d10", display: "flex", padding: 64 }}>
      <div style={{ border: "8px solid #ff5e62", borderRadius: 32, padding: 48, color: "white", width: "100%" }}>
        <div style={{ fontSize: 64, fontWeight: 800 }}>Coffee & Tee</div>
        <div style={{ marginTop: 18, fontSize: 32, opacity: 0.8 }}>Brew DNA • Scan • Brew Mode</div>
      </div>
    </div>),
    { width: 1200, height: 630 }
  );
}
