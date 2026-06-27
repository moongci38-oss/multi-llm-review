# Multi-LLM Review

> Your code, reviewed in parallel by **multiple AI models at once** — then their findings are merged, de-duplicated, and adversarially refuted before you ever see them.

A [Claude Code](https://code.claude.com) plugin. One model reviewing your diff has blind spots. **Multi-LLM Review** runs **Claude + Gemini** (and optionally **Codex / GPT**) as independent reviewers in parallel, each blind to the others, then reconciles their verdicts into a single scored report — keeping only the findings that survive a refutation pass.

```
/review-triple --stage code
```

```
  Claude (Sonnet) ─┐
  Gemini          ─┼─►  merge + dedup ─►  refute weak findings ─►  verdict (PASS / WARN / FAIL)
  Codex / GPT     ─┘        (confidence)       (per-finding)
```

## Why

A single reviewer — human or AI — misses what it isn't looking for. Different models have different blind spots. Running them **in parallel and independently**, then forcing the findings through dedup + an adversarial refutation pass, surfaces real issues while filtering out the plausible-but-wrong ones a single model would assert with false confidence.

- **Parallel, independent reviewers** — each model reviews blind to the others (no anchoring).
- **Weighted merge** — verdicts combined by configurable weight, not naive averaging.
- **Dedup with confidence scoring** — the same issue found by N models ranks higher.
- **Plateau detection** — stops looping when rounds stop finding anything new.
- **Completeness critic** — a final pass asking "what did everyone miss?"
- **Per-finding refutation** — each finding must survive a skeptic before it ships.

## Install

```
/plugin marketplace add moongci38-oss/multi-llm-review
/plugin install multi-llm-review
```

## Usage

```
/review-double  --stage code     # Claude + Gemini   (2-model, default)
/review-triple  --stage code     # Claude + Gemini + Codex/GPT  (3-model)
```

Stages: `code` · `test` · `final` · `analysis`. Point it at a diff, a file, or a PR.

📋 **[See a real run →](examples/EXAMPLE.md)** — two models reviewing a flawed service, each catching what the other missed.

## Models & keys (bring your own)

Multi-LLM Review degrades gracefully — it works with whatever you have:

| Models available | What runs |
|---|---|
| Claude only | single-reviewer (always available in Claude Code) |
| Claude + Gemini | **2-model review (default)** |
| Claude + Gemini + Codex/GPT | full 3-model panel |

- **Gemini** — set `GEMINI_API_KEY`. Without it, Gemini reviewer is skipped.
- **Codex / GPT** — requires the [Codex MCP](https://github.com/openai/codex) configured in Claude Code. Without it, the tool auto-falls back to the 2-model mode (`crMode: degrade` is the default).
- **Output location** — review reports and audit logs are written under `CR_OUTPUT_DIR` (default: `./.multi-llm-review/`).

No model is mandatory except Claude. Add keys to scale up; nothing breaks if you don't.

## Requirements

- [Claude Code](https://code.claude.com)
- (optional) `GEMINI_API_KEY` for the Gemini reviewer
- (optional) Codex MCP for the GPT reviewer
- (optional) [GitNexus](https://github.com/) MCP for structural code context — enhances review when present, skipped when absent

## License

MIT © [moongci38-oss](https://github.com/moongci38-oss)
