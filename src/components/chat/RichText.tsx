import * as React from "react";

import { cn } from "@/lib/utils";
import { parseChatMarkdown } from "@/lib/chatMarkdown";

/**
 * An assistant reply, rendered.
 *
 * Block structure comes from `lib/chatMarkdown`; this adds the inline pass
 * (`**bold**`, `*italic*`, `` `code` ``) and the styling. Every node below is
 * a React element built from plain strings — no `dangerouslySetInnerHTML`, so
 * markup in a reply is inert.
 */

const INLINE_RE = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|`[^`\n]+`)/g;

const renderInline = (text: string, keyPrefix: string): React.ReactNode[] =>
  text
    .split(INLINE_RE)
    .filter(Boolean)
    .map((chunk, i) => {
      const key = `${keyPrefix}-${i}`;
      if ((chunk.startsWith("**") && chunk.endsWith("**")) || (chunk.startsWith("__") && chunk.endsWith("__"))) {
        return (
          <strong key={key} className="font-semibold text-foreground">
            {chunk.slice(2, -2)}
          </strong>
        );
      }
      if (chunk.startsWith("*") && chunk.endsWith("*") && chunk.length > 2) {
        return <em key={key}>{chunk.slice(1, -1)}</em>;
      }
      if (chunk.startsWith("`") && chunk.endsWith("`") && chunk.length > 2) {
        return (
          <code key={key} className="rounded bg-muted px-1 py-0.5 text-caption1 font-medium">
            {chunk.slice(1, -1)}
          </code>
        );
      }
      return <React.Fragment key={key}>{chunk}</React.Fragment>;
    });

export const RichText: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
  const blocks = React.useMemo(() => parseChatMarkdown(text), [text]);

  return (
    <div className={cn("space-y-2", className)}>
      {blocks.map((block, i) => {
        if (block.kind === "heading") {
          return (
            <p
              key={i}
              className={cn(
                "font-semibold text-foreground",
                block.level === 1 ? "text-subhead" : "text-footnote",
                i > 0 && "pt-1",
              )}
            >
              {renderInline(block.text, `h${i}`)}
            </p>
          );
        }

        if (block.kind === "list") {
          return (
            <ul key={i} className="space-y-1.5">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-2">
                  <span
                    aria-hidden
                    className={cn(
                      "shrink-0 text-primary",
                      block.ordered ? "text-caption1 font-semibold tabular-nums" : "leading-[1.35]",
                    )}
                  >
                    {block.ordered ? `${j + 1}.` : "•"}
                  </span>
                  <span className="min-w-0">{renderInline(item, `l${i}-${j}`)}</span>
                </li>
              ))}
            </ul>
          );
        }

        return <p key={i}>{renderInline(block.text, `p${i}`)}</p>;
      })}
    </div>
  );
};

export default RichText;
