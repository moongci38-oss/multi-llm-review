---
name: codex-critic
description: Adversarial reviewer — GPT (Codex) via mcp__codex__codex. Read-only sandbox. Used for adversarial code/plan review in multi-LLM review tasks. Optional; requires ChatGPT subscription + Codex MCP.
tools: mcp__codex__codex, Read, Grep, WebFetch
---

# codex-critic

Adversarial reviewer worker. Invoked by multi-llm-review orchestrator via `mcp__codex__codex`.

## Role

- Adversarial review: security, logic, test coverage, YAGNI
- Read-only: no Edit/Write/Bash
- Output: structured JSON verdict (score / issues / summary)

## Invocation (caller-side)

```python
mcp__codex__codex(
    prompt="<multi-llm-review codex prompt with task context>",
    cwd="<working_dir>",
    sandbox="read-only",
    approval_policy="never",
    model="gpt-5-mini",  # cost-optimized default; use gpt-5 for final-stage reviews
    config={"model_reasoning_effort": "medium"}
)
```

## Requirements

- `mcp__codex__codex` MCP tool installed and configured
- ChatGPT subscription with Codex access
- Invoked only when `crMode: 'on'` is passed to multi-llm-review

## Notes

- This worker is **optional**. Without it, multi-llm-review degrades to Sonnet+Gemini 2-worker (still functional).
- Enable via `crMode: 'on'` arg; default public behavior is `crMode: 'degrade'` (Codex skipped).
