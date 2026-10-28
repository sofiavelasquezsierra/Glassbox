import { SITE } from "@/data/site";
import { PlayIcon } from "../system/icons";

/** The 90-second walkthrough. Hidden in production until the file is added. */
export function WalkthroughVideo() {
  if (SITE.walkthroughSrc) {
    return (
      <figure className="overflow-hidden rounded-lg border border-rule bg-surface shadow-1">
        <video src={SITE.walkthroughSrc} poster={SITE.walkthroughPoster ?? undefined} controls preload="metadata" playsInline className="aspect-video w-full bg-sunk">
          <track kind="captions" />
        </video>
        <figcaption className="px-3 py-2 text-xs text-ink-3">90-second walkthrough</figcaption>
      </figure>
    );
  }
  if (process.env.NODE_ENV === "production") return null;
  return (
    <div className="grid aspect-video place-items-center rounded-lg border border-dashed border-accent bg-accent-wash-2 text-center">
      <div>
        <PlayIcon className="mx-auto text-accent-ink" />
        <p className="mt-1 font-mono text-2xs text-accent-ink">TODO(you): walkthrough video</p>
        <p className="text-2xs text-ink-3">set SITE.walkthroughSrc in src/data/site.ts</p>
      </div>
    </div>
  );
}
