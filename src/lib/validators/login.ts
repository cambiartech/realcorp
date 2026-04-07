import { z } from "zod";

export const loginCredentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export type LoginFieldName = keyof z.infer<typeof loginCredentialsSchema>;

export function parseLoginForm(formData: FormData) {
  return loginCredentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
}

export function zodIssuesToFieldRecord(
  issues: z.ZodIssue[],
): Partial<Record<LoginFieldName, string>> {
  const out: Partial<Record<LoginFieldName, string>> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (key === "email" || key === "password") {
      if (!out[key]) out[key] = issue.message;
    }
  }
  return out;
}
