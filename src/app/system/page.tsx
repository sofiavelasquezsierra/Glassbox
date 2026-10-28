import type { Metadata } from "next";
import { SystemShowcase } from "./SystemShowcase";

export const metadata: Metadata = {
  title: "Design system",
  description: "Tokens and components behind Glassbox, with live examples, variants and states.",
};

export default function SystemPage() {
  return <SystemShowcase />;
}
