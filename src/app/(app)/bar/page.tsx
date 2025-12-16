import BarClient from "./BarClient";

export const dynamic = "force-dynamic";

export default function BarPage() {
  return (
    <main style={{ padding: 16, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ margin: "6px 0 10px" }}>Din Bar</h1>
      <p style={{ opacity: 0.7, marginTop: 0 }}>
        Det du har tilføjet — klar til bryg og noter.
      </p>

      <BarClient />
    </main>
  );
}