"use client";
import { useState } from "react";
import { Button } from "./Button";
import { CheckIcon, CopyIcon } from "./icons";

export function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 1600);
  };
  return (
    <Button size="sm" variant="ghost" onClick={copy} className={className} aria-live="polite">
      {state === "copied" ? <CheckIcon size={14} className="text-pass" /> : <CopyIcon size={14} />}
      {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : label}
    </Button>
  );
}
