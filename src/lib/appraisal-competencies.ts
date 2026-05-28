import type { HrAppraisalCycleType } from "@/generated/prisma";

export type DefaultAppraisalCriterion = {
  title: string;
  description: string;
  sortOrder: number;
  cycleType: HrAppraisalCycleType;
  section?: "core" | "competency" | "summary";
};

const MONTHLY_CRITERIA: Omit<DefaultAppraisalCriterion, "cycleType">[] = [
  {
    title: "Job-specific knowledge",
    description:
      "Expertise and background needed for your role. How effectively do you apply what you know to complete work on time and to standard?",
    sortOrder: 10,
    section: "core",
  },
  {
    title: "Job-specific skills",
    description:
      "Technical and role skills required for your responsibilities. How consistently do you meet expectations for quality and results?",
    sortOrder: 20,
    section: "core",
  },
  {
    title: "Adaptability",
    description:
      "Flexibility with new ideas, changing plans, goals, or priorities. How well do you adjust when circumstances shift?",
    sortOrder: 30,
    section: "competency",
  },
  {
    title: "Collaboration",
    description:
      "Building positive working relationships, learning from others, and awareness of how your behaviour affects the team.",
    sortOrder: 40,
    section: "competency",
  },
  {
    title: "Communication",
    description:
      "Clear, respectful expression of ideas and effective listening with colleagues, managers, and stakeholders.",
    sortOrder: 50,
    section: "competency",
  },
  {
    title: "Leadership qualities",
    description:
      "Self-motivation, building trust, inspiring others toward shared goals, and acknowledging others' contributions.",
    sortOrder: 60,
    section: "competency",
  },
  {
    title: "Integrity",
    description: "Ethical decision-making, honesty, and accountability in day-to-day work.",
    sortOrder: 70,
    section: "competency",
  },
  {
    title: "Inclusivity",
    description: "Promoting an inclusive environment and respect for diverse viewpoints and backgrounds.",
    sortOrder: 80,
    section: "competency",
  },
  {
    title: "Responsiveness",
    description: "Accessibility, timely follow-up, and a diplomatic, welcoming approach to requests.",
    sortOrder: 90,
    section: "competency",
  },
  {
    title: "Results",
    description:
      "Setting goals aligned with team direction and persisting through difficulties to deliver outcomes.",
    sortOrder: 100,
    section: "competency",
  },
  {
    title: "Initiative",
    description:
      "Anticipating needs, solving problems without being asked, and stepping up for new challenges.",
    sortOrder: 110,
    section: "competency",
  },
  {
    title: "Development",
    description:
      "Commitment to improving knowledge and skills, and concrete steps identified for future growth.",
    sortOrder: 120,
    section: "competency",
  },
  {
    title: "Accomplishments",
    description: "Major accomplishments during this review period, with examples and supporting outcomes.",
    sortOrder: 130,
    section: "summary",
  },
  {
    title: "Areas for growth",
    description: "Where you will focus improvement and professional development in the next period.",
    sortOrder: 140,
    section: "summary",
  },
];

/** Standard self-assessment areas aligned with common HR templates. */
export const DEFAULT_APPRAISAL_CRITERIA: DefaultAppraisalCriterion[] = [
  ...MONTHLY_CRITERIA.map((c) => ({ ...c, cycleType: "MONTHLY" as const })),
  ...MONTHLY_CRITERIA.map((c) => ({ ...c, cycleType: "YEARLY" as const })),
];

/** 0 = not demonstrated / N/A, 5 = outstanding */
export const APPRAISAL_RATING_OPTIONS: { value: number; label: string; short: string }[] = [
  { value: 0, label: "0 — Not demonstrated / N/A", short: "N/A" },
  { value: 1, label: "1 — Needs significant improvement", short: "Needs improvement" },
  { value: 2, label: "2 — Below expectations", short: "Below expectations" },
  { value: 3, label: "3 — Meets expectations", short: "Meets expectations" },
  { value: 4, label: "4 — Exceeds expectations", short: "Exceeds expectations" },
  { value: 5, label: "5 — Outstanding", short: "Outstanding" },
];

export function appraisalRatingLabel(value: number | null | undefined): string {
  if (value == null) return "—";
  const match = APPRAISAL_RATING_OPTIONS.find((o) => o.value === value);
  return match ? `${value} — ${match.short}` : `${value}/5`;
}

export const APPRAISAL_SECTION_LABELS: Record<string, string> = {
  core: "Self-assessment areas",
  competency: "Competencies",
  summary: "Summary & future goals",
};
