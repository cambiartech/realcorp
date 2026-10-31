import {
  assistantTools,
  runAssistantTool,
  toolDeclarations,
  type AssistantModules,
} from "@/lib/org-assistant/tools";

export type AssistantMessage = { role: "user" | "assistant"; text: string };

type GeminiPart = {
  text?: string;
  thought?: boolean;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
};
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

const MODELS = [process.env.GEMINI_MODEL?.trim(), "gemini-2.5-flash", "gemini-2.0-flash"].filter(
  (value, index, all): value is string => Boolean(value) && all.indexOf(value) === index,
);
const MAX_TOOL_ROUNDS = 6;
const TIMEOUT_MS = 20_000;

export class AssistantUnavailableError extends Error {}

function systemPrompt(orgName: string, modules: AssistantModules) {
  const today = new Date().toISOString().slice(0, 10);
  const on = Object.entries(modules)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(", ");
  return [
    `You are the Realcorp business analyst for ${orgName}. Today is ${today}.`,
    `You answer the CEO and admins using live data from their ERP. Modules switched on: ${on || "none"}.`,
    "Always call the data tools to get numbers. Use only figures the tools return and say when data is missing.",
    "Pick sensible date ranges (this month, last month, this quarter) and state the period you used.",
    "Money is Nigerian Naira unless stated: write it as ₦1,250,000.",
    "Lead with the answer, then the key numbers, then 2-3 short insights or next steps when useful.",
    "Use short markdown: **bold**, bullet lists, and simple tables with | pipes |. Keep it brief.",
    "If asked about something outside the tools (for example a module that is off), say what you can report instead.",
  ].join("\n");
}

async function callModel(model: string, apiKey: string, body: unknown) {
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify(body),
  });
}

export async function runOrgAssistant(opts: {
  apiKey: string;
  tenantId: string;
  orgName: string;
  modules: AssistantModules;
  history: AssistantMessage[];
}): Promise<{ text: string; toolsUsed: string[] }> {
  const tools = assistantTools(opts.modules);
  const contents: GeminiContent[] = opts.history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.text }],
  }));
  const toolsUsed: string[] = [];

  for (const model of MODELS) {
    const convo = [...contents];
    let modelMissing = false;
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const res = await callModel(model, opts.apiKey, {
        systemInstruction: { parts: [{ text: systemPrompt(opts.orgName, opts.modules) }] },
        contents: convo,
        tools: [{ functionDeclarations: toolDeclarations(tools) }],
        generationConfig: { temperature: 0.3 },
      });
      if (res.status === 404) {
        modelMissing = true;
        break;
      }
      if (res.status === 429 || res.status === 503) {
        throw new AssistantUnavailableError("The AI is busy right now. Try again in a minute.");
      }
      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        console.error("Org assistant provider error.", { model, status: res.status, detail: detail?.error?.message });
        throw new AssistantUnavailableError("The AI could not answer right now. Please try again.");
      }
      const data = (await res.json()) as { candidates?: Array<{ content?: GeminiContent }> };
      const content = data.candidates?.[0]?.content;
      const parts = content?.parts ?? [];
      const calls = parts.filter((p) => p.functionCall);
      if (!calls.length) {
        const text = parts
          .filter((p) => p.text && !p.thought)
          .map((p) => p.text)
          .join("")
          .trim();
        return { text: text || "I could not find an answer to that. Try asking another way.", toolsUsed };
      }
      if (round === MAX_TOOL_ROUNDS) break;
      convo.push({ role: "model", parts });
      const responses = await Promise.all(
        calls.map(async (p) => {
          const name = p.functionCall!.name;
          toolsUsed.push(name);
          const result = await runAssistantTool(tools, opts.modules, opts.tenantId, name, p.functionCall!.args ?? {});
          return { functionResponse: { name, response: { result } } } satisfies GeminiPart;
        }),
      );
      convo.push({ role: "user", parts: responses });
    }
    if (!modelMissing) {
      return { text: "That question needed too many lookups. Try narrowing it to one area or period.", toolsUsed };
    }
  }
  throw new AssistantUnavailableError("No AI model is available. Check GEMINI_MODEL.");
}
