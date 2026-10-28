import type { Metadata } from "next";
import { DictionaryView } from "@/components/demo/DictionaryView";

export const metadata: Metadata = {
  title: "Data Dictionary",
  description: "Review the agent's proposed descriptions for every table and column; accepted entries become part of its context.",
};

export default function DictionaryPage() {
  return <DictionaryView />;
}
