import { sanitizeOfferLetterHtml } from "@/lib/offer-letter-html";
import { NextRequest, NextResponse } from "next/server";

async function callGemini(html: string, instruction: string, apiKey: string): Promise<string | null> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `You edit HR offer letters. Return ONLY valid HTML fragments (p, ul, li, br, strong, em). No markdown fences.\n\nInstruction: ${instruction}\n\nHTML:\n${html}`,
              },
            ],
          },
        ],
      }),
    },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  return text ? sanitizeOfferLetterHtml(text.replace(/^```html?\s*|\s*```$/gi, "")) : null;
}

async function callGroq(html: string, instruction: string, apiKey: string): Promise<string | null> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You edit HR offer letters. Return ONLY HTML fragments (p, ul, li, br, strong, em). No markdown fences or explanations.",
        },
        { role: "user", content: `Instruction: ${instruction}\n\nHTML:\n${html}` },
      ],
      temperature: 0.4,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content?.trim();
  return text ? sanitizeOfferLetterHtml(text.replace(/^```html?\s*|\s*```$/gi, "")) : null;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { html?: string; instruction?: string };
  const html = sanitizeOfferLetterHtml(body.html || "");
  const instruction = (body.instruction || "Improve clarity and professionalism.").trim();
  if (!html) return NextResponse.json({ error: "No letter content." }, { status: 400 });

  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  if (geminiKey) {
    const edited = await callGemini(html, instruction, geminiKey);
    if (edited) return NextResponse.json({ html: edited, provider: "gemini" });
  }
  if (groqKey) {
    const edited = await callGroq(html, instruction, groqKey);
    if (edited) return NextResponse.json({ html: edited, provider: "groq" });
  }

  return NextResponse.json(
    {
      error:
        "No AI provider configured. Add GEMINI_API_KEY (free at aistudio.google.com) or GROQ_API_KEY (free at console.groq.com) to .env.local.",
    },
    { status: 503 },
  );
}
