// Verdict-logic tests.
//
// workflow.js is a Workflow script (top-level await + agent()), so it cannot be imported.
// Instead we EXTRACT the real source of the pure helpers and evaluate them, so these tests
// exercise the shipped code — not a copy of it. If extraction fails the suite fails loudly;
// a test that silently stops testing is worse than no test.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'workflow.js')
const src = readFileSync(SRC, 'utf8')

function extract(startMarker, endMarker) {
  const a = src.indexOf(startMarker)
  if (a < 0) throw new Error(`extraction failed: marker not found: ${startMarker}`)
  const b = src.indexOf(endMarker, a)
  if (b < 0) throw new Error(`extraction failed: end marker not found: ${endMarker}`)
  return src.slice(a, b)
}

// helpers block: from INVALID_LEG_SCORE_MAX through the end of _groupthinkStats
const helpers = extract('const INVALID_LEG_SCORE_MAX', '// ── Phase 1: Review')
// weight table as shipped
const weights = extract('const LEG_WEIGHTS = mode', 'const scores = usableLegs')

const mk = (body) => new Function('mode', `${helpers}\n${weights}\nreturn (${body})`)

let pass = 0, fail = 0
const t = (name, fn) => {
  try { fn(); console.log(`  ok   ${name}`); pass++ }
  catch (e) { console.log(`  FAIL ${name}\n       ${e.message}`); fail++ }
}
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`) }
const ok = (v, m) => { if (!v) throw new Error(m) }

const api = mk(`{
  legValid: _legValid,
  legInconclusive: _legInconclusive,
  groupthink: _groupthinkStats,
  detectSubstitution,
  distinctExecutors: _distinctExecutors,
  weights: LEG_WEIGHTS,
  combine: (legs) => {
    const clamp = s => Math.max(0, Math.min(100, Number(s) || 0))
    const usable = legs.filter(_legValid)
    if (!usable.length) return 0
    const wSum = usable.reduce((a, r) => a + (LEG_WEIGHTS[r.worker] ?? 0), 0)
    return wSum > 0
      ? usable.reduce((a, r) => a + clamp(r.score) * (LEG_WEIGHTS[r.worker] ?? 0), 0) / wSum
      : usable.reduce((a, r) => a + clamp(r.score), 0) / usable.length
  },
}`)

const real = (w, score, summary = 'x'.repeat(60), issues = []) => ({ worker: w, score, summary, issues })

console.log('\n[leg validity]')
t('crashed leg is not scored', () => ok(!api('triple').legValid({ worker: 'gemini', score: 0, _error: true }), 'error leg accepted'))
t('empty leg is not scored', () => ok(!api('triple').legValid({ worker: 'codex', score: 0, summary: '', issues: [] }), 'empty leg accepted'))
t('real leg is scored', () => ok(api('triple').legValid(real('primary', 85)), 'real leg rejected'))
t('low score with real findings is still scored', () =>
  ok(api('triple').legValid({ worker: 'codex', score: 5, summary: 'short', issues: [{ severity: 'critical' }] }), 'genuine harsh review dropped'))
t('INCONCLUSIVE leg is not scored', () =>
  ok(!api('triple').legValid({ worker: 'gemini', score: 0, summary: 'INCONCLUSIVE(sandbox denied) could not read target', issues: [] }), 'inconclusive scored'))

console.log('\n[weights are vendor-keyed, not positional]')
t('full triple matches the historical 0.35/0.35/0.30 formula', () => {
  const got = api('triple').combine([real('primary', 80), real('codex', 60), real('gemini', 90)])
  eq(Number(got.toFixed(4)), Number((80 * 0.35 + 60 * 0.35 + 90 * 0.30).toFixed(4)), 'full-panel math drifted')
})
t('double matches the historical 0.6/0.4 formula', () => {
  const got = api('double').combine([real('primary', 80), real('gemini', 60)])
  eq(Number(got.toFixed(4)), Number((80 * 0.6 + 60 * 0.4).toFixed(4)), 'double math drifted')
})
t('dropped codex keeps gemini on 0.30, not 0.35', () => {
  // positional weighting would hand gemini codex's 0.35 slot and give a different number
  const got = api('triple').combine([real('primary', 80), real('gemini', 90)])
  eq(Number(got.toFixed(4)), Number(((80 * 0.35 + 90 * 0.30) / 0.65).toFixed(4)), 'weight mis-assigned after dropout')
})

console.log('\n[dead leg no longer drags the score]')
t('crashed gemini does not count as a zero', () => {
  const legs = [real('primary', 85), real('codex', 80), { worker: 'gemini', score: 0, summary: '', issues: [], _error: true }]
  const got = api('triple').combine(legs)
  const naive = 85 * 0.35 + 80 * 0.35 + 0 * 0.30 // 57.75 → the old FAIL
  ok(got > 80, `dead leg still dragging: got ${got.toFixed(2)}`)
  ok(Math.abs(got - naive) > 20, 'result indistinguishable from the naive average')
  eq(Number(got.toFixed(4)), Number(((85 * 0.35 + 80 * 0.35) / 0.70).toFixed(4)), 'renormalization wrong')
})

console.log('\n[groupthink]')
t('unanimous panel is flagged', () => {
  const legs = [real('primary', 90), real('codex', 90), real('gemini', 90)]
  const deduped = [{ _count: 3 }, { _count: 3 }, { _count: 3 }]
  ok(api('triple').groupthink(legs, deduped).flag, 'unanimity not flagged')
})
t('divergent panel is not flagged', () => {
  const legs = [
    real('primary', 90, undefined, [{ description: 'a' }]),
    real('codex', 40, undefined, [{ description: 'b' }]),
    real('gemini', 70, undefined, [{ description: 'c' }]),
  ]
  const deduped = [{ _count: 1 }, { _count: 1 }, { _count: 2 }]
  ok(!api('triple').groupthink(legs, deduped).flag, 'divergent panel wrongly flagged')
})
t('single leg cannot be judged for groupthink', () => eq(api('triple').groupthink([real('primary', 90)], []).flag, false, 'n<2 flagged'))

console.log('\n[worker substitution — self-reported provenance]')
const withProv = (w, exec) => ({ ...real(w, 80), provenance: { executed_by: exec, tool_called: 'x' } })

t('gemini leg answered by Claude is caught', () => {
  const subs = api('triple').detectSubstitution([withProv('gemini', 'claude-fable-5-1')])
  eq(subs.length, 1, 'substitution missed')
  eq(subs[0].worker, 'gemini', 'wrong worker reported')
})
t('codex leg answered by Claude is caught', () =>
  eq(api('triple').detectSubstitution([withProv('codex', 'claude-opus-5')]).length, 1, 'codex substitution missed'))
t('legs reporting their own vendor are clean', () => {
  const legs = [withProv('primary', 'claude-fable-5-1'), withProv('codex', 'gpt-5.6-sol'), withProv('gemini', 'gemini-3.8-flash')]
  eq(api('triple').detectSubstitution(legs).length, 0, 'false positive on a legitimate panel')
})
t('undeclared provenance is NOT treated as substitution', () =>
  eq(api('triple').detectSubstitution([real('gemini', 80)]).length, 0, 'undeclared wrongly flagged — silence is not guilt'))

console.log('\n[executor independence]')
t('three vendors = three distinct executors', () => {
  const legs = [withProv('primary', 'claude-fable-5-1'), withProv('codex', 'gpt-5.6-sol'), withProv('gemini', 'gemini-3.8-flash')]
  eq(api('triple').distinctExecutors(legs), 3, 'distinct executors miscounted')
})
t('three legs all run by Claude collapse to one executor', () => {
  const legs = [withProv('primary', 'claude-fable-5-1'), withProv('codex', 'claude-opus-5'), withProv('gemini', 'claude-sonnet-5')]
  eq(api('triple').distinctExecutors(legs), 1, 'single-executor panel not detected')
})
t('undeclared legs are counted per-leg, not collapsed', () => {
  // without provenance we cannot claim they are the same model — assuming so would
  // flag every legacy run as non-independent
  const legs = [real('primary', 80), real('codex', 80), real('gemini', 80)]
  eq(api('triple').distinctExecutors(legs), 3, 'undeclared legs wrongly collapsed')
})

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
