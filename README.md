# Sentinel-Diff

AI-powered PR analyzer that checks diffs against configurable rules, scores risk, detects architectural drift, and posts rich reports as PR comments. It can optionally use RAG (retrieval-augmented generation) over past PRs to give more contextual, consistent reviews.

---

## Features

- **Config-driven rules**
  - `sentinel.config.yaml` controls:
    - `allowedLibraries` (block unexpected imports)
    - `sensitivePaths` (auth, db, secrets, etc.)
    - `riskThreshold` (strict-mode line in CI)
    - `architecture` drift rules (path + forbidden regex)
- **Risk scoring**
  - Computes a **1–10 risk score** per PR.
  - Explains the score via **human-readable risk factors** (change size, sensitive paths touched, rule violations).
- **Architectural drift detection**
  - Pattern-based drift rules such as:
    - Controllers must not access DB directly.
    - Controllers must not read `process.env` or touch filesystem.
    - Routes must not import services/DB directly.
    - Services/DB/Auth layers must not depend on controllers or read env directly.
  - Report includes both:
    - Raw findings per file.
    - AI-generated “drift overview” narrative.
- **AI-generated PR report**
  - Uses Groq’s LLaMA (`llama-3.3-70b-versatile`) via LangChain.
  - Summarizes:
    - **Overview** (scope, main areas, intent)
    - **Risk score & factors**
    - **Themes** (auth, data access, tests, etc.)
    - **Violations** (full list)
    - **Architectural drift**
    - **Past context & patterns** (with RAG)
    - **Recommendations, quick wins, longer-term improvements**
  - Posts a single Markdown comment back to the PR.
- **RAG over past PRs (optional)**
  - Stores PR context embeddings in Postgres via **pgvector**.
  - On new PRs, retrieves top‑K most similar past PRs and injects them into the AI summary prompt.
- **Queue-based processing**
  - Uses **BullMQ + Redis** for background PR analysis jobs.
  - Scales workers independently from webhooks/CLI.

---

## High-level architecture

flowchart LR
  gh[GitHub PR]
  webhook[Webhook/CLI]
  queue[BullMQ Queue]
  worker[PR Analysis Worker]

  githubClient["GitHub Client (fetch diff, post comment)"]
  diffService[Diff Parser]
  rulesEngine[Rule Engine]
  riskScorer[Risk Scorer]
  driftDetector[Drift Detector]
  aiSummary["AI Summary (Groq LLaMA)"]
  ragRetrieve["RAG Retrieve (similar PRs)"]
  ragStore["RAG Store (embeddings)"]
  db[Postgres + pgvector]

  gh --> webhook
  webhook --> queue
  queue --> worker

  worker --> githubClient
  worker --> diffService
  worker --> rulesEngine
  worker --> riskScorer
  worker --> driftDetector
  worker --> aiSummary
  worker --> ragRetrieve
  worker --> ragStore
  worker --> db

  ragRetrieve --> db
  ragStore --> db

**Main flow:**

1. Receive PR info (owner/repo/PR/base/head) via webhook or CLI.
2. Fetch the unified diff from GitHub.
3. Parse diff and run:
   - `rule-engine` → `Violation[]`
   - `risk-scorer` → `RiskResult { score, factors }`
   - `drift-detector` → `DriftFinding[]`
4. Build an LLM context (`buildDiffContext`) with:
   - files changed,
   - rule violations,
   - risk info,
   - truncated diff snippet.
5. Optionally (if RAG enabled):
   - Embed current PR context with **Google Gemini (text-embedding-004)**.
   - Query **pgvector** for similar past PR embeddings.
   - Append those snippets into the LLM prompt.
6. Call Groq’s LLaMA via LangChain to generate a structured JSON report.
7. Render a Markdown PR comment (`buildPRComment`) and post it to GitHub.
8. Persist run metrics and embeddings to Postgres.

---

## Tech stack

- **Language / runtime**
  - TypeScript, Node.js ≥ 20
- **Job processing**
  - BullMQ, Redis
- **Database**
  - PostgreSQL
  - `pgvector` extension (vector embeddings)
- **AI / LLMs**
  - Embeddings: `@langchain/google-genai` (**Google Gemini** `text-embedding-004`)
  - Summaries: `@langchain/groq` (**LLaMA 3.3 70B versatile**)
- **Config / validation**
  - YAML (`sentinel.config.yaml`)
  - Zod (for config + AI output schema)
  - dotenv
- **GitHub integration**
  - Custom GitHub client (REST API) for:
    - fetching compare diffs,
    - posting PR comments.

---

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Create a `.env` (there is a `.env.example` as a reference):

```env
# Postgres (must have pgvector extension installed)
DATABASE_URL=postgres://sentinel:your_password@localhost:5432/sentinel

# Redis (BullMQ)
REDIS_URL=redis://localhost:6379

# Groq API (for LLaMA summaries)
GROQ_API_KEY=your_groq_api_key

# Google AI (for embeddings / RAG)
GOOGLE_API_KEY=your_google_api_key

# RAG toggle and retrieval size
RAG_ENABLED=1            # set to 0 or omit to disable RAG
RAG_TOP_K=3              # max similar PR contexts to retrieve (capped at 10)

# Optional: custom config path
# SENTINEL_CONFIG_PATH=sentinel.config.yaml
```

### 3. Postgres + pgvector

Follow `DATABASE_SETUP.md` in the repo. In short for local dev:

```bash
# Example using psql as superuser
psql postgres
CREATE USER sentinel WITH PASSWORD 'your_password';
CREATE DATABASE sentinel OWNER sentinel;
\c sentinel
CREATE EXTENSION IF NOT EXISTS vector;
\q
```

Set `DATABASE_URL` in `.env` to point at that DB.

### 4. Redis

On macOS with Homebrew:

```bash
brew install redis
brew services start redis
redis-cli ping  # should print PONG
```

Or via Docker:

```bash
docker run -d --name sentinel-redis -p 6379:6379 redis:7
```

### 5. Build & run

```bash
npm run build
npm start
```

This starts the main process, including the BullMQ worker that runs `prAnalysisProcessor`.

---

## Configuration (`sentinel.config.yaml`)

A typical config might look like:

```yaml
allowedLibraries:
  - express
  - zod
  - "node:"

sensitivePaths:
  - src/auth/
  - src/db/
  - src/secrets/

riskThreshold: 7

architecture:
  - name: Controllers must not access DB directly
    pathPattern: "src/controllers"
    description: Controllers should call services; only services talk to the DB.
    forbiddenPattern: "import.*from.*['\"]\\.*/db"

  - name: Controllers must not touch filesystem
    pathPattern: "src/controllers"
    description: Controllers should be pure request/response orchestration; no direct IO.
    forbiddenPattern: "import.*from.*['\"]node:fs"

  - name: Controllers must not read env directly
    pathPattern: "src/controllers"
    description: Configuration should be centralized (e.g., src/config).
    forbiddenPattern: "process\\.env"

  - name: Routes must not call services or DB
    pathPattern: "src/routes"
    description: Routes should delegate to controllers only.
    forbiddenPattern: "import.*from.*['\"]\\.\\./(services|db)"

  - name: No services importing controllers
    pathPattern: "src/services"
    description: Services are lower-level and should not depend on controllers.
    forbiddenPattern: "import.*from.*['\"]\\.*/controllers"

  - name: Services must not read env directly
    pathPattern: "src/services"
    description: Keep env access in a config module so logic stays testable.
    forbiddenPattern: "process\\.env"

  - name: DB layer must not depend on services/controllers
    pathPattern: "src/db"
    description: DB layer is lowest-level; higher layers may depend on it, not vice-versa.
    forbiddenPattern: "import.*from.*['\"]\\.\\./(controllers|services)"

  - name: DB layer must not read env directly
    pathPattern: "src/db"
    description: Centralize env parsing/validation in one place.
    forbiddenPattern: "process\\.env"

  - name: Auth must not depend on controllers
    pathPattern: "src/auth"
    description: Auth is infrastructure; it should not import app-layer controllers.
    forbiddenPattern: "import.*from.*['\"]\\.\\./controllers"

  - name: Auth must not read env directly
    pathPattern: "src/auth"
    description: Centralize env parsing/validation in one place.
    forbiddenPattern: "process\\.env"
```

---

## How PR analysis is triggered

You can wire Sentinel-Diff in two main ways:

1. **From a webhook handler**
   - Your webhook receives a PR event from GitHub (with repo, base, head, PR number).
   - It enqueues a BullMQ job via `addPrAnalysisJob`.

2. **From a CLI entrypoint**
   - A CLI script can:
     - take owner/repo/pullNumber/base/head,
     - call `addPrAnalysisJob`,
     - let the worker process it in the background.

Once the job is picked up, `prAnalysisProcessor` runs the full pipeline and posts a single comment to the PR.

---

## RAG behavior

When `RAG_ENABLED=1` and both `DATABASE_URL` + `GOOGLE_API_KEY` are set:

- After a run:
  - `storePrContext` embeds a concise context string for the PR (built from diff + violations + risk) and writes to `pr_embeddings` (vector column size must match the embedding dimension).
- On a new PR:
  - The same kind of context is embedded.
  - `findSimilar` (pgvector) returns the top‑K most similar past PR contexts for that repo.
  - Those contexts are appended under `## Similar past PRs (for context)` in the LLM prompt.
  - The AI can then mention past patterns, regressions, or consistency issues in the report.

---

## PR comment structure

A typical comment looks like:

- `## Sentinel-Diff Report`
  - **Strict mode notice** (if `risk.score > riskThreshold`)
  - `### Overview`
  - `### Risk score: X/10` + risk factors
  - `### Violations` (every rule violation with file + optional line)
  - `### Architectural drift` (one per architecture rule per file)
  - `### Drift overview` (AI narrative)
  - `### Themes`
  - `### Summary`
  - `### Past context & patterns` (with RAG)
  - `### Risks`
  - `### Recommendations`
  - `### Quick wins`
  - `### Longer-term improvements`
  - `--- *Powered by Sentinel-Diff*`

---

## Development

- Type-check / build:

```bash
npm run build
```

- Run the worker locally:

```bash
npm start
```

Make sure Postgres, Redis, and your env keys are running/defined before triggering jobs.

---

## License

MIT

