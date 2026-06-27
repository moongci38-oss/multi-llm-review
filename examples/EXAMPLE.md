# Example: a real review run

This is **actual output** from `multi-llm-review` running in `double` mode (Claude + Gemini) against a small Express service with deliberate defects. Two models reviewed it in parallel, each blind to the other; their findings were merged and weighted into one verdict.

## Input

```js
// user-service.js
const mysql = require('mysql');
const DB_PASSWORD = "P@ssw0rd123!";                       // (1)
const db = mysql.createConnection({ /* ... */ password: DB_PASSWORD });

function getUser(req, res) {
  const id = req.query.id;
  const query = "SELECT * FROM users WHERE id = " + id;    // (2)
  db.query(query, (err, rows) => {
    res.json(rows[0]);                                     // (3)
  });
}

function applyDiscount(price, percent) {
  return price - (price * percent);                        // (4)
}
```

## Command

```
/review-double --stage code
```

## Output

```
verdict: FAIL   (combined score 62.8 — weighted merge of two reviewers)
reviewers: 2    (primary: 48/100 · gemini: 85/100)
findings: 11 raw → deduped, confidence-scored, Fix-First ordered
```

### What each model caught — different lenses, different blind spots

**Primary (Claude / Sonnet) — security · correctness · architecture**

| Severity | Finding |
|---|---|
| 🔴 critical | **SQL injection** — `req.query.id` concatenated straight into the query (`id=1 OR 1=1`). Use parameterized queries. |
| 🔴 critical | **Hardcoded credential** — `DB_PASSWORD` literal leaks permanently into git history. |
| 🔴 critical | **Discount logic** — `price - (price * percent)` makes a 20% discount subtract **20×** the price. Should divide by 100. |
| 🟠 high | **Unhandled `err`** — ignored in the db callback; `rows[0]` throws and crashes the process on any query error. |
| 🟡 medium | *(beyond the seeded flaws)* No empty-array guard — `res.json(undefined)` returns 200 with empty body, hiding not-found. |
| 🟡 medium | *(beyond the seeded flaws)* Single `createConnection` instead of a pool — concurrent requests block. |
| 🔵 low | Deprecated `mysql` package — `mysql2` supports prepared statements (would kill the injection vector). |

**Gemini — naming · cross-reference · consistency**

| Severity | Finding |
|---|---|
| 🟡 medium | **Naming-contract violation** — `percent` implies "out of 100", but it's used as a raw fraction. The bug is rooted in a misleading name, not just arithmetic. |
| 🔵 low | Inconsistent quote style (single vs double) across the file. |
| 🔵 low | `db` is too generic for a connection instance. |

### Why two models

The primary reviewer found the **exploitable security holes and the crash path**. Gemini independently flagged the **naming-contract violation** behind the discount bug — reframing it from "arithmetic typo" to "the parameter name lies about its contract." Neither lens alone is complete; the merge is.

> Add the **Codex / GPT** reviewer (`/review-triple`) for a third independent panelist on security and YAGNI.

---

*Reproduce: this exact run is the project's E2E fixture. The defects are intentional and labeled.*
