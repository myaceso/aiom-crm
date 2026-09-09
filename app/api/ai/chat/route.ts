import { NextResponse } from "next/server";
import { generateAiReply, isAiConfigured, type ChatMessage } from "@/lib/ai";
import {
  getAiChatStore,
  newId,
  saveAiChatStore,
  titleFromMessage,
  type AiConversation,
  type AiStoredMessage,
} from "@/lib/aiChatDb";
import { getCurrentSafeUser } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  messages?: { role?: string; content?: string }[];
  conversationId?: string;
};

export async function GET(req: Request) {
  const user = await getCurrentSafeUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const store = await getAiChatStore(user.id);
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (id) {
    const conversation = store.conversations.find((c) => c.id === id) || null;
    if (!conversation) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({
      conversation,
      configured: isAiConfigured(),
    });
  }

  const conversations = store.conversations
    .slice()
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
    .map(({ id: cid, title, updatedAt, createdAt, messages }) => ({
      id: cid,
      title,
      updatedAt,
      createdAt,
      preview: messages[messages.length - 1]?.content?.slice(0, 120) || "",
    }));

  return NextResponse.json({
    conversations,
    configured: isAiConfigured(),
  });
}

export async function DELETE(req: Request) {
  const user = await getCurrentSafeUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const store = await getAiChatStore(user.id);
  store.conversations = store.conversations.filter((c) => c.id !== id);
  await saveAiChatStore(user.id, store);
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const user = await getCurrentSafeUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const normalized: ChatMessage[] = incoming
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim()
    )
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: String(m.content).trim().slice(0, 12000),
    }));

  if (!normalized.length || normalized[normalized.length - 1].role !== "user") {
    return NextResponse.json({ error: "messages_required" }, { status: 400 });
  }

  if (!isAiConfigured()) {
    return NextResponse.json(
      {
        error: "ai_not_configured",
        message:
          "Set OPENAI_API_KEY (preferred) or ANTHROPIC_API_KEY on Vercel, then redeploy.",
      },
      { status: 503 }
    );
  }

  let reply: string;
  let provider: "openai" | "anthropic";
  try {
    const result = await generateAiReply(normalized);
    reply = result.content;
    provider = result.provider;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "ai_not_configured") {
      return NextResponse.json(
        {
          error: "ai_not_configured",
          message:
            "Set OPENAI_API_KEY (preferred) or ANTHROPIC_API_KEY on Vercel, then redeploy.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "provider_error", message },
      { status: 502 }
    );
  }

  const now = new Date().toISOString();
  const store = await getAiChatStore(user.id);
  const conversationId =
    typeof body.conversationId === "string" && body.conversationId.trim()
      ? body.conversationId.trim()
      : "";

  const existingIdx = conversationId
    ? store.conversations.findIndex((c) => c.id === conversationId)
    : -1;
  const existing =
    existingIdx >= 0 ? store.conversations[existingIdx] : undefined;

  const historyMsgs: AiStoredMessage[] = normalized.map((m, i) => {
    const prior = existing?.messages[i];
    if (
      prior &&
      prior.role === m.role &&
      prior.content === m.content
    ) {
      return prior;
    }
    return {
      id: newId("msg"),
      role: m.role as "user" | "assistant",
      content: m.content,
      createdAt: now,
    };
  });

  const assistantMsg: AiStoredMessage = {
    id: newId("msg"),
    role: "assistant",
    content: reply,
    createdAt: now,
  };

  const lastUser = normalized[normalized.length - 1];
  const conversation: AiConversation = {
    id: existing?.id || newId("chat"),
    title: existing?.title || titleFromMessage(lastUser.content),
    messages: [...historyMsgs, assistantMsg],
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  if (existingIdx >= 0) {
    store.conversations[existingIdx] = conversation;
  } else {
    store.conversations.unshift(conversation);
  }

  await saveAiChatStore(user.id, store);

  return NextResponse.json({
    ok: true,
    conversationId: conversation.id,
    reply: assistantMsg,
    provider,
    conversation,
  });
}
