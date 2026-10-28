"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./Button";
import { CheckIcon, CloseIcon, PencilIcon, UndoIcon } from "./icons";

export type DictionaryStatus = "proposed" | "accepted" | "rejected";

export interface DictionaryRowData {
  table: string;
  column: string | null;
  type?: string;
  description: string;
  status: DictionaryStatus;
  source: "agent" | "starter" | "you";
}

/**
 * One table or column in the Data Dictionary. The agent proposes a
 * description; the user accepts, edits or rejects it. Only accepted entries
 * are fed back into the agent's context.
 */
export function DictionaryRow({
  row,
  onAccept,
  onReject,
  onSave,
  onRestore,
}: {
  row: DictionaryRowData;
  onAccept?: () => void;
  onReject?: () => void;
  onSave?: (description: string) => void;
  onRestore?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row.description);
  const name = row.column ?? row.table;
  const tooLong = draft.length > 300;

  return (
    <div className={cn("grid grid-cols-1 gap-x-6 gap-y-2 border-b border-rule px-4 py-3 last:border-b-0 sm:grid-cols-[13rem_1fr_auto]", row.status === "rejected" && "bg-sunk/40")}>
      <div className="min-w-0">
        <p className={cn("truncate font-mono text-sm", row.column ? "text-ink" : "font-medium text-ink")}>{row.column ? name : `${name} (table)`}</p>
        {row.type && <p className="font-mono text-2xs text-ink-3">{row.type}</p>}
      </div>

      <div className="min-w-0">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.trim() || tooLong) return;
              onSave?.(draft.trim());
              setEditing(false);
            }}
          >
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  setEditing(false);
                  setDraft(row.description);
                }
              }}
              rows={2}
              aria-label={`Description for ${name}`}
              className="w-full resize-y rounded-sm border border-rule-strong bg-surface px-2 py-1.5 text-sm outline-none focus:border-focus"
            />
            <div className="mt-1.5 flex items-center gap-1.5">
              <Button type="submit" size="sm" variant="primary" disabled={!draft.trim() || tooLong}>
                Save and accept
              </Button>
              <Button size="sm" variant="ghost" onClick={() => (setEditing(false), setDraft(row.description))}>
                Cancel
              </Button>
              <span className={cn("ml-auto font-mono text-2xs", tooLong ? "text-block" : "text-ink-3")}>{draft.length}/300</span>
            </div>
          </form>
        ) : (
          <p className={cn("text-sm", row.status === "rejected" ? "text-ink-3 line-through" : "text-ink-2")}>
            {row.description}
            <span className="ml-2 font-mono text-2xs text-ink-3 no-underline">{row.source === "agent" ? "proposed by agent" : row.source === "you" ? "edited by you" : "starter entry"}</span>
          </p>
        )}
      </div>

      {!editing && (
        <div className="flex items-start gap-1 sm:justify-end">
          {row.status === "proposed" && (
            <>
              <Button size="sm" onClick={onAccept} aria-label={`Accept description for ${name}`}>
                <CheckIcon size={14} /> Accept
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)} aria-label={`Edit description for ${name}`}>
                <PencilIcon size={14} />
              </Button>
              <Button size="sm" variant="ghost" onClick={onReject} aria-label={`Reject description for ${name}`}>
                <CloseIcon size={14} />
              </Button>
            </>
          )}
          {row.status === "accepted" && (
            <>
              <span className="inline-flex h-7 items-center gap-1 px-1.5 text-xs text-pass">
                <CheckIcon size={14} /> In agent context
              </span>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)} aria-label={`Edit description for ${name}`}>
                <PencilIcon size={14} />
              </Button>
              <Button size="sm" variant="ghost" onClick={onReject} aria-label={`Remove ${name} from agent context`}>
                <CloseIcon size={14} />
              </Button>
            </>
          )}
          {row.status === "rejected" && (
            <Button size="sm" variant="ghost" onClick={onRestore}>
              <UndoIcon size={14} /> Restore
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
