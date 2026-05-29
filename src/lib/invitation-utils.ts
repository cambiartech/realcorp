import { randomBytes } from "crypto";
import { getInviteBaseUrl } from "@/lib/email";

export const INVITE_TTL_DAYS = 14;

export function buildInviteUrl(token: string) {
  return `${getInviteBaseUrl()}/join?token=${token}`;
}

export function inviteExpiresAt(from = new Date()) {
  const expiresAt = new Date(from);
  expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);
  return expiresAt;
}

export function newInviteToken() {
  return randomBytes(32).toString("hex");
}

export type InviteLinkStatus = "valid" | "expired" | "accepted" | "not_found";

export function classifyInvite(invite: {
  acceptedAt: Date | null;
  expiresAt: Date;
} | null): InviteLinkStatus {
  if (!invite) return "not_found";
  if (invite.acceptedAt) return "accepted";
  if (invite.expiresAt <= new Date()) return "expired";
  return "valid";
}

export function inviteStatusLabel(status: InviteLinkStatus) {
  switch (status) {
    case "valid":
      return "Active — link works";
    case "expired":
      return "Expired — refresh token to reactivate";
    case "accepted":
      return "Already used — member joined";
    case "not_found":
      return "Invalid — token not in database";
  }
}
