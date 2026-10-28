import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { Todo } from "@/components/content/Prose";
import { SITE } from "@/data/site";

export const metadata: Metadata = { title: "Resume" };

export default function ResumePage() {
  const has = existsSync(join(process.cwd(), "public", SITE.resumeSrc.replace(/^\//, "")));
  return (
    <main className="mx-auto flex max-w-[1080px] flex-col px-4 py-8 sm:px-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Resume</p>
          <h1 className="mt-1 font-serif text-3xl tracking-tight text-ink">{SITE.authorName}</h1>
        </div>
        {has && (
          <a href={SITE.resumeSrc} download className="inline-flex h-9 items-center gap-2 rounded-md bg-ink px-3.5 text-sm font-medium text-ink-inverse hover:bg-ink/85">
            Download PDF
          </a>
        )}
      </div>
      {has ? (
        <object data={`${SITE.resumeSrc}#view=FitH`} type="application/pdf" aria-label="Resume (PDF)" className="h-[calc(100dvh-12rem)] min-h-[600px] w-full rounded-lg border border-rule bg-surface">
          <p className="p-6 text-ink-2">
            Your browser can&apos;t show PDFs inline. <a className="underline" href={SITE.resumeSrc}>Download the resume</a> instead.
          </p>
        </object>
      ) : (
        <Todo>
          Add your resume as <code>public/resume.pdf</code> (or change <code>SITE.resumeSrc</code> in <code>src/data/site.ts</code>) and rebuild. The viewer and download button appear automatically.
        </Todo>
      )}
    </main>
  );
}
