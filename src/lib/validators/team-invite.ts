import { MembershipRole } from "@/generated/prisma";
import { z } from "zod";

const validRoles = Object.values(MembershipRole);

export const teamInviteSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "Email is required.").email("Enter a valid email address."),
  role: z.enum(validRoles as [string, ...string[]], {
    message: "Select a valid role.",
  }),
});

export type TeamInviteFieldName = keyof z.infer<typeof teamInviteSchema>;

export function parseTeamInviteForm(formData: FormData) {
  return teamInviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
}

export function zodTeamInviteIssuesToFieldRecord(
  issues: z.ZodIssue[],
): Partial<Record<TeamInviteFieldName, string>> {
  const out: Partial<Record<TeamInviteFieldName, string>> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if ((key === "email" || key === "role") && !out[key]) {
      out[key] = issue.message;
    }
  }
  return out;
}
