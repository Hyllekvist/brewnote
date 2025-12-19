import { Suspense } from "react";
import ScanResultClient from "./ScanResultClient";

export default function Page({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
      <ScanResultClient id={params.id} />
    </Suspense>
  );
}