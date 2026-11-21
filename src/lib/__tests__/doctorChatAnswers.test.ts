import { describe, expect, it } from "vitest";
import { answerFromRecords } from "@/lib/doctorChatAnswers";
import type { DoctorChatContext } from "@/services/chatAssistantService";

const CTX: DoctorChatContext = {
  doctor: { patientCount: 3 },
  patients: [
    {
      name: "Asha Verma",
      lifeStage: "pregnancy",
      trimester: "second",
      primaryDosha: "pitta",
      dietaryPreference: "vegetarian",
      allergies: ["peanuts"],
      conditions: ["Anaemia"],
      adherence: 40,
      screenings: [
        {
          date: "2026-11-12T10:00:00Z",
          overallRisk: "high",
          conditions: [
            { label: "Anaemia", riskLevel: "high" },
            { label: "Gestational Diabetes", riskLevel: "moderate" },
            { label: "Thyroid Disorder", riskLevel: "low" },
          ],
        },
      ],
    },
    { name: "Meera Iyer", lifeStage: "pcos", primaryDosha: "kapha", adherence: 100 },
    { name: "Ritu Sharma", lifeStage: "menopause" },
  ],
};

describe("answerFromRecords", () => {
  it("summarises the whole roster for the chatbot's own summary chip", () => {
    const answer = answerFromRecords(
      "Give me a summary of all my patients, their conditions and adherence",
      CTX
    )!;
    expect(answer).toContain("## Your patients (3)");
    expect(answer).toContain(
      "- **Asha Verma** — Pregnancy (second trimester) · Pitta dosha · vegetarian · conditions: Anaemia · allergies: peanuts"
    );
    expect(answer).toContain("**high** risk — Anaemia (high), Gestational Diabetes (moderate)");
    expect(answer).not.toContain("Thyroid Disorder"); // low risk is not a flag
    expect(answer).toContain("today's meal adherence **40%**");
    expect(answer).toContain("- **Ritu Sharma** — Menopause · no screening yet · no meals logged today");
    expect(answer).toContain(
      "**At a glance:** 1 high risk (Asha Verma); 1 below 50% meal adherence today; 2 not yet screened."
    );
  });

  it("counts patients", () => {
    expect(answerFromRecords("How many patients do I have?", CTX)).toBe(
      "You have **3** patients: Asha Verma, Meera Iyer, Ritu Sharma."
    );
  });

  it("lists screening risk highest first, then the unscreened", () => {
    const answer = answerFromRecords("Who is high risk?", CTX)!;
    expect(answer.indexOf("Asha Verma")).toBeLessThan(answer.indexOf("Not yet screened"));
    expect(answer).toContain("- Not yet screened: Meera Iyer, Ritu Sharma");
  });

  it("lists adherence lowest first", () => {
    const answer = answerFromRecords("Show me meal adherence", CTX)!;
    expect(answer.indexOf("Asha Verma")).toBeLessThan(answer.indexOf("Meera Iyer"));
    expect(answer).toContain("- No meals logged today: Ritu Sharma");
  });

  it("lists allergies", () => {
    expect(answerFromRecords("Any allergies I should know about?", CTX)).toContain(
      "- **Asha Verma** — peanuts"
    );
  });

  it("looks up one named patient, by first name too", () => {
    const answer = answerFromRecords("Tell me about Asha", CTX)!;
    expect(answer.startsWith("## Asha Verma\n\nPregnancy (second trimester)")).toBe(true);
  });

  it("leaves questions that need judgement to the AI", () => {
    expect(answerFromRecords("Suggest a diet modification for Asha", CTX)).toBeNull();
    expect(answerFromRecords("What are Ayurvedic principles for PCOS?", CTX)).toBeNull();
  });

  it("does nothing until the doctor's records have loaded", () => {
    expect(answerFromRecords("Summarise my patients", null)).toBeNull();
    expect(answerFromRecords("Summarise my patients", { profile: {} })).toBeNull();
  });

  it("says so plainly when there are no patients", () => {
    expect(
      answerFromRecords("Summarise my patients", { doctor: { patientCount: 0 }, patients: [] })
    ).toMatch(/don't have any patients linked/);
  });

  it("notes when only part of a larger roster was loaded", () => {
    expect(
      answerFromRecords("list my patients", { ...CTX, doctor: { patientCount: 12 } })
    ).toContain("Showing the 3 most recent of your 12 patients.");
  });
});
