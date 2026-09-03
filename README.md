# Multi-LLM Review

> Your code, reviewed in parallel by **multiple AI models at once** — then their findings are merged, de-duplicated, and adversarially refuted before you ever see them.

A [Claude Code](https://code.claude.com) plugin. One model reviewing your diff has blind spots. **Multi-LLM Review** runs **Claude + Gemini** (and optionally **Codex / GPT**) as independent reviewers in parallel, each blind to the others, then reconciles their verdicts into a single scored report — keeping only the findings that survive a refutation pass.

```
/review-triple --stage code
```

```
  Claude (Fable 5.1) ─┐
  Gemini             ─┼─►  merge + dedup ─►  refute weak findings ─►  verdict (PASS / WARN / FAIL)
  Codex / GPT-5.6    ─┘        (confidence)       (per-finding)
```

## Why

A single reviewer — human or AI — misses what it isn't looking for. Different models have different blind spots. Running them **in parallel and independently**, then forcing the findings through dedup + an adversarial refutation pass, surfaces real issues while filtering out the plausible-but-wrong ones a single model would assert with false confidence.

- **Parallel, independent reviewers** — each model reviews blind to the others (no anchoring).
- **Weighted merge** — verdicts combined by configurable weight, not naive averaging.
- **Dedup with confidence scoring** — the same issue found by N models ranks higher.
- **Plateau detection** — stops looping when rounds stop finding anything new.
- **Completeness critic** — a final pass asking "what did everyone miss?"
- **Per-finding refutation** — each finding must survive a skeptic before it ships.
- **A dead reviewer is not a bad review** — a leg that crashed, came back empty, or said it
  could not run is dropped from the score instead of averaging in as a zero. Its findings
  still count against the gate.
- **A verdict you can weigh** — every result carries an `evidenceTier`
  (`full` / `degraded` / `unverified`), so a PASS from one surviving reviewer is never
  mistaken for a PASS from the full panel.
- **Independence is checked, not assumed** — if the panel agrees on everything, that is
  reported (`groupthink`) rather than counted as extra confidence.

## Does it actually catch anything?

These are our own production runs, not a benchmark — we built this because we kept getting
burned by single-model reviews on our own code. Scores are per-leg (0-100).

**1. The same diff, a 51-point spread.**
A game-client change scored **Claude 83 · GPT-5.6 32 · Gemini 80** → combined 64.3, verdict FAIL,
24 findings. Two models thought it was basically fine. One thought it was broken. They were
looking at identical input. Whichever single model you had picked, you would have gotten a
confident answer — and a one-in-three chance it was the wrong one.

**2. A model approving its own work.**
Claude wrote a 299-line product spec, and a Claude-only multi-perspective review passed it
(one blocking issue, resolved). A cross-vendor pass on the *same approved document* came back
FAIL with **12 findings — all 12 accepted, zero rebutted.** Same-vendor review is not an
independent check; it shares the blind spot that produced the work.

**3. Disagreement is the signal.**
A design document scored **Claude 72 · GPT-5.6 52 · Gemini 96** — 12 findings, 11 accepted in
full, 1 in part, zero rebutted. The 44-point gap between the highest and lowest reviewer is
the part a single-model review structurally cannot show you.

The pattern in all three: **the panel's disagreement located the problem.** A lone reviewer
returns a number with no error bar. This returns the spread, then makes each finding survive
a refutation pass before you see it.

## Install

```
/plugin marketplace add moongci38-oss/multi-llm-review
/plugin install multi-llm-review
```

## Usage

```
/review-double  --stage code     # Claude + Gemini   (2-model, default)
/review-triple  --stage code     # Claude + Gemini + Codex / GPT-5.6  (3-model)
```

Stages: `code` · `test` · `final` · `analysis`. Point it at a diff, a file, or a PR.

📋 **[See a real run →](examples/EXAMPLE.md)** — two models reviewing a flawed service, each catching what the other missed.

## Models & keys (bring your own)

Multi-LLM Review degrades gracefully — it works with whatever you have:

| Models available | What runs |
|---|---|
| Claude only | single-reviewer (always available in Claude Code) |
| Claude + Gemini | **2-model review (default)** |
| Claude + Gemini + Codex / GPT-5.6 | full 3-model panel |

**Defaults as of v0.2.0** — Claude leg: **Fable 5.1** · Gemini leg: **gemini-3.8-flash** · Codex leg: **gpt-5.6-sol**. Every leg is overridable (see below); the weights are per *vendor*, not per model, so swapping a model does not change the scoring math.

- **Gemini** — set `GEMINI_API_KEY`. Override the model with `GEMINI_REVIEW_MODEL` or the `geminiModel` run arg. Without a key, the Gemini reviewer is skipped.
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
