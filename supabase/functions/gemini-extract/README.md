# gemini-extract

Reads a scanned/photographed delivery note, invoice or LPO with Google Gemini (free tier)
and returns structured JSON used to pre-fill the GRN "Record New Receipt" form.
Nothing is saved automatically — the user reviews the fields, ticks the confirmation box
and clicks **Confirm Entry** as usual.

## One-time setup

1. Create a free API key at <https://aistudio.google.com/apikey>.
2. Install the Supabase CLI and link the project:
   ```sh
   npx supabase login
   npx supabase link --project-ref ptyzpepyjhgmineyyjll
   ```
3. Store the key as a secret (it never reaches the browser):
   ```sh
   npx supabase secrets set GEMINI_API_KEY=your-key-here
   ```
4. Deploy (the function verifies the signed-in user itself):
   ```sh
   npx supabase functions deploy gemini-extract --no-verify-jwt
   ```

## Optional: choose models

The function tries each model in order and falls back to the next one if a model is
renamed (404), over the free quota (429) or overloaded (5xx):

```sh
npx supabase secrets set GEMINI_MODELS=gemini-flash-latest,gemini-2.5-flash,gemini-flash-lite-latest
```

## Notes

- Free-tier limits are per Google project and change over time; check your quota in AI Studio.
- On the free tier Google may use requests to improve its models. Use a paid key if receipts
  contain data that must not leave your control.
- Files: JPG, PNG, WEBP, HEIC or PDF, up to 5 pages / ~13 MB per scan. Images are
  straightened (EXIF), resized and contrast-enhanced in the browser before upload.
