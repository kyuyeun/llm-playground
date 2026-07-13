import { NextResponse } from "next/server"

import { toOpenRouterChatId } from "@/lib/models"
import { resolveOpenRouterApiKey } from "@/lib/openrouter-key"

type ChatMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

export async function POST(req: Request) {
  const apiKey = resolveOpenRouterApiKey(req)
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenRouter API key required", needsApiKey: true },
      { status: 401 }
    )
  }

  let body: { messages?: ChatMessage[]; model?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const messages = body.messages
  const modelRef = (body.model || "").trim()
  if (!messages?.length || !modelRef) {
    return NextResponse.json({ error: "messages and model are required" }, { status: 400 })
  }

  const model = toOpenRouterChatId(modelRef)

  const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER || "http://localhost:3000",
      "X-Title": process.env.OPENROUTER_APP_TITLE || "LLM Playground Mock",
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
  })

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text()
    const needsApiKey = upstream.status === 401 || upstream.status === 403
    return NextResponse.json(
      { error: text || `OpenRouter error ${upstream.status}`, needsApiKey },
      { status: upstream.status }
    )
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
