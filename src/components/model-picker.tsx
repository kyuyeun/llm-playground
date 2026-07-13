"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, LayoutList, Search, X } from "lucide-react"

import {
  formatContext,
  formatPrice,
  modelDisplayName,
  type ModelEntry,
} from "@/lib/models"
import { cn } from "@/lib/utils"

type Pane = "suggested" | "search"

type Props = {
  value: string
  onChange: (id: string) => void
  models: ModelEntry[]
  loading?: boolean
  disabled?: boolean
}

function ProviderBadge({ provider }: { provider: string }) {
  const letter = (provider[0] || "?").toUpperCase()
  return (
    <span
      aria-hidden
      className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[3px] bg-muted text-[9px] font-semibold text-muted-foreground"
    >
      {letter}
    </span>
  )
}

function ModelRow({
  model,
  selected,
  onSelect,
  disabled,
}: {
  model: ModelEntry
  selected: boolean
  onSelect: () => void
  disabled?: boolean
}) {
  const meta = [formatContext(model.contextLength), formatPrice(model.promptPrice, model.completionPrice)]
    .filter(Boolean)
    .join(" · ")

  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        disabled={disabled}
        onClick={onSelect}
        className={cn(
          "flex w-full items-start gap-2.5 px-2 py-2.5 text-left text-sm transition-colors",
          "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:pointer-events-none disabled:opacity-50",
          selected ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <ProviderBadge provider={model.provider} />
        <span className="min-w-0 flex-1">
          <span className="block truncate leading-tight">{modelDisplayName(model, model.id)}</span>
          {meta ? (
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{meta}</span>
          ) : null}
        </span>
      </button>
    </li>
  )
}

export function ModelPicker({ value, onChange, models, loading, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [pane, setPane] = useState<Pane>("suggested")
  const [query, setQuery] = useState("")
  const rootRef = useRef<HTMLDivElement>(null)

  const selected = models.find((m) => m.id === value)
  const label = modelDisplayName(selected, value || "Select model")

  const suggested = useMemo(() => {
    const free = models.filter((m) => m.isFree).slice(0, 4)
    const paid = models.filter((m) => !m.isFree).slice(0, 10)
    return { free, paid }
  }, [models])

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return models.slice(0, 40)
    return models
      .filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.openrouterId.toLowerCase().includes(q) ||
          m.provider.toLowerCase().includes(q)
      )
      .slice(0, 60)
  }, [models, query])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  function pick(id: string) {
    onChange(id)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex max-w-[14rem] items-center gap-1 truncate rounded-md px-1.5 py-1 text-[11px] text-muted-foreground",
          "hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:pointer-events-none disabled:opacity-50"
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <ProviderBadge provider={selected?.provider || "m"} />
        <span className="truncate">{label}</span>
        <ChevronDown className="size-3 shrink-0 opacity-70" aria-hidden />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Select model"
          className="absolute bottom-full left-0 z-50 mb-2 flex h-[22rem] w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border/60 bg-popover text-popover-foreground shadow-[0_12px_40px_rgba(15,23,42,0.14)]"
        >
          <nav className="flex w-28 shrink-0 flex-col border-r border-border/60 bg-sidebar sm:w-32">
            {(
              [
                { id: "suggested" as const, label: "Suggested", icon: LayoutList },
                { id: "search" as const, label: "Search models", icon: Search },
              ] as const
            ).map((item) => {
              const Icon = item.icon
              const active = pane === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPane(item.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-3 text-left text-sm transition-colors",
                    active
                      ? "bg-muted/70 font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  )}
                >
                  <Icon className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{item.label}</span>
                </button>
              )
            })}
          </nav>

          <div className="flex min-w-0 flex-1 flex-col">
            {pane === "search" ? (
              <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
                <Search className="size-3.5 text-muted-foreground" aria-hidden />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search models…"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <p className="px-3 py-4 text-sm text-muted-foreground">Loading models…</p>
              ) : pane === "suggested" ? (
                <div className="py-1">
                  {suggested.free.length > 0 ? (
                    <>
                      <p className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Free models
                      </p>
                      <ul role="listbox">
                        {suggested.free.map((m) => (
                          <ModelRow
                            key={m.id}
                            model={m}
                            selected={m.id === value}
                            onSelect={() => pick(m.id)}
                            disabled={disabled}
                          />
                        ))}
                      </ul>
                    </>
                  ) : null}
                  <p className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Suggested
                  </p>
                  <ul role="listbox">
                    {suggested.paid.map((m) => (
                      <ModelRow
                        key={m.id}
                        model={m}
                        selected={m.id === value}
                        onSelect={() => pick(m.id)}
                        disabled={disabled}
                      />
                    ))}
                  </ul>
                </div>
              ) : (
                <ul role="listbox" className="py-1">
                  {searchResults.length === 0 ? (
                    <li className="px-3 py-4 text-sm text-muted-foreground">No models found</li>
                  ) : (
                    searchResults.map((m) => (
                      <ModelRow
                        key={m.id}
                        model={m}
                        selected={m.id === value}
                        onSelect={() => pick(m.id)}
                        disabled={disabled}
                      />
                    ))
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
