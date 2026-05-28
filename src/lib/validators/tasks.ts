import { z } from "zod";
import { WorkTaskPriority, WorkTaskStatus } from "@/generated/prisma";

export const createWorkTaskInputSchema = z.object({
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
});

export const updateWorkTaskStatusInputSchema = z.object({
  taskId: z.string().trim().min(1),
  status: z.nativeEnum(WorkTaskStatus),
});

export const updateWorkTaskInputSchema = createWorkTaskInputSchema.extend({
  taskId: z.string().trim().min(1),
  status: z.nativeEnum(WorkTaskStatus).optional(),
});

export const createTaskSpaceInputSchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(60, "Name is too long."),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Pick a valid color.")
    .optional(),
});
