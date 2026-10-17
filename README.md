# Giftee Warehouse Management (InventoryPro)

A web app for running a project warehouse: record **goods received** against projects and LPOs,
dispatch **goods delivered** to consignees, track live stock balances, and export reports and monthly backups.

**Live:** see the link in the repository's *About* section (hosted on Vercel).

## Features

| Module | What it does |
|---|---|
| **Dashboard** | Totals for projects, LPOs, receipts, deliveries and stock value; recent activity. |
| **Goods Receipt (GRN)** | Record incoming goods per project and LPO, with line items (product code, OEM code, qty, price). View, edit, print, or email the details. |
| **AI receipt scan** | Optional: upload a photo, scan or PDF of a delivery note, invoice or LPO and the GRN form fills itself. You review every field before saving. |
| **Goods Delivery (GDN)** | Dispatch stock to consignees, limited to the quantity available. |
| **Stock Inquiry** | Received, delivered and balance quantities per project, LPO and product. |
| **Reports** | Project statements and transaction reports, exportable to Excel. |
| **Backup** | Monthly Excel backup of all data. |

Users sign in with Supabase Auth (email and password). Every table is protected by row-level security.

## Tech stack

- **Frontend:** a single `index.html`, using React 18 (UMD, no build step), SheetJS for Excel export and Tabler icons.
- **Backend:** [Supabase](https://supabase.com) for the Postgres database, auth and the Edge Function.
- **AI scan:** Google Gemini (free tier from Google AI Studio), called only from the `gemini-extract` Supabase Edge Function. The API key never reaches the browser.
- **Hosting:** Vercel (static site).

```
index.html                              the whole app
schemas/                                SQL to set up the database, run in order
supabase/functions/gemini-extract/      Edge Function for the AI receipt scan
  index.ts                              auth, validation, Gemini calls with retries and model fallback
  extraction.ts                         prompt, JSON schema, tolerant parsing and clean-up of the reply
app.js                                  earlier prototype, not used by index.html
```

## How the AI receipt scan works

1. On **Goods Receipt → Record New Receipt**, click **Choose File(s)** (JPG, PNG, WEBP, HEIC or PDF, up to 5 pages) and then **Extract Details**.
2. The browser straightens and resizes each photo and boosts its contrast, then sends it to the `gemini-extract` function along with the user's login token.
3. The function asks Gemini for a strict JSON answer and cleans it up: dates become `YYYY-MM-DD`, and numbers like `1,250.00 AED` become `1250`. It retries automatically when Google's free tier is busy, and falls back to another model if one is slow or unavailable.
4. The form is filled in. If a project or LPO number already exists in the database, the stored name, supplier and address are used. The GRN number is never changed.
5. A yellow banner lists what was filled, which fields the AI was unsure of, and any other reference numbers on the document.
6. **Nothing is saved automatically.** The user checks the fields, ticks *"I have checked the AI-extracted details"*, and clicks **Confirm Entry**.

Manual entry works exactly as before. The scan is optional.

## Setup

### 1. Database (Supabase)

In the Supabase dashboard, open **SQL Editor** and run the files in `schemas/` in order:

```
001_initialschema.sql
002enable_rls_auth.sql
003_createdby.sql
004_addbackups.sql
```

Create users under **Authentication → Users**.

The Supabase URL and the public (publishable) key are set near the top of `index.html`.

### 2. AI receipt scan (one time)

1. Create a free API key at https://aistudio.google.com/apikey.
2. Deploy the function with the Supabase CLI:

   ```sh
   npx supabase login
   npx supabase link --project-ref ptyzpepyjhgmineyyjll
   npx supabase secrets set GEMINI_API_KEY=your-key-here
   npx supabase functions deploy gemini-extract --no-verify-jwt
   ```

   `--no-verify-jwt` is intentional: the function checks the user's login itself, which also works with
   Supabase's newer API keys.

Optional: choose the models and their order. The defaults are shown here:

```sh
npx supabase secrets set GEMINI_MODELS=gemini-flash-latest,gemini-flash-lite-latest,gemini-2.5-flash
```

Run the deploy command again whenever you change a file in `supabase/functions/`.

### 3. Run locally

No build step is needed. Serve the folder and open it in a browser:

```sh
npx serve .
```

## Deployment

- **Website:** Vercel deploys automatically from GitHub. A push to `main` updates production, and a push to any other branch gets its own *Preview* URL.
- **AI function:** deploy it separately with the `supabase functions deploy` command above. Vercel does not deploy it.

## Troubleshooting the AI scan

If a scan fails, the red error box has a **Technical details** section. The same lines appear under
**Supabase → Edge Functions → gemini-extract → Logs**.

| Message or detail | Meaning | Fix |
|---|---|---|
| `HTTP 503`, *"service is busy"* | Google's free tier is overloaded | Try again in a moment |
| `HTTP 429`, *"quota is used up"* | Free-tier limit reached | Wait a minute, or check the quota in AI Studio |
| *"API key was rejected"* | Wrong or expired key | Set `GEMINI_API_KEY` again |
| *"GEMINI_API_KEY secret is not configured"* | Secret missing | Run `supabase secrets set ...` |
| `HTTP 404` for a model | Google renamed or retired the model | Set `GEMINI_MODELS` to current model names |
| *"Please sign in again"* | Login session expired | Sign out and back in |

**Privacy note:** on the free tier, Google may use the requests to improve its models. Use a paid
Gemini key if receipts contain information that must stay private.
