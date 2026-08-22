// The landing page's contact form.
//
// Messages go to `contact_messages` (see supabase/contact_messages.sql), which
// is insert-only for anonymous visitors and readable by nobody through the
// public API — a contact table that the anon key can SELECT is a mailing list
// anyone can download.
//
// The table may not be provisioned. Every other write path in this app already
// tolerates that (`weightLogService`, `cycleLogService`, …) and this one has to
// as well, because a landing page that swallows a message and says "thanks" is
// worse than one with no form at all. When the table is missing — or the
// insert fails for any other reason — the caller gets `status: "unavailable"`
// and a prefilled `mailto:` so the visitor still has a way to reach a person.

import { supabase } from "@/lib/supabase";

/** Where a message goes when the database cannot take it. */
export const CONTACT_EMAIL = "hello@prakriva.app";

/** Postgres/PostgREST codes meaning "the table isn't there (yet)". */
const MISSING_TABLE_CODES = ["42P01", "PGRST205", "PGRST106"];

const isMissingTable = (error: { code?: string } | null) =>
  !!error && MISSING_TABLE_CODES.includes(error.code ?? "");

/** Who is writing in. Shapes the routing on the other end. */
export type ContactRole = "patient" | "practitioner" | "other";

export interface ContactMessage {
  name: string;
  email: string;
  role: ContactRole;
  message: string;
}

export type ContactResult =
  | { status: "sent" }
  /** Stored nowhere — hand the visitor the mailto fallback in `mailtoHref`. */
  | { status: "unavailable"; reason: string; mailtoHref: string }
  /** The form itself is wrong; `errors` is keyed by field. */
  | { status: "invalid"; errors: Partial<Record<keyof ContactMessage, string>> };

/**
 * Deliberately loose: the only thing worth rejecting here is an address with
 * no `@` or no dot after it. Anything stricter starts refusing real addresses
 * (long TLDs, plus-addressing, unicode domains) on a form whose whole job is
 * to let someone reach a human.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MESSAGE_MIN_LENGTH = 10;
export const MESSAGE_MAX_LENGTH = 2000;

export const validateContact = (
  input: ContactMessage,
): Partial<Record<keyof ContactMessage, string>> => {
  const errors: Partial<Record<keyof ContactMessage, string>> = {};

  if (!input.name.trim()) errors.name = "Tell us who you are.";
  else if (input.name.trim().length > 120) errors.name = "That name is too long.";

  if (!input.email.trim()) errors.email = "We need somewhere to reply.";
  else if (!EMAIL_PATTERN.test(input.email.trim()))
    errors.email = "That does not look like an email address.";

  const message = input.message.trim();
  if (message.length < MESSAGE_MIN_LENGTH)
    errors.message = `A little more detail helps — at least ${MESSAGE_MIN_LENGTH} characters.`;
  else if (message.length > MESSAGE_MAX_LENGTH)
    errors.message = `Please keep it under ${MESSAGE_MAX_LENGTH} characters.`;

  return errors;
};

/** A prefilled mail draft, so a failed submit is still a way through. */
export const buildMailtoHref = (input: ContactMessage): string => {
  const subject = `Prakriva enquiry — ${input.name.trim() || "website"}`;
  const body = [
    `Name: ${input.name.trim()}`,
    `Email: ${input.email.trim()}`,
    `I am a: ${input.role}`,
    "",
    input.message.trim(),
  ].join("\n");

  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

/**
 * Send a contact message.
 *
 * Never throws: a network failure on a marketing form should degrade to the
 * mailto fallback, not to a blank page behind an unhandled rejection.
 */
export const sendContactMessage = async (input: ContactMessage): Promise<ContactResult> => {
  const errors = validateContact(input);
  if (Object.keys(errors).length > 0) return { status: "invalid", errors };

  const payload = {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    role: input.role,
    message: input.message.trim(),
  };

  try {
    const { error } = await supabase.from("contact_messages").insert(payload);

    if (!error) return { status: "sent" };

    return {
      status: "unavailable",
      reason: isMissingTable(error)
        ? "The contact inbox is not set up on this deployment yet."
        : error.message,
      mailtoHref: buildMailtoHref(input),
    };
  } catch (cause) {
    return {
      status: "unavailable",
      reason: cause instanceof Error ? cause.message : "The message could not be sent.",
      mailtoHref: buildMailtoHref(input),
    };
  }
};
