export type ModelEntry = {
  id: string
  /** OpenRouter model id used in chat/completions, e.g. `deepseek/deepseek-chat-v3.1` */
  openrouterId: string
  name: string
  contextLength: number | null
  promptPrice: number | null
  completionPrice: number | null
  isFree: boolean
  provider: string
}

export const FALLBACK_MODELS: ModelEntry[] = [
  {
    id: "openrouter/deepseek/deepseek-chat-v3.1",
    openrouterId: "deepseek/deepseek-chat-v3.1",
    name: "DeepSeek V3.1",
    contextLength: 163840,
    promptPrice: 0.27,
    completionPrice: 1.1,
    isFree: false,
    provider: "deepseek",
  },
  {
    id: "openrouter/google/gemini-2.5-flash",
    openrouterId: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    contextLength: 1048576,
    promptPrice: 0.3,
    completionPrice: 2.5,
    isFree: false,
    provider: "google",
  },
  {
    id: "openrouter/anthropic/claude-sonnet-4",
    openrouterId: "anthropic/claude-sonnet-4",
    name: "Claude Sonnet 4",
    contextLength: 200000,
    promptPrice: 3,
    completionPrice: 15,
    isFree: false,
    provider: "anthropic",
  },
  {
    id: "openrouter/openai/gpt-4.1-mini",
    openrouterId: "openai/gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    contextLength: 1047576,
    promptPrice: 0.4,
    completionPrice: 1.6,
    isFree: false,
    provider: "openai",
  },
  {
    id: "openrouter/meta-llama/llama-3.3-70b-instruct",
    openrouterId: "meta-llama/llama-3.3-70b-instruct",
    name: "Llama 3.3 70B",
    contextLength: 131072,
    promptPrice: 0.1,
    completionPrice: 0.32,
    isFree: false,
    provider: "meta-llama",
  },
  {
    id: "openrouter/qwen/qwen3-235b-a22b",
    openrouterId: "qwen/qwen3-235b-a22b",
    name: "Qwen3 235B A22B",
    contextLength: 131072,
    promptPrice: 0.2,
    completionPrice: 0.6,
    isFree: false,
    provider: "qwen",
  },
  {
    id: "openrouter/mistralai/mistral-small-3.2-24b-instruct",
    openrouterId: "mistralai/mistral-small-3.2-24b-instruct",
    name: "Mistral Small 3.2",
    contextLength: 128000,
    promptPrice: 0.06,
    completionPrice: 0.18,
    isFree: false,
    provider: "mistralai",
  },
  {
    id: "openrouter/google/gemma-3-27b-it:free",
    openrouterId: "google/gemma-3-27b-it:free",
    name: "Gemma 3 27B (free)",
    contextLength: 131072,
    promptPrice: 0,
    completionPrice: 0,
    isFree: true,
    provider: "google",
  },
]

export function modelDisplayName(model: ModelEntry | undefined, fallbackId: string): string {
  if (model?.name) return model.name
  const bare = fallbackId.replace(/^openrouter\//, "")
  const parts = bare.split("/")
  return parts[parts.length - 1] || bare
}

export function formatContext(length: number | null): string | null {
  if (length == null || length <= 0) return null
  if (length >= 1_000_000) return `${(length / 1_000_000).toFixed(length % 1_000_000 === 0 ? 0 : 1)}M ctx`
  if (length >= 1000) return `${Math.round(length / 1000)}k ctx`
  return `${length} ctx`
}

export function formatPrice(prompt: number | null, completion: number | null): string | null {
  if (prompt == null && completion == null) return null
  if ((prompt ?? 0) === 0 && (completion ?? 0) === 0) return "Free"
  const p = prompt != null ? `$${prompt.toFixed(prompt < 1 ? 2 : 2)}` : "—"
  const c = completion != null ? `$${completion.toFixed(completion < 1 ? 2 : 2)}` : "—"
  return `${p} / ${c} per 1M`
}

export function providerFromId(id: string): string {
  const bare = id.replace(/^openrouter\//, "")
  return bare.split("/")[0] || "model"
}

/** Map catalog id (`openrouter/foo/bar`) → OpenRouter chat id (`foo/bar`). */
export function toOpenRouterChatId(ref: string): string {
  return ref.replace(/^openrouter\//, "")
}
