import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/db";
import { assistantModules, canUseOrgAssistant } from "@/lib/org-assistant/access";
import { AssistantUnavailableError, runOrgAssistant, type AssistantMessage } from "@/lib/org-assistant/gemini-chat";

const MAX_MESSAGES = 20;
const MAX_CHARS = 4_000;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { tenantSlug?: string; messages?: AssistantMessage[] } | null;
  const tenantSlug = body?.tenantSlug?.trim();
  if (!tenantSlug) return NextResponse.json({ error: "Organization is required." }, { status: 400 });

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      name: true,
      settings: {
        select: {
          moduleAi: true,
          moduleSales: true,
          moduleFinance: true,
          moduleHr: true,
          moduleShortLets: true,
          moduleTasks: true,
        },
      },
    },
  });
  if (!tenant) return NextResponse.json({ error: "Organization not found." }, { status: 404 });

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { role: true, status: true },
  });
  if (!tenant.settings?.moduleAi) {
    return NextResponse.json({ error: "AI Assistant is not enabled for this organization." }, { status: 403 });
  }
  if (!canUseOrgAssistant(Boolean(session.user.isPlatformAdmin), membership, tenant.settings)) {
    return NextResponse.json({ error: "Only organization admins and HR can use Ask AI." }, { status: 403 });
  }

  const history = (Array.isArray(body?.messages) ? body.messages : [])
    .filter(
      (m): m is AssistantMessage =>
        Boolean(m) && (m.role === "user" || m.role === "assistant") && typeof m.text === "string" && m.text.trim() !== "",
    )
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, text: m.text.slice(0, MAX_CHARS) }));
  if (!history.length || history[history.length - 1].role !== "user") {
    return NextResponse.json({ error: "Ask a question first." }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI is not configured on this server." }, { status: 503 });

  try {
    const result = await runOrgAssistant({
      apiKey,
      tenantId: tenant.id,
      orgName: tenant.name,
      modules: assistantModules(tenant.settings),
      history,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AssistantUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("Org assistant failed.", error);
    return NextResponse.json({ error: "Ask AI could not answer right now. Please try again." }, { status: 500 });
  }
}
