import * as React from "react";
import { Loader2, Mail, MessageSquareHeart, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  CONTACT_EMAIL,
  MESSAGE_MAX_LENGTH,
  sendContactMessage,
  type ContactMessage,
  type ContactRole,
} from "@/services/contactService";

import ScrollReveal from "./ScrollReveal";

/**
 * The contact form.
 *
 * A real form, not a `mailto:` link dressed as one — but it degrades to a
 * prefilled mail draft the moment the database cannot take the message, which
 * is the case on any deployment that has not applied
 * `supabase/contact_messages.sql`. The alternative, a form that reports
 * success into a void, is the failure mode worth designing against.
 *
 * Validation lives in the service alongside the write, so the same rules apply
 * whether the caller is this form or anything added later, and the field-level
 * errors it returns are rendered inline and announced via `aria-describedby`.
 */

const ROLES: Array<{ value: ContactRole; label: string }> = [
  { value: "patient", label: "A patient" },
  { value: "practitioner", label: "A practitioner" },
  { value: "other", label: "Something else" },
];

const emptyForm = (): ContactMessage => ({
  name: "",
  email: "",
  role: "patient",
  message: "",
});

export function ContactSection() {
  const [form, setForm] = React.useState<ContactMessage>(emptyForm);
  const [errors, setErrors] = React.useState<Partial<Record<keyof ContactMessage, string>>>({});
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  const update = (field: keyof ContactMessage, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear a field's error as soon as it is touched — leaving it under a
    // field the visitor is actively fixing reads as the form arguing back.
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending) return;

    setSending(true);
    const result = await sendContactMessage(form);
    setSending(false);

    if (result.status === "invalid") {
      setErrors(result.errors);
      return;
    }

    if (result.status === "unavailable") {
      // Say what went wrong and hand over a route that works, rather than a
      // bare "something went wrong".
      toast.error("We could not send that from here", {
        description: `${result.reason} Open a prefilled email instead?`,
        action: {
          label: "Email us",
          onClick: () => {
            window.location.href = result.mailtoHref;
          },
        },
        duration: 10000,
      });
      return;
    }

    setSent(true);
    setForm(emptyForm());
    toast.success("Message sent", { description: "We reply to everything, usually within two working days." });
  };

  return (
    <section id="contact" className="relative scroll-mt-20 py-24 sm:py-28">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(65% 55% at 50% 0%, hsl(var(--lp-blush) / 0.85) 0%, transparent 70%)",
        }}
      />

      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <ScrollReveal>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-lp-mauve">
              Contact
            </p>
            <h2 className="mt-4 font-display text-4xl font-light leading-tight text-lp-plum sm:text-5xl">
              Talk to us
            </h2>
            <p className="mt-4 leading-relaxed text-lp-plum/65">
              Bringing a practice onto Prakriva, asking whether it fits your diagnosis, or
              telling us something is wrong — all of it lands in the same inbox.
            </p>

            <ul className="mt-8 space-y-4 text-sm">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-lp-blush text-lp-plum">
                  <Mail className="h-4 w-4" />
                </span>
                <span>
                  <span className="block font-medium text-lp-plum">Email</span>
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="text-lp-plum/60 underline underline-offset-4 transition-colors hover:text-lp-mauve"
                  >
                    {CONTACT_EMAIL}
                  </a>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-lp-blush text-lp-plum">
                  <MessageSquareHeart className="h-4 w-4" />
                </span>
                <span>
                  <span className="block font-medium text-lp-plum">Already a patient?</span>
                  <span className="text-lp-plum/60">
                    Message your practitioner in-app — it reaches her faster than we can.
                  </span>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-lp-blush text-lp-plum">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <span>
                  <span className="block font-medium text-lp-plum">Please don't send records</span>
                  <span className="text-lp-plum/60">
                    This form is not a clinical channel. Keep health details for your
                    practitioner inside the app.
                  </span>
                </span>
              </li>
            </ul>
          </ScrollReveal>

          <ScrollReveal index={1}>
            <form onSubmit={handleSubmit} noValidate className="lp-card rounded-[28px] p-7 sm:p-9">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contact-name" className="text-lp-plum">
                    Your name
                  </Label>
                  <Input
                    id="contact-name"
                    value={form.name}
                    onChange={(event) => update("name", event.target.value)}
                    aria-invalid={!!errors.name}
                    aria-describedby={errors.name ? "contact-name-error" : undefined}
                    className="bg-lp-cream-hi/80"
                    placeholder="Ananya Sharma"
                    autoComplete="name"
                  />
                  {errors.name && (
                    <p id="contact-name-error" className="text-xs text-destructive">
                      {errors.name}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-email" className="text-lp-plum">
                    Email
                  </Label>
                  <Input
                    id="contact-email"
                    type="email"
                    value={form.email}
                    onChange={(event) => update("email", event.target.value)}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "contact-email-error" : undefined}
                    className="bg-lp-cream-hi/80"
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                  {errors.email && (
                    <p id="contact-email-error" className="text-xs text-destructive">
                      {errors.email}
                    </p>
                  )}
                </div>
              </div>

              <fieldset className="mt-5">
                <legend className="mb-2 text-sm font-medium text-lp-plum">I am</legend>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map((role) => (
                    <label
                      key={role.value}
                      className={cn(
                        "cursor-pointer rounded-full border px-4 py-2 text-sm transition-colors duration-200 ease-ios",
                        form.role === role.value
                          ? "border-lp-plum bg-lp-plum text-lp-cream-hi"
                          : "border-lp-cream-lo/70 bg-lp-cream-hi/70 text-lp-plum/70 hover:border-lp-plum/30",
                      )}
                    >
                      <input
                        type="radio"
                        name="contact-role"
                        value={role.value}
                        checked={form.role === role.value}
                        onChange={() => update("role", role.value)}
                        className="sr-only"
                      />
                      {role.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="mt-5 space-y-2">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="contact-message" className="text-lp-plum">
                    Message
                  </Label>
                  <span className="text-xs tabular-nums text-lp-plum/40">
                    {form.message.length}/{MESSAGE_MAX_LENGTH}
                  </span>
                </div>
                <Textarea
                  id="contact-message"
                  rows={5}
                  maxLength={MESSAGE_MAX_LENGTH}
                  value={form.message}
                  onChange={(event) => update("message", event.target.value)}
                  aria-invalid={!!errors.message}
                  aria-describedby={errors.message ? "contact-message-error" : undefined}
                  className="resize-y bg-lp-cream-hi/80"
                  placeholder="What would you like to know?"
                />
                {errors.message && (
                  <p id="contact-message-error" className="text-xs text-destructive">
                    {errors.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                size="lg"
                disabled={sending}
                className="mt-7 h-12 w-full gap-2 rounded-full bg-lp-plum text-base text-lp-cream-hi hover:bg-lp-plum/90"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send message
                  </>
                )}
              </Button>

              {/* A live region rather than a toast alone: the toast is
                  transient and a screen reader user who missed it has no way
                  back to it. */}
              <p aria-live="polite" className="mt-3 min-h-[1.25rem] text-center text-xs text-lp-plum/55">
                {sent ? "Thank you — we have your message and will reply by email." : ""}
              </p>
            </form>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}

export default ContactSection;
