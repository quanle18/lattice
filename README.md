# Lattice

**One idea. A world of connections.**

Lattice is a knowledge exploration platform. You give it one piece of knowledge — a document, a
passage, a URL, or just a question — and it helps you discover what is worth exploring next:
related research, cases, data, opposing perspectives, and research directions.

It is built to run at **$0** and to work on **any subject**. The recommendation engine is
deterministic software, not a language model, so the core product has no marginal cost and no
vendor dependency. AI is an optional, clearly-labelled enhancement.

---

## What makes it different

| Principle | What it means in practice |
|---|---|
| **Domain-independent** | Concepts are extracted from *your* material by local NLP. There is no starter list that decides what you may explore. A niche subject works exactly like a common one. |
| **$0-first** | Concept extraction, entity recognition, claim detection, relevance scoring, knowledge maps and next-step suggestions are all local and free. The live source providers are keyless. |
| **Source-driven** | Every recommendation carries a publisher, date, source type, quality tier and outbound link. Nothing is presented without provenance. |
| **AI-optional** | With `AI_ENABLED=false` (the default) no content ever leaves the deployment. The only AI feature is a bounded synthesis over already-retrieved snippets, and it is labelled as AI output. |
| **Honest by design** | No fabricated sources, statistics, counter-arguments or citations. Demonstration-library records are labelled as fictional. When a provider is unavailable, the UI says so. |

---

## Quick start

```bash
git clone <your-fork-url> lattice
cd lattice
npm install

cp .env.example .env.local     # optional — everything works with no values
npm run dev                    # http://localhost:3000
```

That is it. With an empty `.env.local` the app runs in **DEMO MODE**: fully functional, using the
internal demonstration library, with no network calls and no keys.

### Verify it works

```bash
npm test        # 47 unit + regression tests (includes the domain-independence regression)
npm run verify  # end-to-end offline pipeline check across three unrelated disciplines
npm run build   # production build
```

`npm run verify` is the important one. It runs the full pipeline on an international-relations
document, a biology document and a philosophy document with **no network access**, and asserts
that each yields concepts, a connected knowledge map and next-step suggestions.

---

## How it works

```
                     ┌──────────────────────────────────────────────┐
   PDF / DOCX /      │  PARSERS  (server-only, untrusted input)     │
   PPTX / CSV / ────►│  pdf · docx · pptx · csv · json · xml · rtf  │
   JSON / XML / RTF  │  md · html · txt · images (optional OCR)     │
   TXT / MD / HTML   └──────────────────────┬───────────────────────┘
                                            ▼
                     ┌──────────────────────────────────────────────┐
                     │  LOCAL NLP  (no model, no API, no cost)      │
                     │  tokenise → RAKE + TF-IDF → entities →       │
                     │  concepts → claims → queries → embeddings    │
                     └──────────────────────┬───────────────────────┘
                                            ▼
        ┌───────────────────────────────────┼───────────────────────────────────┐
        ▼                                   ▼                                   ▼
┌───────────────────┐          ┌────────────────────────┐          ┌───────────────────┐
│ KNOWLEDGE BASE    │          │ SOURCE PROVIDERS       │          │ RECOMMEND ENGINE  │
│ seed JSON library │          │ OpenAlex · Crossref    │          │ transparent       │
│ (extensible)      │          │ arXiv · Wikipedia      │          │ weighted scoring  │
│                   │          │ World Bank · GDELT     │          │ + explanations    │
│ enrich, never     │          │ (The Guardian, keyed)  │          │                   │
│ gate              │          └───────────┬────────────┘          └─────────┬─────────┘
└───────────────────┘                      │                                 │
                                           ▼                                 ▼
                     ┌──────────────────────────────────────────────────────────────┐
                     │  RESULT: concepts · cases · ideas · sources · data ·          │
                     │  perspectives · knowledge map · next explorations            │
                     └──────────────────────────────────────────────────────────────┘
```

### The critical fix

An earlier version of this kind of product reported *"No known concepts found"* and listed a fixed
starter library. That is unacceptable for a general-purpose platform. Lattice separates four
things that were previously conflated:

1. **Recognising concepts in your material** — always happens, using local NLP, for any subject.
2. **Finding relevant information in connected sources** — provider-dependent, and reported
   honestly when a provider is unavailable.
3. **Matching against the internal knowledge base** — *enrichment only*. A concept that is absent
   from the library is still extracted, displayed, mapped and searched. It is simply marked
   "new to library".
4. **Presenting everything with provenance** — quality tiers, links, and explicit labelling of
   demonstration content.

The regression test `REGRESSION: IR document yields IR concepts without any starter library`
enforces this: it passes an **empty** known-concept set and requires that concepts, queries and a
connected map are still produced.

---

## Running modes

Lattice derives its mode from what is actually configured and shows it in the UI. It never claims
a capability the deployment does not have.

| Mode | When | Behaviour |
|---|---|---|
| **Demo** | No providers enabled | Internal demonstration library only. No network calls. Every record labelled as fictional. |
| **Live** | ≥1 provider enabled | Keyless providers queried in parallel, with caching and graceful degradation. |

| Persistence | When | Notes |
|---|---|---|
| **local-json** | No Supabase config | Zero-dependency, single instance. Not safe for serverless. |
| **supabase** | Supabase env set | Free-tier Postgres with Row Level Security. Serverless-safe. |

| Auth | When | Notes |
|---|---|---|
| **builtin** | No Supabase config | scrypt password hashing + HMAC-signed httpOnly session cookie. Works at $0 for self-hosting. |
| **supabase** | Supabase env set | Managed credentials via Supabase Auth. Recommended for production. |

---

## Configuration

Everything is optional. See `.env.example` for the full list.

```bash
# Runtime
NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app

# Session signing (REQUIRED in production for the built-in auth)
LATTICE_SESSION_SECRET=<32+ random characters>

# Durable persistence + managed auth (free tier)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server-only, never exposed

# Admin access
ADMIN_EMAILS=you@example.com

# Keyless providers (all free, all on by default)
LATTICE_ENABLE_OPENALEX=true
LATTICE_ENABLE_CROSSREF=true
LATTICE_ENABLE_ARXIV=true
LATTICE_ENABLE_WIKIPEDIA=true
LATTICE_ENABLE_WORLDBANK=true
LATTICE_ENABLE_GDELT=true

# Optional keyed provider (free developer tier)
GUARDIAN_API_KEY=

# Optional AI (OFF by default)
AI_ENABLED=false
```

Generate a session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Free source providers

| Provider | Keyless | Provides |
|---|---|---|
| [OpenAlex](https://openalex.org) | ✅ | Academic works, abstracts, DOIs |
| [Crossref](https://www.crossref.org) | ✅ | Academic metadata |
| [arXiv](https://arxiv.org) | ✅ | Preprints |
| [Wikipedia](https://www.wikipedia.org) | ✅ | General reference + summaries |
| [World Bank Open Data](https://data.worldbank.org) | ✅ | Official statistics (primary sources) |
| [GDELT](https://www.gdeltproject.org) | ✅ | Global news metadata |
| [The Guardian](https://open-platform.theguardian.com/access/) | ❌ (free key) | Journalism |

All providers sit behind the `SourceProvider` interface (`src/lib/providers/types.ts`), so adding
or removing one never touches the engine. Providers run in parallel with a concurrency cap, retry
once on transient failure, cache results, and report their own status to the UI.

**On Britannica ProCon:** it is treated strictly as a *debate/perspective* source, not an academic
database. Lattice links to ProCon's own index and never fabricates an article URL for it.

---

## Project structure

```
src/
├── app/                        # Next.js App Router
│   ├── page.tsx                # Landing
│   ├── explore/                # Workspace
│   ├── my-research/ saved/ map/ settings/ admin/
│   ├── login/ signup/ auth/signout/
│   ├── legal/[slug]/           # Terms, Privacy, Cookies, Copyright, Attribution, Contact
│   ├── legal/privacy-request/  # Data access / deletion workflow
│   ├── actions.ts              # Server actions (auth, consent, admin)
│   └── api/                    # analyze · concept · saved · usage · health · privacy-request
├── components/
│   ├── ui.tsx                  # Design-system primitives + inline icon set
│   ├── landing/ explore/ site/ auth/ account/ legal/
├── lib/
│   ├── nlp/                    # tokenize · stopwords · keywords · entities · claims
│   │                           # concepts · taxonomy · embed · analyze
│   ├── parsers/                # pdf · office · tabular · text · html · ocr · registry
│   ├── kb/                     # Library loading + indexing
│   ├── recommend/              # engine · map · next · perspectives
│   ├── providers/              # academic · reference · news · ai · registry · http
│   ├── store/                  # local-json · supabase · selection
│   ├── auth/                   # password (scrypt) · session · facade
│   ├── cache/                  # TTL cache + in-flight de-duplication
│   ├── explore/engine.ts       # The orchestrator
│   ├── limits.ts               # Rate limiting + usage/cost tracking
│   ├── config.ts               # Central configuration
│   └── types.ts                # Shared domain types
├── data/                       # taxonomy.json · library seed · legal.ts
tests/engine.test.ts            # 47 tests incl. the domain-independence regression
scripts/verify.ts               # End-to-end offline verification
supabase/migrations/0001_init.sql
```

---

## Extending

**Add a discipline.** Edit `src/data/taxonomy.json`. Taxonomy is *labelling only* — it never
gates extraction, so adding a discipline is purely additive.

**Add a source.** Append to `src/data/sources.json` (or the cases/ideas/perspectives files). The
concept index, IDF corpus and knowledge graph rebuild automatically at startup.

**Add a provider.** Implement `SourceProvider` and register it in `src/lib/providers/registry.ts`.

**Add a format.** Add a parser and register it in `SUPPORTED_FORMATS` in `src/lib/parsers/index.ts`.
Magic-byte validation is already wired in.

**Enable local embeddings.** `npm install @xenova/transformers` — `LocalTransformerProvider` picks
it up automatically and falls back to the hashing embedder if it is absent.

**Enable OCR.** `npm install tesseract.js` — the image parser detects it at runtime and the
capability report updates.

---

## Security

- HTTPS-only in production; `httpOnly`, `SameSite=Lax` session cookies.
- scrypt password hashing (built-in auth) or managed credentials (Supabase Auth).
- Server-side API keys only — nothing secret is exposed to the client.
- Uploaded files are validated by extension, declared MIME type **and magic bytes** before parsing,
  are never executed, and are size-limited.
- Rate limiting on every mutating endpoint.
- Row Level Security on all tables; documents are owner-only with no public read path.
- Server-side URL fetching refuses localhost, private ranges and `.local` hosts.
- Security headers set globally (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`).

---

## Cost model

| Operation | Marginal cost |
|---|---|
| Concept extraction, entities, claims | **$0** |
| Relevance scoring, knowledge map, next steps | **$0** |
| Cached exploration (repeat input) | **$0** |
| Keyless provider queries | **$0** |
| Optional AI synthesis | Only if `AI_ENABLED=true` |

The admin dashboard shows live cache-hit rate and the cost model. By construction, a deterministic
exploration costs nothing.

---

## Deployment

See **[DEPLOY.md](./DEPLOY.md)** for a step-by-step free-tier deployment (GitHub → Vercel →
Supabase), including how to push this repository to GitHub.

---

## Limitations — stated plainly

- Lattice does **not** have access to every source on the internet. It queries the providers you
  configure, and it reports when they return nothing.
- It does **not** fabricate sources, statistics, citations or counter-arguments. When it has no
  recorded perspective on a subject, it says so.
- It is a discovery and research tool. It is **not** a substitute for professional legal, medical
  or financial advice.
- Demonstration-library records are fictional and labelled as such in the interface.
- The legal documents in `src/data/legal.ts` are well-structured **templates**, not legal advice.
  Have qualified counsel review them for your markets before commercial launch.

---

## License

MIT — see [LICENSE](./LICENSE).
