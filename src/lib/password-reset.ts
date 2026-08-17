import { createHash, randomBytes } from "crypto";
import prisma from "@/lib/db";
import { getInviteBaseUrl } from "@/lib/email";

const IDENTIFIER_PREFIX = "password-reset:";
const TTL_MS = 60 * 60 * 1000;

function hashResetToken(raw: string) {
  const secret = process.env.AUTH_SECRET || "";
  return createHash("sha256").update(`${raw}${secret}`).digest("hex");
}

export function passwordResetIdentifier(email: string) {
  return `${IDENTIFIER_PREFIX}${email.trim().toLowerCase()}`;
}

export async function issuePasswordResetLink(email: string) {
  const raw = randomBytes(32).toString("hex");
  const token = hashResetToken(raw);
  const identifier = passwordResetIdentifier(email);
  const expires = new Date(Date.now() + TTL_MS);

  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: { identifier, token, expires },
  });

  return {
    resetUrl: `${getInviteBaseUrl()}/reset-password?token=${encodeURIComponent(raw)}`,
    expires,
  };
}

export async function readPasswordResetEmail(rawToken: string) {
  const token = hashResetToken(rawToken);
  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record?.identifier.startsWith(IDENTIFIER_PREFIX)) return null;
  if (record.expires.getTime() <= Date.now()) return null;
  return record.identifier.slice(IDENTIFIER_PREFIX.length);
}
