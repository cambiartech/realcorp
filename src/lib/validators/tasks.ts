import { z } from "zod";
import { WorkTaskPriority, WorkTaskStatus } from "@/generated/prisma";

const recurrenceFrequencySchema = z.enum(["DAILY", "WEEKLY", "MONTHLY"]);
const recurrenceEndModeSchema = z.enum(["NEVER", "UNTIL_DATE", "AFTER_COUNT"]);

const workTaskFieldsSchema = z.object({
  title: z.string().trim().min(2, "Title is required.").max(200, "Title is too long."),
  description: z
    .string()
    .trim()
    .max(8000, "Description is too long.")
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  status: z.nativeEnum(WorkTaskStatus).optional(),
  priority: z.nativeEnum(WorkTaskPriority).optional(),
  spaceId: z.string().trim().optional(),
  projectId: z.string().trim().optional(),
  assigneeUserId: z.string().trim().optional(),
  dueDate: z.string().trim().optional(),
  sprintLabel: z
    .string()
    .trim()
    .max(40, "Sprint label is too long.")
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  recurrenceFrequency: recurrenceFrequencySchema.optional().nullable(),
  recurrenceEndMode: recurrenceEndModeSchema.optional(),
  recurrenceEndsAt: z.string().trim().optional(),
  recurrenceMaxOccurrences: z.coerce.number().int().min(1).max(999).optional().nullable(),
});

function refineRecurrence(
  data: z.infer<typeof workTaskFieldsSchema>,
  ctx: z.RefinementCtx,
) {
  const frequency = data.recurrenceFrequency ?? null;
  if (!frequency) return;
  if (!data.dueDate?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Set a due date when the task repeats.",
      path: ["dueDate"],
    });
  }
  const endMode = data.recurrenceEndMode ?? "NEVER";
  if (endMode === "UNTIL_DATE" && !data.recurrenceEndsAt?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Pick an end date for the series.",
      path: ["recurrenceEndsAt"],
    });
  }
  if (endMode === "AFTER_COUNT" && (data.recurrenceMaxOccurrences == null || data.recurrenceMaxOccurrences < 1)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter how many times the task should repeat.",
      path: ["recurrenceMaxOccurrences"],
    });
  }
}

export const createWorkTaskInputSchema = workTaskFieldsSchema.superRefine(refineRecurrence);

export const updateWorkTaskStatusInputSchema = z.object({
  taskId: z.string().trim().min(1),
  status: z.nativeEnum(WorkTaskStatus),
});

export const updateWorkTaskInputSchema = workTaskFieldsSchema
  .extend({
    taskId: z.string().trim().min(1),
    status: z.nativeEnum(WorkTaskStatus).optional(),
  })
  .superRefine(refineRecurrence);

export const deleteWorkTaskInputSchema = z.object({
  taskId: z.string().trim().min(1),
  scope: z.enum(["THIS", "SERIES"]).optional().default("THIS"),
});

export const stopWorkTaskRecurrenceInputSchema = z.object({
  taskId: z.string().trim().min(1),
});

export const createTaskSpaceInputSchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(60, "Name is too long."),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Pick a valid color.")
    .optional(),
});
