import { redirect } from "next/navigation";

/** Legacy URL — Discovery call lives at /discovery-call. */
export default function StrategyCallRedirectPage() {
  redirect("/discovery-call");
}
