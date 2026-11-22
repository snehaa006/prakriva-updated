// src/lib/doctorChatAnswers.ts
// Answers the doctor's data questions straight from her patient records.
//
// "Summarise my patients", "who is high risk?", "how many patients do I
// have?" are lookups, not judgement: the chatbot already holds the roster,
// assessments, latest screenings and today's meal adherence it would send to
// the AI. Answering them here is instant, exact, free, and keeps working when
// every AI provider is busy or out of quota. Anything that needs judgement
// ("suggest a diet change for Asha") returns null and goes to the AI as before.
//
// These replies are labelled in the chat as coming from the records — they
// are not presented as AI-generated.

import type { DoctorChatContext } from "@/services/chatAssistantService";

type Patient = DoctorChatContext["patients"][number];

const COUNT_RE = /\bhow many (patients|people)\b/i;
const RISK_RE = /\b(high[- ]?risk|at[- ]risk|risky|flagged|screenings?|screened|risk levels?)\b/i;
const ADHERENCE_RE = /\b(adherence|adherent|complian(ce|t)|sticking to|following (the|their|her) (diet|plan)|meals? (eaten|logged|missed))\b/i;
const ALLERGY_RE = /\ballerg/i;
const ROSTER_RE =
  /\b(summar(y|ise|ize)|overview|roster|all (of )?my patients|list (all |of )?(my )?patients|my patients|patients? list)\b/i;
/** Phrasing that asks *about* a named patient, rather than for advice on her. */
const LOOKUP_RE = /\b(summar(y|ise|ize)|overview|tell me about|details?|profile|how is|status|who is)\b/i;

const LIFE_STAGE_LABELS: Record<string, string> = {
  pregnancy: "Pregnancy",
  postpartum: "Postpartum",
  menopause: "Menopause",
  pcos: "PCOD/PCOS",
  not_applicable: "General wellness",
};

const capitalise = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

const latestScreening = (p: Patient) =>
  [...(p.screenings ?? [])].sort((a, b) => b.date.localeCompare(a.date))[0];

function lifeStageOf(p: Patient): string | null {
  if (!p.lifeStage) return null;
  const label = LIFE_STAGE_LABELS[p.lifeStage] ?? capitalise(p.lifeStage.replace(/_/g, " "));
  return p.lifeStage === "pregnancy" && p.trimester ? `${label} (${p.trimester} trimester)` : label;
}

function screeningLine(p: Patient): string {
  const s = latestScreening(p);
  if (!s) return "no screening yet";
  const flagged = s.conditions.filter((c) => c.riskLevel !== "low");
  const flags = flagged.length
    ? ` — ${flagged.map((c) => `${c.label} (${c.riskLevel})`).join(", ")}`
    : "";
  return `latest screening ${formatDate(s.date)}: **${s.overallRisk}** risk${flags}`;
}

const adherenceLine = (p: Patient) =>
  p.adherence === undefined ? "no meals logged today" : `today's meal adherence **${p.adherence}%**`;

/** One patient on one line: who she is, then what needs attention. */
function patientLine(p: Patient): string {
  const who = [lifeStageOf(p), p.primaryDosha && `${capitalise(p.primaryDosha)} dosha`, p.dietaryPreference]
    .filter(Boolean)
    .join(" · ");
  const conditions = p.conditions?.length ? `conditions: ${p.conditions.join(", ")}` : null;
  const allergies = p.allergies?.length ? `allergies: ${p.allergies.join(", ")}` : null;
  const parts = [who, conditions, allergies, screeningLine(p), adherenceLine(p)].filter(Boolean);
  return `- **${p.name}** — ${parts.join(" · ")}`;
}

/** The roster note when only part of a larger list was loaded. */
const partialNote = (ctx: DoctorChatContext) =>
  ctx.doctor.patientCount > ctx.patients.length
    ? `\n\nShowing the ${ctx.patients.length} most recent of your ${ctx.doctor.patientCount} patients.`
    : "";

function rosterAnswer(ctx: DoctorChatContext): string {
  if (ctx.patients.length === 0) return noPatients(ctx);
  const high = ctx.patients.filter((p) => latestScreening(p)?.overallRisk === "high");
  const unscreened = ctx.patients.filter((p) => !latestScreening(p));
  const lowAdherence = ctx.patients.filter((p) => p.adherence !== undefined && p.adherence < 50);
  const glance = [
    high.length && `${high.length} high risk (${high.map((p) => p.name).join(", ")})`,
    lowAdherence.length && `${lowAdherence.length} below 50% meal adherence today`,
    unscreened.length && `${unscreened.length} not yet screened`,
  ].filter(Boolean);
  return [
    `## Your patients (${ctx.doctor.patientCount || ctx.patients.length})`,
    ctx.patients.map(patientLine).join("\n"),
    glance.length ? `**At a glance:** ${glance.join("; ")}.` : "**At a glance:** nothing flagged.",
  ].join("\n\n") + partialNote(ctx);
}

function riskAnswer(ctx: DoctorChatContext): string {
  if (ctx.patients.length === 0) return noPatients(ctx);
  const order = { high: 0, moderate: 1, low: 2 } as Record<string, number>;
  const screened = ctx.patients
    .filter((p) => latestScreening(p))
    .sort((a, b) => (order[latestScreening(a)!.overallRisk] ?? 3) - (order[latestScreening(b)!.overallRisk] ?? 3));
  const unscreened = ctx.patients.filter((p) => !latestScreening(p));
  const lines = screened.map((p) => `- **${p.name}** — ${screeningLine(p)}`);
  if (unscreened.length) lines.push(`- Not yet screened: ${unscreened.map((p) => p.name).join(", ")}`);
  return [`## Screening risk, highest first`, lines.join("\n")].join("\n\n") + partialNote(ctx);
}

function adherenceAnswer(ctx: DoctorChatContext): string {
  if (ctx.patients.length === 0) return noPatients(ctx);
  const logged = ctx.patients
    .filter((p) => p.adherence !== undefined)
    .sort((a, b) => (a.adherence ?? 0) - (b.adherence ?? 0));
  const notLogged = ctx.patients.filter((p) => p.adherence === undefined);
  const lines = logged.map((p) => `- **${p.name}** — ${adherenceLine(p)}`);
  if (notLogged.length) lines.push(`- No meals logged today: ${notLogged.map((p) => p.name).join(", ")}`);
  return [`## Today's meal adherence, lowest first`, lines.join("\n")].join("\n\n") + partialNote(ctx);
}

function allergyAnswer(ctx: DoctorChatContext): string {
  if (ctx.patients.length === 0) return noPatients(ctx);
  const withAllergies = ctx.patients.filter((p) => p.allergies?.length);
  const none = ctx.patients.filter((p) => !p.allergies?.length);
  const lines = withAllergies.map((p) => `- **${p.name}** — ${p.allergies!.join(", ")}`);
  if (none.length) lines.push(`- No allergies recorded: ${none.map((p) => p.name).join(", ")}`);
  return [`## Recorded allergies`, lines.join("\n")].join("\n\n") + partialNote(ctx);
}

const noPatients = (ctx: DoctorChatContext) =>
  ctx.doctor.patientCount > 0
    ? `You have ${ctx.doctor.patientCount} patient${ctx.doctor.patientCount === 1 ? "" : "s"}, but none of their records could be loaded just now.`
    : "You don't have any patients linked to your account yet. They appear here once a consultation request connects you.";

/** A patient named in the question, by full or first name (word match). */
function namedPatient(question: string, ctx: DoctorChatContext): Patient | undefined {
  const q = question.toLowerCase();
  const word = (w: string) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  return (
    ctx.patients.find((p) => p.name && word(p.name.toLowerCase()).test(q)) ??
    ctx.patients.find((p) => {
      const first = p.name?.split(/\s+/)[0]?.toLowerCase();
      return first && first.length >= 3 && word(first).test(q);
    })
  );
}

/** Whether `ctx` is the doctor's loaded context (a roster, possibly empty). */
export const hasRoster = (ctx: unknown): ctx is DoctorChatContext =>
  !!ctx && typeof ctx === "object" && Array.isArray((ctx as DoctorChatContext).patients);

/**
 * The answer to a data question, or null when the question needs the AI.
 * `ctx` must be the loaded doctor context; anything else returns null.
 */
export function answerFromRecords(question: string, ctx: unknown): string | null {
  if (!hasRoster(ctx)) return null;
  const context = ctx;
  const q = question.trim();
  if (!q) return null;

  const patient = namedPatient(q, context);
  if (patient) {
    return LOOKUP_RE.test(q) || RISK_RE.test(q) || ADHERENCE_RE.test(q) || ALLERGY_RE.test(q)
      ? `## ${patient.name}\n\n${patientLine(patient).replace(/^- \*\*[^*]+\*\* — /, "")}`
      : null; // asking for advice about her: that is the AI's job
  }
  if (COUNT_RE.test(q)) {
    const n = context.doctor.patientCount || context.patients.length;
    return n === 0
      ? noPatients(context)
      : `You have **${n}** patient${n === 1 ? "" : "s"}: ${context.patients.map((p) => p.name).join(", ")}.${partialNote(context)}`;
  }
  // A summary that mentions risk or adherence still wants the whole roster,
  // which covers both — so the roster is checked before the narrower lists.
  if (ROSTER_RE.test(q)) return rosterAnswer(context);
  if (RISK_RE.test(q)) return riskAnswer(context);
  if (ADHERENCE_RE.test(q)) return adherenceAnswer(context);
  if (ALLERGY_RE.test(q)) return allergyAnswer(context);
  return null;
}
