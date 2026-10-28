import Link from "next/link";
import { EmptyState } from "@/components/system/EmptyState";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-20">
      <h1 className="sr-only">Page not found</h1>
      <EmptyState title="There's nothing at this address" action={<Link href="/" className="text-sm text-ink underline underline-offset-2">Back to the demo</Link>}>
        The page may have moved. Every number in the demo still links to its SQL, though.
      </EmptyState>
    </main>
  );
}
