# Deploying Lattice — free tier, step by step

Lattice is designed to run entirely on free tiers. This guide takes you from this folder to a live
site on GitHub + Vercel + Supabase.

Estimated time: **15–20 minutes**. Recurring cost: **$0**.

---

## 0. Prerequisites

- [Node.js](https://nodejs.org) 20 or newer
- A [GitHub](https://github.com) account
- A [Vercel](https://vercel.com) account (free Hobby tier)
- A [Supabase](https://supabase.com) account (free tier) — optional but recommended

---

## 1. Run it locally first

```bash
cd lattice
npm install
npm test        # 47 tests should pass
npm run verify  # end-to-end offline pipeline check
npm run dev     # http://localhost:3000
```

With no `.env.local` the app runs in Demo Mode. Try uploading a PDF and exploring a topic before
deploying — you will see the full pipeline working with no keys.

---

## 2. Push to GitHub

```bash
cd lattice
git init
git branch -M main
git add .
git commit -m "feat: Lattice knowledge exploration platform"

# Create an empty repo on GitHub first (no README, no .gitignore), then:
git remote add origin https://github.com/<your-username>/lattice.git
git push -u origin main
```

`.env.local`, `node_modules/` and `.next/` are already ignored — check with `git status` that no
secrets are staged before you push.

> Using the GitHub CLI instead?
> ```bash
> gh repo create lattice --public --source=. --remote=origin --push
> ```

---

## 3. (Recommended) Create the Supabase project

Skip this only if you are deploying a single-instance self-hosted server. On Vercel, the local JSON
store is **not** durable, so configure Supabase before you rely on accounts.

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard). Choose the free
   plan and a region close to your users.
2. Open **SQL Editor**, paste the contents of `supabase/migrations/0001_init.sql`, and run it.
   This creates the tables, enables Row Level Security, and creates the private `documents` bucket.
3. Open **Project Settings → API** and copy:
   - Project URL
   - `anon` public key
   - `service_role` key *(server-only — never expose this)*
4. Open **Authentication → Providers** and confirm Email is enabled.
   Under **URL Configuration**, set the Site URL to your Vercel URL once you have it.

---

## 4. Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import the GitHub repository you just pushed.
2. Framework preset is detected automatically as **Next.js**. Leave the build settings as they are.
3. Add the environment variables below under **Environment Variables** (apply to Production,
   Preview and Development):

| Name | Value | Required |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://<your-app>.vercel.app` | Recommended |
| `LATTICE_SESSION_SECRET` | 32+ random chars (see below) | **Yes** in production |
| `NEXT_PUBLIC_SUPABASE_URL` | from Supabase | For durable storage |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase | For durable storage |
| `SUPABASE_SERVICE_ROLE_KEY` | from Supabase | For durable storage |
| `ADMIN_EMAILS` | `you@example.com` | For admin access |
| `LATTICE_ENABLE_OPENALEX` | `true` | Free providers |
| `LATTICE_ENABLE_CROSSREF` | `true` | Free providers |
| `LATTICE_ENABLE_ARXIV` | `true` | Free providers |
| `LATTICE_ENABLE_WIKIPEDIA` | `true` | Free providers |
| `LATTICE_ENABLE_WORLDBANK` | `true` | Free providers |
| `LATTICE_ENABLE_GDELT` | `true` | Free providers |
| `GUARDIAN_API_KEY` | optional | Only if you want Guardian coverage |
| `AI_ENABLED` | `false` | Leave off unless you want AI synthesis |

Generate the session secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

4. Click **Deploy**. The first build takes 1–3 minutes.
5. Once deployed, copy the production URL and set `NEXT_PUBLIC_SITE_URL` to it, then redeploy so
   canonical links and metadata are correct.

---

## 5. Verify the deployment

Visit `https://<your-app>.vercel.app/api/health`. It returns an honest capability report:

```json
{
  "ok": true,
  "mode": "live",
  "persistence": "supabase",
  "auth": "supabase",
  "ai": { "enabled": false },
  "library": { "sources": 24, "cases": 17, "ideas": 21, "concepts": 260 },
  "providers": [ ... ],
  "formats": [ ... ]
}
```

Then check in the UI:

1. The nav badge reads **Live** (or **Demo** if you disabled every provider).
2. Upload a PDF and confirm concepts, sources and a knowledge map appear.
3. Create an account, save an item, and confirm it appears under **Saved**.
4. Open **Settings** and confirm the delete-account flow works on a throwaway account.

---

## 6. Enable the optional AI layer (optional)

AI is **never required**. If you want multi-source synthesis:

```bash
AI_ENABLED=true
AI_PROVIDER=openai          # or openrouter, ollama, vllm, lmstudio
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=<your key>
AI_MODEL=gpt-4o-mini
```

Any OpenAI-compatible endpoint works, including a local model served by Ollama. Only relevant
excerpts are sent — never whole documents — and results are cached. The free quota is controlled by
`LATTICE_FREE_AI_QUOTA` (default 5 deep operations per account per month).

To keep everything at $0, leave `AI_ENABLED=false`. Every core feature works without it.

---

## 7. Custom domain (optional, free on Vercel Hobby)

**Vercel → Project → Settings → Domains → Add.** Follow the DNS instructions, then update
`NEXT_PUBLIC_SITE_URL` and the Supabase **Site URL** to match.

---

## Cost summary

| Component | Free tier | When you would pay |
|---|---|---|
| Vercel Hobby | 100 GB bandwidth / month | Very high traffic |
| Supabase Free | 500 MB database, 1 GB storage | Large document libraries |
| OpenAlex / Crossref / arXiv / Wikipedia / World Bank / GDELT | Free, keyless | Rate-limit courtesy only |
| The Guardian | Free developer tier | Higher quotas |
| AI | Disabled by default | Only if you opt in |

A deployment with AI disabled and modest traffic costs **$0/month** indefinitely.

---

## Troubleshooting

**Build fails with a type error.** Run `npx tsc --noEmit` locally and fix the reported file. The
production build type-checks route handlers too, so run `npm run build` locally before pushing.

**"Storage: local JSON (single instance)" banner will not go away.** The Supabase variables are not
visible to the server. Confirm all three (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are set for the environment you are
viewing, then redeploy.

**Sources tab is empty.** Either no provider is enabled, or the providers returned nothing for
these queries. Open the **Source provider report** at the bottom of the results — it states exactly
which provider returned what.

**Scanned PDF yields little text.** It has no text layer. Install `tesseract.js` to enable OCR:
`npm install tesseract.js`, then redeploy. The capability report will show image formats as enabled.

**Signed out immediately after signing in.** `LATTICE_SESSION_SECRET` is missing or shorter than 32
characters, so a development secret is used and sessions do not survive a restart.

**A page returns 404 on Vercel but works locally.** Confirm you pushed all files, including
`src/data/*.json` and `src/app/legal/[slug]/page.tsx`. Some Git clients skip bracketed paths.

---

## Self-hosting instead

Lattice runs on any Node.js 20+ host:

```bash
npm ci
npm run build
LATTICE_SESSION_SECRET=<secret> npm start   # listens on :3000
```

With the local JSON store, run a **single instance** behind a reverse proxy with TLS. Set
`LATTICE_DATA_DIR` to a persistent volume. For multiple instances, configure Supabase.
