# Security Policy

## BYO-Key Model

This plugin follows a strict **Bring Your Own Key** model. API keys are never stored, transmitted, or logged by this plugin.

- **Gemini**: `GEMINI_API_KEY` is read exclusively by the user-configured `gemini-text` MCP server. The plugin itself never reads or handles this value.
- **Codex/GPT**: Access is gated by the user's `mcp__codex__codex` MCP tool and their ChatGPT subscription. No credentials pass through this plugin.
- **Claude**: Uses Claude Code's built-in authentication (no additional key required).

## Data Handling

- Review target code is sent **only** to the LLMs the user has configured (Claude, Gemini, Codex). No third-party telemetry, analytics, or external endpoints are involved.
- All output (review results, audit logs, evidence JSON) is written exclusively to the local `CR_OUTPUT_DIR` directory (default: `.multi-llm-review/`). Nothing is uploaded or transmitted externally.
- The plugin does not persist review content beyond the local output directory.

## Vulnerability Reporting

If you discover a security vulnerability in this plugin:

- **Non-sensitive issues**: Open a GitHub Issue with the `security` label.
- **Sensitive or critical issues**: Use the repository's [Security Advisories](../../security/advisories/new) to report privately. Do not disclose publicly until a fix is available.

We aim to acknowledge reports within 5 business days and provide a fix or mitigation plan within 30 days for confirmed vulnerabilities.
