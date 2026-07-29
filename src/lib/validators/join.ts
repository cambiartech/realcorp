import { z } from "zod";

export const joinInviteSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(2, "First name must be at least 2 characters.")
      .max(40, "First name is too long."),
    lastName: z
      .string()
      .trim()
      .min(2, "Last name must be at least 2 characters.")
      .max(40, "Last name is too long."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export type JoinFieldName = keyof z.infer<typeof joinInviteSchema>;

export function parseJoinForm(formData: FormData) {
  return joinInviteSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
}

export function zodJoinIssuesToFieldRecord(issues: z.ZodIssue[]): Partial<Record<JoinFieldName, string>> {
  const out: Partial<Record<JoinFieldName, string>> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (
      (key === "firstName" || key === "lastName" || key === "password" || key === "confirmPassword") &&
      !out[key]
    ) {
      out[key] = issue.message;
    }
  }
  return out;
}
