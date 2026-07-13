"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowUp, KeyRound, Square } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { ApiKeyDialog, API_KEY_STORAGE } from "@/components/api-key-dialog"
import { ArtifactChips, ArtifactPanel } from "@/components/artifact-panel"
import { ModelPicker } from "@/components/model-picker"
import {
  artifactSystemMessage,
  extractArtifacts,
  stripArtifactFences,
  type ArtifactFile,
} from "@/lib/artifacts"
import { FALLBACK_MODELS, type ModelEntry } from "@/lib/models"
import { cn } from "@/lib/utils"

type Role = "user" | "assistant"

type Message = {
  id: string
  role: Role
  content: string
}

const MODEL_STORAGE_KEY = "llm-playground-mock.model"

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function authHeaders(apiKey: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (apiKey) headers["x-openrouter-api-key"] = apiKey
  return headers
}

async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onDelta: (text: string) => void,
  signal: AbortSignal
) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    if (signal.aborted) {
      await reader.cancel()
      break
    }
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split("\n")
    buffer = parts.pop() || ""

    for (const line of parts) {
      const trimmed = line.trim()
      if (!trimmed.startsWith("data:")) continue
      const payload = trimmed.slice(5).trim()
      if (!payload || payload === "[DONE]") continue
      try {
        const json = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>
        }
        const delta = json.choices?.[0]?.delta?.content
        if (delta) onDelta(delta)
      } catch {
        // ignore malformed chunks
      }
    }
  }
}

export function ChatPlayground() {
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [keyReady, setKeyReady] = useState(false)
  const [keyDialogOpen, setKeyDialogOpen] = useState(false)
  const [models, setModels] = useState<ModelEntry[]>(FALLBACK_MODELS)
  const [modelsLoading, setModelsLoading] = useState(false)
  const [catalogWarning, setCatalogWarning] = useState<string | null>(null)
  const [model, setModel] = useState(FALLBACK_MODELS[0]?.id || "")
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null)
  const [artifactPanelOpen, setArtifactPanelOpen] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const allArtifacts = useMemo(() => {
    const files: ArtifactFile[] = []
    for (const m of messages) {
      if (m.role !== "assistant") continue
      files.push(...extractArtifacts(m.content, m.id))
    }
    return files
  }, [messages])

  useEffect(() => {
    const savedKey = localStorage.getItem(API_KEY_STORAGE)?.trim() || null
    const savedModel = localStorage.getItem(MODEL_STORAGE_KEY)
    if (savedModel) setModel(savedModel)
    setApiKey(savedKey)
    setKeyReady(true)
    if (!savedKey) setKeyDialogOpen(true)
  }, [])

  useEffect(() => {
    if (model) localStorage.setItem(MODEL_STORAGE_KEY, model)
  }, [model])

  const loadModels = useCallback(async (key: string | null) => {
    setModelsLoading(true)
    try {
      const res = await fetch("/api/models", {
        headers: authHeaders(key),
      })
      const data = (await res.json()) as {
        models?: ModelEntry[]
        warning?: string
        needsApiKey?: boolean
      }
      const next = data.models?.length ? data.models : FALLBACK_MODELS
      setModels(next)
      setCatalogWarning(data.warning || null)
      if (data.needsApiKey && !key) setKeyDialogOpen(true)
      setModel((current) => {
        if (current && next.some((m) => m.id === current)) return current
        const saved = localStorage.getItem(MODEL_STORAGE_KEY)
        if (saved && next.some((m) => m.id === saved)) return saved
        return next[0]?.id || current
      })
    } catch (err) {
      setCatalogWarning(err instanceof Error ? err.message : "Failed to load models")
    } finally {
      setModelsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!keyReady) return
    void loadModels(apiKey)
  }, [keyReady, apiKey, loadModels])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, sending])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "0px"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [input])

  // Auto-open / focus when a new artifact id appears (not on every streaming chunk).
  const artifactIdsKey = allArtifacts.map((f) => f.id).join("|")
  useEffect(() => {
    if (!artifactIdsKey) return
    const latest = allArtifacts[allArtifacts.length - 1]
    if (!latest) return
    setActiveArtifactId(latest.id)
    setArtifactPanelOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react when the set of ids changes
  }, [artifactIdsKey])

  function saveApiKey(key: string) {
    localStorage.setItem(API_KEY_STORAGE, key)
    setApiKey(key)
    setKeyDialogOpen(false)
    setError(null)
    setCatalogWarning(null)
  }

  function clearApiKey() {
    localStorage.removeItem(API_KEY_STORAGE)
    setApiKey(null)
    setKeyDialogOpen(true)
  }

  const canSend = Boolean(input.trim()) && Boolean(model) && !sending

  async function send() {
    const text = input.trim()
    if (!text || !model || sending) return

    if (!apiKey) {
      setKeyDialogOpen(true)
      return
    }

    setError(null)
    setInput("")
    const userMsg: Message = { id: newId(), role: "user", content: text }
    const assistantId = newId()
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: "assistant", content: "" }])
    setSending(true)

    const history = [
      artifactSystemMessage(),
      ...[...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ]

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: authHeaders(apiKey),
        body: JSON.stringify({ model, messages: history }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string
          needsApiKey?: boolean
        } | null
        if (data?.needsApiKey) {
          setKeyDialogOpen(true)
        }
        throw new Error(data?.error || `Request failed (${res.status})`)
      }

      if (!res.body) throw new Error("No response stream")

      await readSseStream(
        res.body,
        (delta) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + delta } : m))
          )
        },
        controller.signal
      )
    } catch (err) {
      if (controller.signal.aborted) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId && !m.content ? { ...m, content: "_(stopped)_" } : m
          )
        )
      } else {
        const message = err instanceof Error ? err.message : "Chat failed"
        setError(message)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId && !m.content ? { ...m, content: `Error: ${message}` } : m
          )
        )
      }
    } finally {
      abortRef.current = null
      setSending(false)
      textareaRef.current?.focus()
    }
  }

  function stop() {
    abortRef.current?.abort()
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  function openArtifact(id: string) {
    setActiveArtifactId(id)
    setArtifactPanelOpen(true)
  }

  return (
    <div className="product-surface-dot-grid flex h-dvh flex-col">
      <ApiKeyDialog
        open={keyDialogOpen}
        initialValue={apiKey || ""}
        required={!apiKey}
        onSave={saveApiKey}
        onClose={apiKey ? () => setKeyDialogOpen(false) : undefined}
      />

      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-sm">
        <div>
          <h1 className="text-sm font-semibold tracking-tight">LLM Playground</h1>
          <p className="text-xs text-muted-foreground">
            Pick any model · chat + downloadable docs
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setKeyDialogOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            title={apiKey ? "Update API key" : "Add API key"}
          >
            <KeyRound className="size-3.5" aria-hidden />
            {apiKey ? "API key" : "Add API key"}
          </button>
          {apiKey ? (
            <button
              type="button"
              onClick={clearApiKey}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            >
              Clear key
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              stop()
              setMessages([])
              setError(null)
              setArtifactPanelOpen(false)
              setActiveArtifactId(null)
            }}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            New chat
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-[52rem] flex-col gap-6 px-4 py-8">
              {messages.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center py-24 text-center">
                  <p className="text-base font-medium text-foreground">Message any model</p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Ask for a doc and it will open in the artifact panel with a download button —
                    no agent tools required.
                  </p>
                </div>
              ) : (
                messages.map((m) => {
                  const artifacts =
                    m.role === "assistant" ? extractArtifacts(m.content, m.id) : []
                  const display =
                    m.role === "assistant" && artifacts.length > 0
                      ? stripArtifactFences(m.content, artifacts)
                      : m.content

                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "flex w-full",
                        m.role === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      {m.role === "user" ? (
                        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-foreground px-4 py-2.5 text-[0.9375rem] leading-relaxed text-background">
                          {m.content}
                        </div>
                      ) : (
                        <div className="max-w-[85%]">
                          <div className="prose-chat text-[0.9375rem] text-foreground">
                            {display ? (
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{display}</ReactMarkdown>
                            ) : sending && !artifacts.length ? (
                              <span className="inline-flex gap-1 text-muted-foreground">
                                <span className="animate-pulse">●</span>
                                <span className="animate-pulse [animation-delay:120ms]">●</span>
                                <span className="animate-pulse [animation-delay:240ms]">●</span>
                              </span>
                            ) : null}
                          </div>
                          <ArtifactChips files={artifacts} onOpen={openArtifact} />
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="pointer-events-none shrink-0 px-4 pb-4 pt-2">
            <div className="pointer-events-auto mx-auto w-full max-w-[52rem]">
              {catalogWarning ? (
                <p className="mb-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                  {catalogWarning}
                </p>
              ) : null}
              {error ? (
                <p className="mb-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              ) : null}

              <div className="overflow-hidden rounded-none border border-border/60 bg-background shadow-[0_8px_28px_rgba(15,23,42,0.08)]">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={
                    apiKey ? "Message… (try “write a one-pager as a markdown file”)" : "Add an API key to chat…"
                  }
                  disabled={sending}
                  rows={2}
                  className={cn(
                    "composer-input block w-full min-h-[3.25rem] resize-none bg-transparent px-4 pt-3 pb-1",
                    "text-base leading-normal sm:text-[0.9375rem] sm:leading-relaxed",
                    "placeholder:text-muted-foreground/80 focus-visible:outline-none disabled:opacity-50"
                  )}
                />

                <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5 pt-1">
                  <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
                    <ModelPicker
                      value={model}
                      onChange={setModel}
                      models={models}
                      loading={modelsLoading}
                      disabled={sending}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!sending && !canSend}
                    onClick={sending ? stop : () => void send()}
                    className="flex size-9 items-center justify-center rounded-full bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
                    aria-label={sending ? "Stop" : "Send"}
                  >
                    {sending ? (
                      <Square className="size-3.5 fill-current" aria-hidden />
                    ) : (
                      <ArrowUp className="size-4" aria-hidden />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {artifactPanelOpen && allArtifacts.length > 0 ? (
          <div className="hidden min-h-0 md:flex">
            <ArtifactPanel
              files={allArtifacts}
              activeId={activeArtifactId}
              onSelect={setActiveArtifactId}
              onClose={() => setArtifactPanelOpen(false)}
            />
          </div>
        ) : null}
      </div>

      {/* Mobile: full-screen artifact overlay */}
      {artifactPanelOpen && allArtifacts.length > 0 ? (
        <div className="fixed inset-0 z-50 bg-background md:hidden">
          <ArtifactPanel
            files={allArtifacts}
            activeId={activeArtifactId}
            onSelect={setActiveArtifactId}
            onClose={() => setArtifactPanelOpen(false)}
          />
        </div>
      ) : null}
    </div>
  )
}
