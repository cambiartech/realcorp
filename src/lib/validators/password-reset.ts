import { z } from "zod";

export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, "Email is required.").email("Enter a valid email address."),
});

export type ForgotPasswordFieldName = keyof z.infer<typeof forgotPasswordSchema>;

export function parseForgotPasswordForm(formData: FormData) {
  return forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });
}

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(16, "This reset link is invalid."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(1, "Please confirm your new password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export type ResetPasswordFieldName = "password" | "confirmPassword";

export function parseResetPasswordForm(formData: FormData) {
  return resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
}

export function zodForgotIssuesToFieldRecord(
  issues: z.ZodIssue[],
): Partial<Record<ForgotPasswordFieldName, string>> {
  const out: Partial<Record<ForgotPasswordFieldName, string>> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (key === "email" && !out.email) out.email = issue.message;
  }
  return out;
}

export function zodResetIssuesToFieldRecord(
  issues: z.ZodIssue[],
): Partial<Record<ResetPasswordFieldName, string>> {
  const out: Partial<Record<ResetPasswordFieldName, string>> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if ((key === "password" || key === "confirmPassword") && !out[key]) {
      out[key] = issue.message;
    }
  }
  return out;
}
