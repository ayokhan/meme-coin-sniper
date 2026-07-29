import { Suspense } from "react";
import DemoRegistrationPage from "./DemoRegistrationClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950 text-zinc-400 p-10 text-sm">Loading…</div>}>
      <DemoRegistrationPage />
    </Suspense>
  );
}
