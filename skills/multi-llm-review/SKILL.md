---
name: multi-llm-review
description: "Multi-LLM parallel adversarial review — Claude(Sonnet) + Gemini double (default) or + Codex/GPT triple (opt-in). Weighted score merge, dedup+confidence scoring, plateau detection, completeness critic, per-finding refute."
input: target-file path + mode (double|triple) + stage (plan|code|test|final)
output: "${CR_OUTPUT_DIR:-.multi-llm-review}/reviews/{stage}/{slug}-multi-llm-review.json"
eval_cases: off
---

# /multi-llm-review

Claude(Sonnet) + Gemini (double, default) or + Codex/GPT (triple, opt-in) parallel adversarial review with weighted Triage verdict.

## Quick Start

```bash
# Double — Sonnet + Gemini (default, no extra keys needed beyond GEMINI_API_KEY)
/review-double path/to/my-code.ts

# Triple — Sonnet + Codex + Gemini (requires Codex MCP + ChatGPT subscription)
/review-triple path/to/important-spec.md --cr on
```

## Modes

| Mode | Workers | Score |
|------|---------|-------|
| Double (default) | Sonnet + Gemini | `sonnet×0.35 + gemini×0.3 / 0.65` |
| Triple (opt-in) | Sonnet + Codex + Gemini | `sonnet×0.35 + codex×0.35 + gemini×0.3` |

## BYO-key Requirements

| Capability | Requirement |
|------------|-------------|
| Claude (Sonnet/Haiku) | Claude Code built-in |
| Gemini review | `GEMINI_API_KEY` env (read by gemini-text MCP server) |
| Codex/GPT triple | `mcp__codex__codex` tool + ChatGPT subscription; pass `crMode:'on'` |
| GitNexus structural context | GitNexus MCP (optional; grace-degrades if unavailable) |

## Output

```
${CR_OUTPUT_DIR:-.multi-llm-review}/reviews/{stage}/{slug}-multi-llm-review.json
```

Evidence JSON format: `{verdict, score, issues[], mode, slug, degraded}`

Audit log: `${CR_OUTPUT_DIR:-.multi-llm-review}/audit/multi-llm-review-calls.jsonl`

## Workflow Execution

```js
Workflow({
  script: Bash("cat ~/.claude/skills/multi-llm-review/workflow.js"),
  args: { slug: SLUG, targetPath: TARGET, mode: 'triple', stage: STAGE }
})
```

Fallback (CLAUDE_CODE_DISABLE_WORKFLOWS=1): use Agent pattern directly.

## Optional Features

### crMode — Worker Control

```
crMode: 'degrade'  (default) → Sonnet + Gemini only
crMode: 'on'                 → Sonnet + Codex + Gemini (requires Codex MCP)
crMode: 'off'                → Gemini only
```

### crCompleteness — Completeness Critic

Haiku "what was missed" gate. Auto-on for `stage=final`. Opt-in for other stages.

```js
args: { ..., crCompleteness: true }
```

### crRefute — Per-Finding Skeptic Vote

Suppresses false-positive HIGH findings via majority skeptic vote.
**HARD RULE: security category + CRITICAL severity = always KEEP.**

```js
args: { ..., crRefute: true, crRefuteN: 3 }  // crRefuteN = number of skeptics (default 3)
```

### crLens — Lens Diversification

Differentiates worker review focus (holistic / security+correctness / spec-drift+perf).
Do not combine with `crCompleteness` simultaneously (completeness critic may misidentify lens-intentional omissions as gaps).

```js
args: { ..., crLens: true }
```

### GitNexus — Structural Context

If `mcp__gitnexus__*` tools are available, Phase 0 enriches review with changed symbols and upstream impact. If unavailable, `structuralCtx=null` and review continues normally.

## Scoring & Verdict

| Verdict | Condition |
|---------|-----------|
| PASS | combined ≥ 80 AND no HIGH issues |
| WARN | combined ≥ 60 (HIGH issues present) |
| FAIL | any CRITICAL issue OR quorum < 2 workers OR combined < 60 |
| SKIP | fallow: no 24h change + prior review on record |

## Plateau Detection

Two consecutive rounds with score delta < 5 = plateau signal.
Options: A more rounds / B override / C discard / D extreme simplification.

Pass `prevScore` arg for delta tracking:
```js
args: { ..., prevScore: 72.5 }
```

## Prohibited Behaviors

Workers must NOT:
1. Add issues without evidence to inflate/deflate scores
2. Re-raise resolved issues from prior rounds with new wording (fabrication)
3. Require enterprise features (HA, multi-tenancy, distributed transactions) for SME/MVP scope
4. Demand full redesign without understanding author's design intent
5. Recommend copying external code without license/attribution

## Requester Rules

6. Never skip review because "it's a small change"
7. Do not proceed past CRITICAL issues without Human approval
8. Review HIGH-severity issues before advancing on WARN verdict
9. Evaluate technical feedback content — do not accept/reject without reading
