export type ArtifactFile = {
  id: string
  name: string
  language: string
  content: string
  /** True while the closing fence has not arrived yet. */
  streaming?: boolean
}

const SYSTEM_PROMPT = `You are a helpful assistant in a simple multi-model chat playground.

When the user asks you to create, draft, write, export, or deliver a document/file (markdown, HTML, code, CSV, JSON, etc.), include the full file contents in a fenced block whose info string starts with "file:" followed by the filename.

Example:
\`\`\`file:quarterly-summary.md
# Quarterly summary
...
\`\`\`

Rules:
- You may include multiple files in one reply, each in its own file: fence.
- Put a short spoken reply outside the fences; put the full document body only inside the fences.
- Prefer real filenames with extensions (.md, .html, .txt, .csv, .json, .py, .ts, etc.).
- For ordinary Q&A that does not need a downloadable file, answer normally without file: fences.`

/** Info-string forms: file:name.ext | name.ext | lang name.ext */
const FENCE_RE =
  /```([^\n`]*)\n([\s\S]*?)(?:```|$)/g

function looksLikeFilename(token: string): boolean {
  const t = token.trim()
  if (!t || t.includes(" ") || t.length > 180) return false
  if (t.startsWith("file:")) return true
  return /\.[a-z0-9]{1,12}$/i.test(t)
}

function parseFenceMeta(info: string): { name: string; language: string } | null {
  const raw = info.trim()
  if (!raw) return null

  // file:report.md  |  file report.md
  const filePrefix = raw.match(/^file\s*:?\s*(.+)$/i)
  if (filePrefix) {
    const name = filePrefix[1].trim().replace(/^["']|["']$/g, "")
    if (!name) return null
    return { name, language: extensionLanguage(name) }
  }

  // markdown:notes.md | html:index.html
  const langFile = raw.match(/^([a-z0-9_+-]+)\s*:\s*(.+\.[a-z0-9]{1,12})$/i)
  if (langFile && looksLikeFilename(langFile[2])) {
    return { name: langFile[2].trim(), language: langFile[1].toLowerCase() }
  }

  // python script.py  |  md README.md
  const parts = raw.split(/\s+/).filter(Boolean)
  if (parts.length >= 2 && looksLikeFilename(parts[parts.length - 1]!)) {
    const name = parts[parts.length - 1]!
    const language = parts[0] === name ? extensionLanguage(name) : parts[0]!.toLowerCase()
    return { name, language }
  }

  // Bare filename as the only info string: report.md
  if (looksLikeFilename(raw) && /\./.test(raw)) {
    return { name: raw, language: extensionLanguage(raw) }
  }

  return null
}

function extensionLanguage(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "text"
  const map: Record<string, string> = {
    md: "markdown",
    markdown: "markdown",
    html: "html",
    htm: "html",
    json: "json",
    csv: "csv",
    tsv: "tsv",
    txt: "text",
    py: "python",
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    css: "css",
    yml: "yaml",
    yaml: "yaml",
    sh: "bash",
    sql: "sql",
  }
  return map[ext] || ext
}

export function artifactSystemMessage(): { role: "system"; content: string } {
  return { role: "system", content: SYSTEM_PROMPT }
}

/**
 * Extract downloadable artifacts from assistant markdown.
 * Incomplete trailing fences (still streaming) are included with streaming: true.
 */
export function extractArtifacts(content: string, messageId: string): ArtifactFile[] {
  const out: ArtifactFile[] = []
  let match: RegExpExecArray | null
  const re = new RegExp(FENCE_RE.source, "g")

  while ((match = re.exec(content)) !== null) {
    const info = match[1] || ""
    const body = match[2] ?? ""
    const meta = parseFenceMeta(info)
    if (!meta) continue

    const closed = match[0].endsWith("```")
    const id = `${messageId}:${meta.name}:${out.length}`
    out.push({
      id,
      name: meta.name,
      language: meta.language,
      content: body.replace(/\n$/, ""),
      streaming: !closed,
    })
  }

  return out
}

/** Remove file fences from chat bubble text; keep a short placeholder list. */
export function stripArtifactFences(content: string, artifacts: ArtifactFile[]): string {
  if (artifacts.length === 0) return content

  let next = content
  for (const art of artifacts) {
    const escaped = art.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const patterns = [
      new RegExp("```[^\\n]*" + escaped + "[^\\n]*\\n[\\s\\S]*?(?:```|$)", "i"),
      new RegExp("```file\\s*:?\\s*" + escaped + "[^\\n]*\\n[\\s\\S]*?(?:```|$)", "i"),
    ]
    for (const pattern of patterns) {
      next = next.replace(pattern, "")
    }
  }

  next = next.replace(/\n{3,}/g, "\n\n").trim()
  return next
}

export function mimeForArtifact(file: ArtifactFile): string {
  const ext = file.name.split(".").pop()?.toLowerCase()
  switch (ext) {
    case "html":
    case "htm":
      return "text/html;charset=utf-8"
    case "md":
    case "markdown":
      return "text/markdown;charset=utf-8"
    case "json":
      return "application/json;charset=utf-8"
    case "csv":
      return "text/csv;charset=utf-8"
    case "svg":
      return "image/svg+xml;charset=utf-8"
    default:
      return "text/plain;charset=utf-8"
  }
}

export function downloadArtifact(file: ArtifactFile) {
  const blob = new Blob([file.content], { type: mimeForArtifact(file) })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = file.name
  a.click()
  URL.revokeObjectURL(url)
}
