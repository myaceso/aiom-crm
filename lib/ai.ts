export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export const AI_SYSTEM_PROMPT = `You are the enone CRM Smart Agent — a helpful copilot for contacts, pipelines, campaigns, SMS, email, WhatsApp, Telegram, and social marketing.

Guidelines:
- Be concise, practical, and bilingual-friendly (answer in the user's language: English or Spanish).
- Help draft copy, segment ideas, follow-up sequences, and CRM workflow tips.
- Do NOT claim you can send real SMS, email, WhatsApp, Telegram, or social posts unless the user has already wired those integrations and asked you to draft content for them to send themselves.
- Do not invent CRM data (contacts, deals, metrics). If you need specifics, ask the user.
- Prefer actionable suggestions the user can apply inside enone CRM.
- Keep a professional, friendly tone matching a modern indigo/navy CRM product.`;

export function isAiConfigured(): boolean {
  return !!(
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.ANTHROPIC_API_KEY?.trim()
  );
}

export function resolveAiProvider(): "openai" | "anthropic" | null {
  if (process.env.OPENAI_API_KEY?.trim()) return "openai";
  if (process.env.ANTHROPIC_API_KEY?.trim()) return "anthropic";
  return null;
}

function sanitizeMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim()
    )
    .map((m) => ({
      role: m.role,
      content: m.content.trim().slice(0, 12000),
    }))
    .slice(-40);
}

async function callOpenAI(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY!.trim();
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(
    /\/$/,
    ""
  );
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.6,
      messages: [
        { role: "system", content: AI_SYSTEM_PROMPT },
        ...sanitizeMessages(messages),
      ],
    }),
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    choices?: { message?: { content?: string } }[];
  };

  if (!res.ok) {
    throw new Error(data.error?.message || `OpenAI request failed (${res.status})`);
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty response from OpenAI");
  return content;
}

async function callAnthropic(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY!.trim();
  const model =
    process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-20250514";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: AI_SYSTEM_PROMPT,
      messages: sanitizeMessages(messages).map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    }),
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    content?: { type?: string; text?: string }[];
  };

  if (!res.ok) {
    throw new Error(
      data.error?.message || `Anthropic request failed (${res.status})`
    );
  }

  const text = data.content
    ?.filter((c) => c.type === "text" && c.text)
    .map((c) => c.text)
    .join("\n")
    .trim();
  if (!text) throw new Error("Empty response from Anthropic");
  return text;
}

export async function generateAiReply(messages: ChatMessage[]): Promise<{
  content: string;
  provider: "openai" | "anthropic";
}> {
  const provider = resolveAiProvider();
  if (!provider) {
    const err = new Error("ai_not_configured");
    (err as Error & { code: string }).code = "ai_not_configured";
    throw err;
  }
  const content =
    provider === "openai"
      ? await callOpenAI(messages)
      : await callAnthropic(messages);
  return { content, provider };
}
