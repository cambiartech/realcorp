import crypto from "crypto";

type SignatureInput = {
  apiSecret: string;
  timestamp: number;
  folder: string;
  publicId: string;
};

export function buildCloudinaryAttachmentSignature(input: SignatureInput) {
  const toSign = `folder=${input.folder}&public_id=${input.publicId}&timestamp=${input.timestamp}${input.apiSecret}`;
  return crypto.createHash("sha1").update(toSign).digest("hex");
}
