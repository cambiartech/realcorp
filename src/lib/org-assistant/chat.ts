import {
  anthropicToolDeclarations,
  assistantTools,
  openAiToolDeclarations,
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

const MAX_TOOL_ROUNDS = 6;
const TIMEOUT_MS = 45_000;

export class AssistantUnavailableError extends Error {}

function systemPrompt(orgName: string, modules: AssistantModules) {
  const today = new Date().toISOString().slice(0, 10);
  const on = Object.entries(modules)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(", ");
  return [
    `You are the Realcorp business analyst for ${orgName}. Today is ${today}.`,
    `You answer the CEO, admins and HR using live data from their ERP. Modules switched on: ${on || "none"}.`,
    "Always call the data tools to get numbers. Use only figures the tools return and say when data is missing.",
    "Pick sensible date ranges (this week, this month, last month, this quarter) and state the period you used.",
    "Money is Nigerian Naira unless stated: write it as ₦1,250,000.",
    "Lead with the answer, then the key numbers, then 2-3 short insights or next steps when useful.",
    "Use short markdown: **bold**, bullet lists, and simple tables with | pipes |. Keep it brief.",
    "If asked about something outside the tools (for example a module that is off), say what you can report instead.",
  ].join("\n");
}

function normalizeGeminiModel(raw: string) {
  return raw.trim().replace(/^models\//i, "");
}

function geminiModels() {
  return [
    process.env.GEMINI_MODEL,
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-flash-latest",
  ]
    .map((v) => (v ? normalizeGeminiModel(v) : ""))
    .filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index);
}

type ProviderResult = { text: string; toolsUsed: string[]; provider: string };

async function runGemini(
  apiKey: string,
  tenantId: string,
  orgName: string,
  modules: AssistantModules,
  history: AssistantMessage[],
): Promise<ProviderResult> {
  const tools = assistantTools(modules);
  const base: GeminiContent[] = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.text }],
  }));
  const toolsUsed: string[] = [];
  let lastDetail = "";

  for (const model of geminiModels()) {
    const convo = [...base];
    let skipModel = false;
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      let res: Response;
      try {
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            signal: AbortSignal.timeout(TIMEOUT_MS),
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt(orgName, modules) }] },
              contents: convo,
              tools: [{ functionDeclarations: toolDeclarations(tools) }],
              toolConfig: { functionCallingConfig: { mode: "AUTO" } },
              generationConfig: { temperature: 0.3 },
            }),
          },
        );
      } catch (error) {
        lastDetail = error instanceof Error ? error.message : "Gemini request failed";
        console.error("Org assistant Gemini network error.", { model, lastDetail });
        skipModel = true;
        break;
      }

      if (res.status === 404) {
        lastDetail = `Model ${model} was not found for this API key.`;
        skipModel = true;
        break;
      }
      if (res.status === 429 || res.status === 503) {
        lastDetail = `Gemini ${model} is rate-limited (${res.status}).`;
        skipModel = true;
        break;
      }
      if (!res.ok) {
        const failure = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        lastDetail = failure?.error?.message || `Gemini ${model} returned ${res.status}`;
        console.error("Org assistant Gemini provider error.", { model, status: res.status, detail: lastDetail });
        // Bad request on this model/schema — try the next model.
        skipModel = true;
        break;
      }

      const data = (await res.json()) as {
        candidates?: Array<{ content?: GeminiContent; finishReason?: string }>;
        promptFeedback?: { blockReason?: string };
      };
      if (data.promptFeedback?.blockReason) {
        throw new AssistantUnavailableError("Gemini blocked that question. Try rephrasing it.");
      }
      const parts = data.candidates?.[0]?.content?.parts ?? [];
      const calls = parts.filter((p) => p.functionCall);
      if (!calls.length) {
        const text = parts
          .filter((p) => p.text && !p.thought)
          .map((p) => p.text)
          .join("")
          .trim();
        return {
          text: text || "I could not find an answer to that. Try asking another way.",
          toolsUsed,
          provider: `gemini:${model}`,
        };
      }
      if (round === MAX_TOOL_ROUNDS) {
        return {
          text: "That question needed too many lookups. Try narrowing it to one area or period.",
          toolsUsed,
          provider: `gemini:${model}`,
        };
      }
      convo.push({ role: "model", parts });
      const responses = await Promise.all(
        calls.map(async (p) => {
          const name = p.functionCall!.name;
          toolsUsed.push(name);
          const result = await runAssistantTool(tools, modules, tenantId, name, p.functionCall!.args ?? {});
          return { functionResponse: { name, response: { result } } } satisfies GeminiPart;
        }),
      );
      convo.push({ role: "user", parts: responses });
    }
    if (!skipModel) {
      return {
        text: "That question needed too many lookups. Try narrowing it to one area or period.",
        toolsUsed,
        provider: `gemini:${model}`,
      };
    }
  }

  throw new AssistantUnavailableError(
    lastDetail
      ? `Gemini could not answer (${lastDetail}).`
      : "Gemini could not answer with any available model.",
  );
}

type OpenAiMessage =
  | { role: "system" | "user" | "assistant"; content: string }
  | { role: "assistant"; content: string | null; tool_calls: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }> }
  | { role: "tool"; tool_call_id: string; content: string };

async function runOpenAiCompatible(opts: {
  label: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  tenantId: string;
  orgName: string;
  modules: AssistantModules;
  history: AssistantMessage[];
}): Promise<ProviderResult> {
  const tools = assistantTools(opts.modules);
  const messages: OpenAiMessage[] = [
    { role: "system", content: systemPrompt(opts.orgName, opts.modules) },
    ...opts.history.map((m) => ({ role: m.role, content: m.text }) as OpenAiMessage),
  ];
  const toolsUsed: string[] = [];

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const res = await fetch(`${opts.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        model: opts.model,
        temperature: 0.3,
        messages,
        tools: openAiToolDeclarations(tools),
        tool_choice: "auto",
      }),
    });
    if (res.status === 429 || res.status === 503) {
      throw new AssistantUnavailableError(`${opts.label} is busy right now. Try again in a minute.`);
    }
    if (!res.ok) {
      const failure = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      console.error("Org assistant OpenAI-compatible error.", {
        provider: opts.label,
        status: res.status,
        detail: failure?.error?.message,
      });
      throw new AssistantUnavailableError(`${opts.label} could not answer right now.`);
    }
    const data = (await res.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
        };
      }>;
    };
    const message = data.choices?.[0]?.message;
    const toolCalls = message?.tool_calls ?? [];
    if (!toolCalls.length) {
      const text = (message?.content || "").trim();
      return {
        text: text || "I could not find an answer to that. Try asking another way.",
        toolsUsed,
        provider: `${opts.label}:${opts.model}`,
      };
    }
    if (round === MAX_TOOL_ROUNDS) {
      return {
        text: "That question needed too many lookups. Try narrowing it to one area or period.",
        toolsUsed,
        provider: `${opts.label}:${opts.model}`,
      };
    }
    messages.push({
      role: "assistant",
      content: message?.content ?? null,
      tool_calls: toolCalls,
    });
    for (const call of toolCalls) {
      toolsUsed.push(call.function.name);
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
      } catch {
        args = {};
      }
      const result = await runAssistantTool(tools, opts.modules, opts.tenantId, call.function.name, args);
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ result }) });
    }
  }
  return {
    text: "That question needed too many lookups. Try narrowing it to one area or period.",
    toolsUsed,
    provider: `${opts.label}:${opts.model}`,
  };
}

type AnthropicContent =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

async function runAnthropic(
  apiKey: string,
  tenantId: string,
  orgName: string,
  modules: AssistantModules,
  history: AssistantMessage[],
): Promise<ProviderResult> {
  const tools = assistantTools(modules);
  const model = process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-5";
  const messages: Array<{ role: "user" | "assistant"; content: string | AnthropicContent[] }> = history.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.text,
  }));
  const toolsUsed: string[] = [];

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        temperature: 0.3,
        system: systemPrompt(orgName, modules),
        tools: anthropicToolDeclarations(tools),
        messages,
      }),
    });
    if (res.status === 429 || res.status === 503) {
      throw new AssistantUnavailableError("Claude is busy right now. Try again in a minute.");
    }
    if (!res.ok) {
      const failure = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      console.error("Org assistant Anthropic error.", { status: res.status, detail: failure?.error?.message });
      throw new AssistantUnavailableError("Claude could not answer right now.");
    }
    const data = (await res.json()) as {
      content?: AnthropicContent[];
      stop_reason?: string;
    };
    const content = data.content ?? [];
    const toolUses = content.filter((c): c is Extract<AnthropicContent, { type: "tool_use" }> => c.type === "tool_use");
    if (!toolUses.length) {
      const text = content
        .filter((c): c is Extract<AnthropicContent, { type: "text" }> => c.type === "text")
        .map((c) => c.text)
        .join("")
        .trim();
      return {
        text: text || "I could not find an answer to that. Try asking another way.",
        toolsUsed,
        provider: `anthropic:${model}`,
      };
    }
    if (round === MAX_TOOL_ROUNDS) {
      return {
        text: "That question needed too many lookups. Try narrowing it to one area or period.",
        toolsUsed,
        provider: `anthropic:${model}`,
      };
    }
    messages.push({ role: "assistant", content });
    const toolResults: AnthropicContent[] = [];
    for (const call of toolUses) {
      toolsUsed.push(call.name);
      const result = await runAssistantTool(tools, modules, tenantId, call.name, call.input ?? {});
      toolResults.push({ type: "tool_result", tool_use_id: call.id, content: JSON.stringify({ result }) });
    }
    messages.push({ role: "user", content: toolResults });
  }
  return {
    text: "That question needed too many lookups. Try narrowing it to one area or period.",
    toolsUsed,
    provider: `anthropic:${model}`,
  };
}

export function availableAssistantProviders() {
  return {
    gemini: Boolean(process.env.GEMINI_API_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    groq: Boolean(process.env.GROQ_API_KEY),
  };
}

export async function runOrgAssistant(opts: {
  tenantId: string;
  orgName: string;
  modules: AssistantModules;
  history: AssistantMessage[];
}): Promise<ProviderResult> {
  const errors: string[] = [];
  const providers = availableAssistantProviders();

  if (providers.gemini) {
    try {
      return await runGemini(process.env.GEMINI_API_KEY!, opts.tenantId, opts.orgName, opts.modules, opts.history);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gemini failed";
      errors.push(message);
      console.error("Org assistant Gemini lane failed.", message);
    }
  }

  if (providers.anthropic) {
    try {
      return await runAnthropic(
        process.env.ANTHROPIC_API_KEY!,
        opts.tenantId,
        opts.orgName,
        opts.modules,
        opts.history,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Claude failed";
      errors.push(message);
      console.error("Org assistant Anthropic lane failed.", message);
    }
  }

  if (providers.openai) {
    try {
      return await runOpenAiCompatible({
        label: "OpenAI",
        apiKey: process.env.OPENAI_API_KEY!,
        baseUrl: "https://api.openai.com/v1",
        model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
        tenantId: opts.tenantId,
        orgName: opts.orgName,
        modules: opts.modules,
        history: opts.history,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "OpenAI failed";
      errors.push(message);
      console.error("Org assistant OpenAI lane failed.", message);
    }
  }

  if (providers.groq) {
    try {
      return await runOpenAiCompatible({
        label: "Groq",
        apiKey: process.env.GROQ_API_KEY!,
        baseUrl: "https://api.groq.com/openai/v1",
        model: process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile",
        tenantId: opts.tenantId,
        orgName: opts.orgName,
        modules: opts.modules,
        history: opts.history,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Groq failed";
      errors.push(message);
      console.error("Org assistant Groq lane failed.", message);
    }
  }

  if (!providers.gemini && !providers.anthropic && !providers.openai && !providers.groq) {
    throw new AssistantUnavailableError(
      "No AI provider key is configured. Set GEMINI_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY, or GROQ_API_KEY.",
    );
  }

  throw new AssistantUnavailableError(
    errors[0] || "Ask AI could not reach any provider right now. Please try again.",
  );
}
