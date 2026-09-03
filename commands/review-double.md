---
description: Claude + Gemini 2-worker adversarial review (multi-llm-review --mode double shortcut)
group: review
---

# /review-double

`/multi-llm-review` `--mode double` shortcut wrapper.

```
/review-double <target-file> [--stage plan|code|test|final] [--cr on|degrade|off] [--no-codex]
```

→ `/multi-llm-review <target-file> --mode double [--stage <stage>] [--cr <crMode>]`

**`--cr` / `--no-codex`**: worker control.
- `--cr degrade` (default): Claude + Gemini 2-worker (no Codex required)
- `--cr on`: Codex + Gemini 2-worker (requires `mcp__codex__codex` + ChatGPT subscription)
- `--no-codex`: same as `--cr degrade`
- `--cr off`: Gemini 1-worker only

## Workflow Execution

```js
// CR_MODE = (--no-codex → 'degrade') || (--cr value) || 'degrade'
Workflow({
  script: Bash("cat ~/.claude/skills/multi-llm-review/workflow.js"),
  args: { slug: SLUG, targetPath: TARGET_PATH, mode: 'double', stage: STAGE, crMode: CR_MODE }
})
```

Fallback (`CLAUDE_CODE_DISABLE_WORKFLOWS=1`): run multi-llm-review directly via Agent.

## Output

```
${CR_OUTPUT_DIR:-.multi-llm-review}/reviews/{stage}/{slug}-multi-llm-review.json
```
