# NovaStaris AI PM Roadmap

Practical steps for **fine-tuning**, **eval**, **RAG**, and **GitHub profile** to strengthen your AI PM positioning. NovaStaris today uses **Anthropic (Claude)** for token analysis, futures analysis, and trading signals.

---

## 1. Fine-tuning for NovaStaris

**Reality check:** Anthropic does not offer customer fine-tuning like OpenAI. Your levers are **prompt engineering**, **few-shot examples in the prompt**, and (if you introduce another model) **fine-tuning elsewhere**.

### Option A: Prompt tuning + few-shot (fastest)

- **Where:** `lib/ai-analyze.ts`, `lib/ai-analyze-bsc.ts`, `lib/ai-analyze-futures.ts`, `lib/ai-trading-signal.ts`.
- **Idea:** Add 2–3 **few-shot examples** (input token summary → desired JSON output) at the top of the system/user prompt so the model mimics your preferred style (e.g. conservative on low liquidity, specific on support/resistance).
- **Data source:** Use **AI Feedback** (Admin → AI Feedback): export “good” outcomes and, for each, take the token context + the analysis that was shown when the user clicked “good”. Turn those into `<example input, example output>` pairs in the prompt.
- **Outcome:** No new infra; better consistency and style. Easy to describe in interviews as “systematic prompt improvement and few-shot learning.”

### Option B: Fine-tune a smaller model (for resume depth)

- **Use case:** E.g. a small model that does **only** score + signal (0–100, buy/no_buy) for speed/cost, with Claude reserved for full analysis.
- **Stack:**  
  - **Data:** Export from `AiAnalysisFeedback` + token snapshots (you have contractAddress, score, signal; you could backfill tokenSummary from DexScreener or logs).  
  - **Format:** JSONL: `{"messages": [{"role": "user", "content": "<token summary>"}, {"role": "assistant", "content": "{\"score\": 65, \"signal\": \"buy\"}"}]}`.  
  - **Platform:** OpenAI fine-tuning API (gpt-4o-mini or similar) or open-source (e.g. **Axolotl** / **Unsloth** + LoRA) on a small model, then call it from a new API route.
- **Interview angle:** “I defined the eval set from production feedback, built the training dataset from our app, and shipped a fine-tuned scorer to reduce latency/cost while keeping Claude for full analysis.”

### Option C: Document “fine-tuning strategy” (PM narrative)

- **One-pager:** Describe what you **would** fine-tune (e.g. “score + signal prediction”), which data you’d use (AI Feedback + token metadata), and how you’d measure success (agreement with human feedback, correlation with outcomes). No code required; shows you think in data and success metrics.

---

## 2. Eval (Evaluation)

You already have **implicit labels**: Admin → AI Feedback stores `outcome` (good/bad), `score`, `signal`, and `contractAddress`. Use them.

### Step 1: Export an eval set

- **Source:** `AiAnalysisFeedback` + (optional) token snapshot at feedback time. If you don’t have stored inputs, start **now**: for each new analysis, log `(contractAddress, tokenSummary, modelOutput)` to a table or JSONL (e.g. in a cron or inside the analyze API).
- **Eval set:** 50–200 examples: `contractAddress` (or full token summary) → expected `outcome` (good/bad) and optionally expected `signal` (buy/no_buy). Use “good” = positive example, “bad” = negative.

### Step 2: Run evals

**Option A – Script in repo (no new deps):**

- Add `scripts/eval-ai-analyze.ts` (or `.js`):
  - Load eval JSONL.
  - For each row, call your existing `runAiAnalysis(contractAddress)` (or the API).
  - Compare returned `score`/`signal` to expected; compute accuracy, precision/recall for “buy”, and correlation of score with “good”/“bad”.
- Run locally or in CI: `npx ts-node scripts/eval-ai-analyze.ts`.

**Option B – Use an eval framework:**

- **promptfoo:** Define an eval config: inputs (e.g. list of contract addresses), call your `/api/ai-analyze`, then assert on JSON fields (e.g. `signal`, `score` bands) or use a model to grade “quality” vs expected outcome.
- **Braintrust / LangSmith:** Log each analysis as a “span”, attach ground truth (good/bad), and compute metrics in their UI.

**Metrics to report:**

- **Accuracy:** % where model’s `signal` matches “expected” (derived from good/bad).
- **Score calibration:** Among “good” feedbacks, score distribution; among “bad”, score distribution (you want separation).
- **Regression:** After any prompt or model change, re-run eval and compare metrics (great PM talking point).

---

## 3. RAG (Retrieval-Augmented Generation)

**Idea:** Before calling Claude, retrieve **relevant context** (past analyses, similar tokens, or docs) and inject it into the prompt so the model is grounded in your product’s history and data.

### What to retrieve

- **Past analyses:** “Last time we saw this token (or a similar one), here’s what we said.” Reduces contradiction and adds continuity.
- **Similar tokens:** By liquidity, volume, or embedding of “token summary”; e.g. “Similar tokens often scored 50–70 and were no_buy.”
- **Internal docs:** E.g. “How we treat honeypots,” “When we say buy vs no_buy.” (Useful if you have a small playbook.)

### Minimal implementation

1. **Embeddings:** Use OpenAI `text-embedding-3-small` (or another embedding API) for:
   - Each completed analysis: embed a short text like `symbol, liquidity, volume, security summary, score, signal, reasons`.
   - (Optional) Internal doc chunks.
2. **Vector store:**  
   - **Simple:** **pgvector** in your existing Postgres (add a table `analysis_embeddings (id, contractAddress, text, embedding vector(1536), createdAt)`).  
   - **Alternative:** Pinecone or Supabase vector store.
3. **At inference time (e.g. in `runAiAnalysis`):**
   - Build the same “summary” text for the current token (without score/signal).
   - Query the vector store for top-k nearest analyses (and optionally doc chunks).
   - Append to the prompt: “Relevant past analyses or similar tokens:\n…” and then the current token.
4. **Where in code:** In `lib/ai-analyze.ts`, after building `tokenSummary`, call a `retrieveRelevantAnalyses(tokenSummary, k = 3)` (or similar), then add the retrieved blobs to the prompt string before the JSON block.

### Rollout policy (agreed)

- **Feature flag:** `ai_analysis_rag` in `lib/feature-flags.ts` — add to `DEFAULT_DISABLED_KEYS` so it starts **OFF**.
- **Owner-only:** In `/api/ai-analyze`, call RAG only when `getFeatureFlag('ai_analysis_rag')` **and** `isOwnerSession()` — Pro/VIP users always get the current analysis path until you widen access.
- **Admin:** Toggle under Admin → Feature Flags; no redeploy needed to turn off.
- See `docs/RAG_AND_EVALS_LEARNING_GUIDE.md` for full safety + eval workflow.

### Resume / interview angle

- “I added RAG over our historical analyses so the model stays consistent and can reference similar tokens, improving reliability and reducing contradictory advice.”

---

## 4. GitHub profile to showcase NovaStaris (for resume)

### A. Make the repo tell the story

1. **README.md (repo root):**
   - **Title + one-liner:** e.g. “NovaStaris – AI-powered meme-coin discovery and trading intelligence.”
   - **Problem / Solution:** 2–3 sentences (e.g. “Traders need fast, structured analysis of volatile tokens; NovaStaris uses AI to score tokens, surface risks, and suggest levels.”).
   - **Tech stack:** Next.js, Prisma, Postgres, Anthropic (Claude), Solana, Vercel.
   - **Key features:** AI token analysis (Solana/BSC), AI futures workflow, wallet tracking, subscriptions, admin hub, feature flags, support.
   - **Screenshots:** 1–2 images (dashboard, AI analysis card, or subscribe flow).
   - **Live app:** Link to novastaris.ai.
   - **Getting started:** Clone, `npm i`, set env (point to `.env.example`), `npm run dev`.

2. **Optional:** A short `docs/ARCHITECTURE.md` or “How AI fits in” (e.g. “AI Analysis flow: DexScreener + GoPlus → token summary → Claude → structured JSON → UI”). Shows you can communicate system design.

### B. Profile README (github.com/ayokhan)

- Create a repo named **exactly** your username: `ayokhan/ayokhan`.
- Add a single **README.md** that shows:
  - Who you are (e.g. “Product-minded engineer / AI PM”).
  - What you’re looking for (e.g. “Looking for AI PM roles”).
  - **Featured work:** A section “Selected project” or “Current focus” with:
    - **NovaStaris** – link to repo, 1–2 sentence description, live link, and 1–2 bullets: “AI-driven token analysis (Claude),” “Eval and feedback loop (good/bad),” “RAG roadmap for historical context,” etc.
  - Optional: Other repos, skills, contact.

### C. Resume line

- **Project:** NovaStaris (novastaris.ai)  
- **Role:** Founder / Product & Engineering  
- **Bullets:**  
  - Shipped AI-powered token and futures analysis (Anthropic Claude) with structured outputs and user feedback loop.  
  - Implemented subscription flow, admin operations hub, and feature flags; used Vercel Analytics for funnel visibility.  
  - Designed eval and RAG roadmap to improve AI consistency and grounding (documented in repo).

Linking to **github.com/ayokhan** (with the profile README) and **github.com/ayokhan/meme-coin-sniper** (with the improved README) gives recruiters and hiring managers a clear, credible picture of your AI product work.

---

## Quick reference

| Goal           | Next step |
|----------------|-----------|
| Fine-tuning    | Add 2–3 few-shot examples to `lib/ai-analyze.ts` from “good” AI Feedback; document a fine-tuning strategy in this doc or a one-pager. |
| Eval           | Export AI Feedback to JSONL; add `scripts/eval-ai-analyze.ts` that calls your API and compares score/signal to expected outcome. |
| RAG            | Add pgvector (or similar), embed past analyses, and in `runAiAnalysis` retrieve top-k and append to the prompt. |
| GitHub profile | Update repo README (problem, solution, stack, features, screenshots, link); create `ayokhan/ayokhan` with profile README and NovaStaris featured. |
