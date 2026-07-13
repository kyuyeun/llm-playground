import { NextResponse } from "next/server"

import { FALLBACK_MODELS, type ModelEntry } from "@/lib/models"
import { resolveOpenRouterApiKey } from "@/lib/openrouter-key"

type OpenRouterModel = {
  id: string
  name?: string
  context_length?: number
  pricing?: {
    prompt?: string
    completion?: string
  }
}

function parsePrice(raw: string | undefined): number | null {
  if (raw == null || raw === "") return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return n * 1_000_000
}

function normalizeModel(raw: OpenRouterModel): ModelEntry {
  const openrouterId = raw.id
  const provider = openrouterId.split("/")[0] || "model"
  const promptPrice = parsePrice(raw.pricing?.prompt)
  const completionPrice = parsePrice(raw.pricing?.completion)
  const isFree =
    openrouterId.endsWith(":free") ||
    ((promptPrice ?? 0) === 0 && (completionPrice ?? 0) === 0)

  return {
    id: `openrouter/${openrouterId}`,
    openrouterId,
    name: raw.name?.trim() || openrouterId.split("/").pop() || openrouterId,
    contextLength: raw.context_length ?? null,
    promptPrice,
    completionPrice,
    isFree,
    provider,
  }
}

export async function GET(req: Request) {
  const apiKey = resolveOpenRouterApiKey(req)

  if (!apiKey) {
    return NextResponse.json({
      models: FALLBACK_MODELS,
      source: "fallback",
      needsApiKey: true,
      warning: "Add your OpenRouter API key to load the full model catalog.",
    })
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        {
          models: FALLBACK_MODELS,
          source: "fallback",
          needsApiKey: res.status === 401 || res.status === 403,
          warning: `OpenRouter models request failed (${res.status}): ${text.slice(0, 200)}`,
        },
        { status: 200 }
      )
    }

    const data = (await res.json()) as { data?: OpenRouterModel[] }
    const models = (data.data ?? [])
      .map(normalizeModel)
      .filter((m) => m.openrouterId && !m.openrouterId.includes("auto"))
      .sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({
      models: models.length > 0 ? models : FALLBACK_MODELS,
      source: models.length > 0 ? "openrouter" : "fallback",
      needsApiKey: false,
    })
  } catch (err) {
    return NextResponse.json({
      models: FALLBACK_MODELS,
      source: "fallback",
      warning: err instanceof Error ? err.message : "Failed to fetch models",
    })
  }
}
