import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#0b0d10",
          display: "flex",
          padding: 64,
        }}
      >
        <div
          style={{
            border: "8px solid #ff5e62",
            borderRadius: 32,
            padding: 48,
            color: "white",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 18,
          }}
        >
          <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: -2 }}>
            BrewNote
          </div>
          <div style={{ fontSize: 32, opacity: 0.8 }}>
            Brew DNA • Scan • Brew Mode
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
