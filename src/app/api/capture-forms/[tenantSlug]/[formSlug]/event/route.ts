import { trackCaptureFormEvent } from "@/app/f/[tenantSlug]/[formSlug]/actions";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; formSlug: string }> },
) {
  const { tenantSlug, formSlug } = await params;
  try {
    const body = await request.json();
    await trackCaptureFormEvent(tenantSlug, formSlug, body);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
