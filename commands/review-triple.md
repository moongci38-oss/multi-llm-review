---
description: Sonnet + Codex + Gemini 3-worker adversarial review (multi-llm-review --mode triple shortcut). Use for plateau escalation or high-stakes spec review.
group: review
---

# /review-triple

`/multi-llm-review` `--mode triple` shortcut wrapper.

```
/review-triple <target-file> [--stage plan|code|test|final] [--cr on|degrade|off] [--no-codex]
```

→ `/multi-llm-review <target-file> --mode triple [--stage <stage>] [--cr <crMode>]`

**`--cr` / `--no-codex`**: worker control.
- `--cr on` (recommended for triple): Sonnet + Codex + Gemini 3-worker
- `--cr degrade` or `--no-codex`: Sonnet + Gemini 2-worker (Codex excluded — rate-limit protection / Codex MCP unavailable)
- `--cr off`: same as `degrade`

Note: Without `--cr on`, triple mode falls back to 2-worker (Sonnet+Gemini). For true 3-LLM triple, pass `--cr on` and ensure `mcp__codex__codex` is available.

## Trigger Conditions

- Plateau detected (2+ rounds with delta < 5) — escalate from /review-double
- High-stakes spec or final merge review
- Explicit user request

## Workflow Execution

```js
// --cr parse: CR_ARG from '--cr <val>' or '--no-codex'
// CR_MODE = (--no-codex → 'degrade') || (--cr value) || 'on'
Workflow({
  script: Bash("cat ~/.claude/skills/multi-llm-review/workflow.js"),
  args: { slug: SLUG, targetPath: TARGET_PATH, mode: 'triple', stage: STAGE, crMode: CR_MODE }
})
```

`crMode:'on'` → full 3-LLM behavior.
`crMode:'degrade'`/`'off'` → Codex worker and ApproveWorker skipped; Sonnet+Gemini only.

Fallback (`CLAUDE_CODE_DISABLE_WORKFLOWS=1`): run multi-llm-review directly via Agent.

## Output

```
${CR_OUTPUT_DIR:-.multi-llm-review}/reviews/{stage}/{slug}-multi-llm-review.json
```
