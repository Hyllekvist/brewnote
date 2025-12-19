import { Suspense } from "react";
import CallbackClient from "./CallbackClient";

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Logger ind…</div>}>
      <CallbackClient />
    </Suspense>
  );
}
