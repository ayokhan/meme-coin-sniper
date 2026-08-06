import { redirect } from "next/navigation";

/** Legacy URL — desk chooser is the canonical entry. */
export default function HowItWorksRedirect() {
  redirect("/enter");
}
