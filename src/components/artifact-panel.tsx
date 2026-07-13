"use client"

import { Download, FileText, X } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { downloadArtifact, type ArtifactFile } from "@/lib/artifacts"
import { cn } from "@/lib/utils"

type Props = {
  files: ArtifactFile[]
  activeId: string | null
  onSelect: (id: string) => void
  onClose: () => void
}

export function ArtifactPanel({ files, activeId, onSelect, onClose }: Props) {
  const active = files.find((f) => f.id === activeId) || files[0]
  if (!active) return null

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-l border-border/60 bg-background md:w-[26rem] lg:w-[30rem]">
      <header className="flex shrink-0 items-start justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Artifact
          </p>
          <h2 className="truncate text-sm font-semibold">{active.name}</h2>
          {active.streaming ? (
            <p className="mt-0.5 text-xs text-muted-foreground">Generating…</p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">{active.language}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled={active.streaming || !active.content}
            onClick={() => downloadArtifact(active)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-40"
          >
            <Download className="size-3.5" aria-hidden />
            Download
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            aria-label="Close artifact panel"
          >
            <X className="size-4" />
          </button>
        </div>
      </header>

      {files.length > 1 ? (
        <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-border/60 px-3 py-2">
          {files.map((file) => (
            <button
              key={file.id}
              type="button"
              onClick={() => onSelect(file.id)}
              className={cn(
                "inline-flex max-w-[10rem] items-center gap-1 truncate rounded-full border px-2.5 py-1 text-[11px]",
                file.id === active.id
                  ? "border-foreground/25 bg-muted font-medium text-foreground"
                  : "border-border/60 text-muted-foreground hover:text-foreground"
              )}
            >
              <FileText className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{file.name}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {active.language === "html" ? (
          <iframe
            title={active.name}
            sandbox=""
            srcDoc={active.content}
            className="h-[min(70vh,36rem)] w-full rounded-md border border-border/60 bg-white"
          />
        ) : active.language === "markdown" || active.name.endsWith(".md") ? (
          <div className="prose-chat text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{active.content || " "}</ReactMarkdown>
          </div>
        ) : (
          <pre className="overflow-x-auto rounded-md bg-muted/50 p-3 text-[12px] leading-relaxed text-foreground">
            <code>{active.content}</code>
          </pre>
        )}
      </div>
    </aside>
  )
}

export function ArtifactChips({
  files,
  onOpen,
}: {
  files: ArtifactFile[]
  onOpen: (id: string) => void
}) {
  if (files.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {files.map((file) => (
        <button
          key={file.id}
          type="button"
          onClick={() => onOpen(file.id)}
          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px] text-muted-foreground hover:border-foreground/20 hover:text-foreground"
        >
          <FileText className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{file.name}</span>
          {file.streaming ? <span className="text-[10px] opacity-70">…</span> : null}
        </button>
      ))}
    </div>
  )
}
