import type { Metadata } from "next";
import EnterDesksClient from "@/components/EnterDesksClient";

export const metadata: Metadata = {
  title: "Enter NovaStaris — Choose your trading desk",
  description:
    "World-class entry to NovaStaris: pick Meme, Futures, Forex, Prop Firm, or Polymarket and land in the right workflow.",
};

export default function EnterPage() {
  return <EnterDesksClient />;
}
