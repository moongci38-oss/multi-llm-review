---
name: multi-llm-review
description: "Multi-LLM parallel adversarial review — Claude (Fable 5.1) + Gemini double (default) or + Codex / GPT-5.6 triple (opt-in). Weighted score merge, dedup+confidence scoring, plateau detection, completeness critic, per-finding refute."
input: target-file path + mode (double|triple) + stage (plan|code|test|final)
output: "${CR_OUTPUT_DIR:-.multi-llm-review}/reviews/{stage}/{slug}-multi-llm-review.json"
eval_cases: off
---

# /multi-llm-review

Claude (Fable 5.1) + Gemini (double, default) or + Codex / GPT-5.6 (triple, opt-in) parallel adversarial review with weighted Triage verdict.

## Quick Start

```bash
# Double — Claude + Gemini (default, no extra keys needed beyond GEMINI_API_KEY)
/review-double path/to/my-code.ts

# Triple — Claude + Codex + Gemini (requires Codex MCP + ChatGPT subscription)
/review-triple path/to/important-spec.md --cr on
```

## Modes

| Mode | Workers | Score |
|------|---------|-------|
| Double (default) | Claude + Gemini | `claude×0.35 + gemini×0.3 / 0.65` |
| Triple (opt-in) | Claude + Codex + Gemini | `claude×0.35 + codex×0.35 + gemini×0.3` |

## BYO-key Requirements

| Capability | Requirement |
|------------|-------------|
| Claude (Fable 5.1) | Claude Code built-in |
| Gemini review | `GEMINI_API_KEY` env (read by gemini-text MCP server) |
| Codex / GPT-5.6 triple | `mcp__codex__codex` tool + ChatGPT subscription; pass `crMode:'on'` |
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
crMode: 'degrade'  (default) → Claude + Gemini only
crMode: 'on'                 → Claude + Codex + Gemini (requires Codex MCP)
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

### Which legs get scored

A leg that **crashed**, returned an **empty result**, or **declared itself unable to review**
did not review anything. Its `0` means "no opinion", not "this code is terrible" — so it is
excluded from the score. Excluded legs are logged with the reason.

| Leg state | Scored? | Findings still gate? |
|---|:--:|:--:|
| normal review | ✅ | ✅ |
| threw / `_error` | ❌ | ✅ |
| empty (no summary, no findings, ~0 score) | ❌ | ✅ |
| summary starts with `INCONCLUSIVE(<reason>)` | ❌ | ✅ |

A leg can be dropped from scoring and still have reported a real CRITICAL — losing that
finding would be worse than the score distortion. So **the gate spans every leg**, scored or not.

### Weights

Weights are keyed by **vendor**, never by array position, and are **renormalized over the legs
that survived**. A missing leg redistributes its weight instead of counting as a zero.

| Mode | Weights |
|------|---------|
| Double | `primary 0.6 · gemini 0.4` |
| Triple | `primary 0.35 · codex 0.35 · gemini 0.30` |

Full panels reproduce the historical numbers exactly; see `test/verdict.test.mjs`.

### Verdict

| Verdict | Condition |
|---------|-----------|
| PASS | combined ≥ 80 AND no HIGH issues AND ≥ 2 legs scored AND no INCONCLUSIVE leg |
| WARN | combined ≥ 60, or a PASS capped by the two rules below |
| FAIL | any CRITICAL issue, OR **zero** legs scored (quorum failure), OR combined < 60 |
| SKIP | fallow: no 24h change + prior review on record |

Two caps turn a PASS into a WARN:
- **single-leg cap** — only one leg produced a review. That is a supported mode
  (see README "Claude only"), but a single model reviewing alone is not a panel PASS.
- **inconclusive cap** — a leg said it could not run. An unrun check is not a passed check.

### `evidenceTier` — how much the verdict is worth

`PASS`/`WARN`/`FAIL` alone cannot tell a downstream gate whether a PASS came from a full panel
or from one surviving leg. `evidenceTier` does:

| Tier | Meaning |
|---|---|
| `full` | every expected leg scored, none inconclusive |
| `degraded` | some leg missing, capped, or inconclusive — verdict is advisory |
| `unverified` | no leg scored; there is no review here at all |

### `groupthink` — independence check

Independent reviewers are the whole premise. If every leg agrees on everything
(unanimity ≥ 0.8) or the legs restate each other (echo ≥ 0.2), that is either a genuinely
clean diff or legs that are not independent — and the tool cannot tell which. It reports
`groupthink { unanimity, echo, flag }` instead of letting the agreement inflate confidence.

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
