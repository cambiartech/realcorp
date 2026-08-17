"use server";

import bcrypt from "bcryptjs";
import prisma from "@/lib/db";
import { passwordResetIdentifier, readPasswordResetEmail } from "@/lib/password-reset";
import { parseResetPasswordForm } from "@/lib/validators/password-reset";

export type ResetPasswordResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string };

export async function completePasswordReset(
  _prev: ResetPasswordResult | null,
  formData: FormData,
): Promise<ResetPasswordResult> {
  const parsed = parseResetPasswordForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((issue) => issue.message).join(" ") };
  }

  const email = await readPasswordResetEmail(parsed.data.token);
  if (!email) {
    return {
      ok: false,
      error: "This reset link is invalid or has expired. Request a new one from the sign-in page.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) {
    return {
      ok: false,
      error: "This reset link is invalid or has expired. Request a new one from the sign-in page.",
    };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    }),
    prisma.verificationToken.deleteMany({
      where: { identifier: passwordResetIdentifier(email) },
    }),
  ]);

  return { ok: true, redirectTo: "/login?reset=1" };
}
