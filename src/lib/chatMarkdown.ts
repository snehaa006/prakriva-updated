// src/lib/chatMarkdown.ts
// The little bit of Markdown the chat assistant actually writes.
//
// Gemini answers in Markdown whether or not it is asked to, so the chat — which
// used to render replies as pre-wrapped plain text — showed literal
// `**asterisks**` and `*` bullets to the patient. This splits a reply into the
// block structure that actually turns up (headings, bullet and numbered lists,
// paragraphs); `components/chat/RichText` renders it, and handles the inline
// bold/italic/code inside each block.
//
// Deliberately not a Markdown library: no new dependency, and nothing here
// produces HTML, so a reply containing markup can never reach the DOM as
// anything but text.

export type ChatBlock =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] };

const HEADING_RE = /^(#{1,3})\s+(.*)$/;
const BULLET_RE = /^\s*[-*•]\s+(.*)$/;
const NUMBERED_RE = /^\s*\d+[.)]\s+(.*)$/;

export const parseChatMarkdown = (text: string): ChatBlock[] => {
  const blocks: ChatBlock[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push({ kind: "list", ...list });
      list = null;
    }
  };

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();

    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(HEADING_RE);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "heading", level: heading[1].length as 1 | 2 | 3, text: heading[2] });
      continue;
    }

    const bullet = line.match(BULLET_RE);
    const numbered = bullet ? null : line.match(NUMBERED_RE);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      // A bullet list interrupted by a numbered one starts a new list rather
      // than mixing markers inside a single <ul>.
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }

    flushList();
    // Soft-wrapped lines inside one paragraph are joined: the model wraps its
    // prose, and honouring those line breaks makes narrow bubbles ragged.
    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  return blocks;
};
