"use server";

import prisma from "@/lib/db";
import { isTransactionalEmailConfigured, sendPasswordResetEmail } from "@/lib/email";
import { issuePasswordResetLink } from "@/lib/password-reset";
import { parseForgotPasswordForm } from "@/lib/validators/password-reset";

export type ForgotPasswordResult = { ok: true; message: string } | { ok: false; error: string };

const GENERIC_OK =
  "If that email is on a Realcorp account, we’ve sent a reset link. Check your inbox and spam folder.";

export async function requestPasswordReset(
  _prev: ForgotPasswordResult | null,
  formData: FormData,
): Promise<ForgotPasswordResult> {
  const parsed = parseForgotPasswordForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((issue) => issue.message).join(" ") };
  }

  if (!isTransactionalEmailConfigured()) {
    return {
      ok: false,
      error: "Password reset email is not available right now. Ask your organization admin for help.",
    };
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { name: true, email: true, passwordHash: true },
  });

  if (user?.email && user.passwordHash) {
    try {
      const { resetUrl } = await issuePasswordResetLink(user.email);
      await sendPasswordResetEmail({
        to: user.email,
        resetUrl,
        name: user.name,
      });
    } catch {
      // Same response either way — do not reveal whether the account exists.
    }
  }

  return { ok: true, message: GENERIC_OK };
}
