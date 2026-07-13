/** Resolve OpenRouter key from browser header, then server env. */
export function resolveOpenRouterApiKey(req: Request): string | null {
  const fromHeader = req.headers.get("x-openrouter-api-key")?.trim()
  if (fromHeader) return fromHeader
  const fromEnv = process.env.OPENROUTER_API_KEY?.trim()
  return fromEnv || null
}
