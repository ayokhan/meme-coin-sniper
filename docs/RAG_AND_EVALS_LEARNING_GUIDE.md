# NovaStaris — RAG & Evals Learning Guide

**Purpose:** Learn RAG (Retrieval-Augmented Generation) and AI evals using NovaStaris as a real product case study—for interviews and PM craft. **This guide is study material only; it does not change production.**

**Related:** `docs/AI_PM_ROADMAP.md`, `docs/NOVASTARIS_IMPLEMENTATION_ARCHITECTURE.md`, `lib/ai-analyze.ts`

---

## 1. Will this disrupt NovaStaris in production?

**Short answer: No—not unless you explicitly choose to ship it.**

| Activity | Touches live novastaris.ai? | Risk to current product |
|----------|----------------------------|-------------------------|
| **Reading this guide** | No | None |
| **Studying code** (`lib/ai-analyze.ts`, feedback tables) | No | None |
| **Local eval scripts** (run on your laptop against exported data) | No | None |
| **RAG prototype on a git branch** (never merged/deployed) | No | None |
| **RAG behind a feature flag, owner-only** | Only if you deploy | Low—you toggle off instantly |
| **RAG merged and deployed to prod** | Yes | Only if *you* approve merge + deploy |

**How NovaStaris stays safe:**

1. **Nothing deploys automatically.** Production updates only when you run `git push` and Vercel builds—or when you run `npx vercel --prod`. Study docs and local scripts never hit prod.
2. **Your product already uses feature flags** (`FeatureFlag` in Prisma, `lib/feature-flags.ts`). Any future RAG could be **off by default** and enabled only for owner testing.
3. **RAG is additive.** The current flow (DexScreener + GoPlus → Claude → JSON) stays the default. RAG would only *append* retrieved context to the prompt—reversible with a flag or env var like `RAG_ENABLED=false`.
4. **Evals are offline.** Eval scripts compare model outputs to labels; they do not change what users see unless you change prompts/models based on results.

**Interview line:** “We treat AI improvements as gated experiments: eval offline first, then owner-only flag, then broader rollout—never ship unmeasured changes to a live trading-intelligence product.”

**Recommendation for you:** Use this guide to **learn and interview prep**. If you ever want a hands-on prototype, we build it on a **separate branch**, test locally or owner-only, and **you decide** whether anything goes to prod.

### Agreed rollout policy (when RAG is built)

**Owner-only + feature flag OFF by default.** Pro/VIP users keep today’s AI exactly as-is until you explicitly widen access.

| Gate | Rule |
|------|------|
| **Feature flag** | `ai_analysis_rag` in Admin → Feature Flags — **default OFF** |
| **Who sees RAG** | **Owner only** (`isOwnerSession`) — even if flag is ON, non-owners never get retrieval or RAG UI |
| **Default analysis** | Flag OFF or non-owner → current path: DexScreener + GoPlus → Claude (unchanged) |
| **Owner + flag ON** | Retrieve top-k similar analyses → append to prompt; optional UI badge “RAG context used” |
| **Kill switch** | Turn flag OFF in admin — instant return to standard analysis, no deploy |

**Why both gates?** The flag lets you experiment without code deploys. Owner-only ensures no subscriber sees different scores or behavior until evals pass and you choose to expand.

**Planned implementation sketch (not live yet):**

```
POST /api/ai-analyze
  → if !getFeatureFlag('ai_analysis_rag') → runAiAnalysis() as today
  → if !isOwnerSession() → runAiAnalysis() as today
  → else → runAiAnalysis({ useRag: true })
       → UI shows retrieved snippets + “RAG (owner experiment)” badge
```

**Files to touch when you approve build:** `lib/feature-flags.ts` (new key + `DEFAULT_DISABLED_KEYS`), `lib/ai-analyze.ts`, `app/api/ai-analyze/route.ts`, AI Agent panel (owner-only RAG indicator), Admin → Feature Flags labels.

**Interview line:** “RAG ships behind a feature flag defaulting off and owner-only access first—we measure on evals, then decide if broader rollout is worth it.”

---

## 2. What is RAG? (NovaStaris lens)

**RAG = Retrieval-Augmented Generation**

Before Claude analyzes a token, you **retrieve** relevant past knowledge, then **augment** the prompt with it.

```
Today (no RAG):
  User pastes CA → DexScreener + GoPlus → tokenSummary → Claude → score/signal

With RAG:
  User pastes CA → DexScreener + GoPlus → tokenSummary
      → search vector DB for similar past analyses
      → append "Relevant past analyses: …" to prompt
      → Claude → score/signal
```

### Why RAG for NovaStaris?

| Problem without RAG | What RAG helps |
|---------------------|----------------|
| Same token analyzed twice with different scores | Retrieve last analysis for same CA |
| Low-liquidity tokens scored inconsistently | Retrieve similar tokens (by liq/vol/security) |
| Model ignores your playbook | Retrieve internal doc chunks (“honeypot = always no_buy”) |
| Good/bad feedback not used at inference | Retrieve analyses marked **bad** as negative examples |

### NovaStaris building blocks (already in prod)

| Piece | Where |
|-------|--------|
| Token context | `lib/ai-analyze.ts` → `tokenSummary` JSON |
| Inference hook | Same file, before `prompt = ...` (~line 95) |
| Labels for quality | `AiAnalysisFeedback` (good/bad, score, signal) |
| Other feedback | `NovaSmartFeedback`, `NovaFiveMinsOwnerFeedback` |
| Roadmap detail | `docs/AI_PM_ROADMAP.md` §3 |

### RAG stack (when you choose to build)

1. **Embed** — OpenAI `text-embedding-3-small` (or similar) on text like:  
   `"SYMBOL, liq $X, vol $Y, honeypot=no, score 62, signal no_buy, reasons: …"`
2. **Store** — `pgvector` in existing Postgres (table e.g. `analysis_embeddings`)
3. **Retrieve** — On new analysis, embed current summary → top-k cosine similarity
4. **Generate** — Append retrieved rows to Claude prompt in `runAiAnalysis()`

### Learning exercises (no prod impact)

| Exercise | Time | Outcome |
|----------|------|---------|
| Trace `runAiAnalysis()` end-to-end | 30 min | Know exact RAG insertion point |
| Write 3 fake “retrieved analyses” and paste into a prompt manually | 30 min | Feel how context changes answers |
| Read OpenAI embeddings + pgvector tutorial | 1 hr | Understand embed + search |
| Sketch `analysis_embeddings` table on paper | 20 min | Interview whiteboard ready |

---

## 3. What are evals? (NovaStaris lens)

**Evals = systematically measuring AI quality** against expectations—not gut feel.

You already have **implicit labels** in production:

| Model | Fields | Use in eval |
|-------|--------|-------------|
| `AiAnalysisFeedback` | `outcome` (good/bad), `score`, `signal`, `contractAddress` | Did the analysis match human judgment? |
| `NovaSmartFeedback` | `worked` (boolean), `symbol`, `strategy` | Futures/smart suggestions |
| `NovaFiveMinsOwnerFeedback` | `outcome`, `analysisSummary` | Short-horizon lean labels |

### Eval workflow (recommended order)

```
Step 1: Export labels     → JSONL from AiAnalysisFeedback
Step 2: Define metrics    → accuracy, calibration, regression
Step 3: Run baseline      → call current runAiAnalysis (or API) on each row
Step 4: Compare           → model signal vs expected from good/bad
Step 5: Change something  → prompt tweak, few-shot, or RAG
Step 6: Re-run eval       → same JSONL, compare metrics (regression test)
```

### Step 1 — Build an eval set

**Minimum viable eval set:** 50–200 rows.

Each row should include:

- **Input:** `contractAddress` (or full `tokenSummary` if you log it)
- **Expected:** derived from feedback  
  - `good` + `signal=buy` → expect buy or high score  
  - `bad` + `signal=buy` → expect no_buy or lower score  
  - `good` + `signal=no_buy` → expect no_buy  

**Gap today:** Feedback stores score/signal at click time but not always full `tokenSummary`. For stronger evals, start logging `(contractAddress, tokenSummary, modelOutput)` on each analysis (optional future enhancement—still can eval with CA only by re-fetching DexScreener).

**Export sources:**

- Admin → AI Feedback (UI)
- Direct DB query on `AiAnalysisFeedback`
- Future script: `scripts/export-ai-feedback-eval.ts`

### Step 2 — Metrics to report (interview gold)

| Metric | Definition | Why it matters |
|--------|------------|----------------|
| **Signal accuracy** | % where model `signal` matches expected | Binary quality |
| **Score calibration** | Score distribution for good vs bad | Avoid “everything is 75” |
| **Precision/recall (buy)** | Among predicted buys, how many were good? | Reduces false positives |
| **Regression delta** | Metric change after prompt/RAG change | Safe iteration |

**PM framing:** “We don’t ship prompt changes unless eval metrics hold or improve on a frozen test set.”

### Step 3 — Run evals (three tiers)

**Tier A — Study only (zero prod risk)**

- Export feedback to spreadsheet
- Manually review 20 rows: “Would I agree with good/bad?”
- Interview prep: describe metrics you *would* run

**Tier B — Local script (no prod code change)**

- Add `scripts/eval-ai-analyze.ts` (not deployed)
- Load JSONL, call `runAiAnalysis(contractAddress)` locally with `.env` keys
- Print accuracy + score histograms
- Run before/after any prompt experiment on a branch

**Tier C — CI / framework (optional later)**

- **promptfoo** — config file, calls `/api/ai-analyze`, asserts JSON fields
- **Braintrust / LangSmith** — log spans, attach ground truth, dashboard metrics

### Step 4 — Connect evals and RAG

| Phase | Action |
|-------|--------|
| Baseline | Run eval on current prompts → save metrics as “v1” |
| Experiment | Add RAG on branch → run same eval set → “v2” |
| Decide | If v2 ≥ v1 on signal accuracy + calibration, consider owner-only flag |
| Prod | Only if you approve deploy |

**Interview line:** “RAG and evals are paired: retrieval is only worth shipping if it improves metrics on a held-out feedback set, not on anecdotal examples.”

---

## 4. Few-shot vs RAG vs fine-tuning (quick comparison)

| Approach | What it is | NovaStaris status | Prod risk if added |
|----------|------------|-------------------|---------------------|
| **Prompt + rules** | Instructions in `lib/ai-analyze.ts` | ✅ Live today | Low (normal iteration) |
| **Few-shot** | 2–3 good examples in prompt | Roadmap §1 Option A | Low—just prompt text |
| **RAG** | Retrieve similar past analyses | Roadmap §3, not built | Low if flag-gated |
| **Fine-tuning** | Train smaller model on feedback JSONL | Roadmap §1 Option B | Medium—new model route |

For learning and interviews, **evals + few-shot** are the safest first wins; **RAG** is the next step when you want consistency at scale.

---

## 5. Interview cheat sheet

### “What is RAG?”

> Retrieval-Augmented Generation enriches the LLM prompt with relevant retrieved context before inference. In NovaStaris, that would mean embedding token summaries, storing them in pgvector, and retrieving similar past analyses—including good/bad feedback—so Claude stays consistent and grounded in our product history.

### “How do you measure AI quality?”

> We capture explicit good/bad feedback on analyses, export an eval set, and measure signal accuracy and score calibration against those labels. Any prompt or RAG change goes through a regression eval on the same frozen set before we’d consider shipping.

### “Would you ship RAG to production?”

> Only after offline evals show improvement. In prod it would be **feature-flagged (off by default) and owner-only** so subscribers see no change until I validate metrics and choose to expand. The default path stays unchanged; RAG is additive and toggleable from Admin.

### NovaStaris numbers

- Feedback tables: `AiAnalysisFeedback`, `NovaSmartFeedback`, `NovaFiveMinsOwnerFeedback`
- Main AI entry: `lib/ai-analyze.ts`, `/api/ai-analyze`
- Feature flags: kill switches without redeploy

---

## 6. Suggested 2-week study plan (no prod changes)

| Week | Focus | Deliverable |
|------|-------|-------------|
| **Week 1 — Evals** | Read §3 above; export 20 feedback rows; define 3 metrics | One-page “eval plan” you can recite in interviews |
| **Week 2 — RAG** | Read `AI_PM_ROADMAP.md` §3; trace `runAiAnalysis`; sketch pgvector table | Whiteboard diagram: embed → retrieve → prompt |

Optional stretch (still local): run a Python notebook that embeds 10 strings and does cosine similarity—no NovaStaris deploy.

---

## 7. What we will NOT do unless you ask

- Merge RAG or eval logging into `main` and deploy to novastaris.ai
- Change Claude prompts in production for experiments
- Add pgvector migrations to production database
- Enable any new AI behavior for Pro/VIP users without your sign-off

**When you're ready for hands-on implementation**, say whether you want: (1) local eval script only, (2) RAG prototype on a branch with **owner-only + `ai_analysis_rag` flag (default OFF)**, or (3) study materials only—which is where you are today.

---

*Last updated: June 2026 — study guide for interview prep; production behavior unchanged.*
