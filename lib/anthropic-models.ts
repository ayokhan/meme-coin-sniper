/** Default Sonnet model (override via ANTHROPIC_SONNET_MODEL in env). */
export const CLAUDE_SONNET_MODEL =
  process.env.ANTHROPIC_SONNET_MODEL?.trim() || "claude-sonnet-4-6";
