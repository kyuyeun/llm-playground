"use client"

import { useEffect, useState } from "react"
import { KeyRound, ExternalLink } from "lucide-react"

export const API_KEY_STORAGE = "llm-playground-mock.openrouterApiKey"

type Props = {
  open: boolean
  initialValue?: string
  onSave: (key: string) => void
  onClose?: () => void
  /** When true, dialog can't be dismissed without a key. */
  required?: boolean
}

export function ApiKeyDialog({ open, initialValue = "", onSave, onClose, required }: Props) {
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setValue(initialValue)
      setError(null)
    }
  }, [open, initialValue])

  if (!open) return null

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) {
      setError("Paste your OpenRouter API key to continue.")
      return
    }
    onSave(trimmed)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-key-title"
        className="w-full max-w-md border border-border/60 bg-background p-5 shadow-[0_16px_48px_rgba(15,23,42,0.18)]"
      >
        <div className="mb-4 flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center bg-muted text-foreground">
            <KeyRound className="size-4" aria-hidden />
          </span>
          <div>
            <h2 id="api-key-title" className="text-sm font-semibold tracking-tight">
              OpenRouter API key
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Stored only in this browser&apos;s local storage. Used to load models and stream chat.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">API key</span>
            <input
              type="password"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                setError(null)
              }}
              placeholder="sk-or-v1-…"
              className="w-full border border-border/70 bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}

          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Get a key at openrouter.ai/keys
            <ExternalLink className="size-3" aria-hidden />
          </a>

          <div className="flex items-center justify-end gap-2 pt-1">
            {!required && onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            ) : null}
            <button
              type="submit"
              className="bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:bg-foreground/90"
            >
              Save key
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
