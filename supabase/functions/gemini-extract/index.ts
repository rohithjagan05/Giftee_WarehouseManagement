// Supabase Edge Function: extracts Goods Receipt data from scanned documents
// with Google Gemini (free tier via Google AI Studio).
//
// Secrets:   supabase secrets set GEMINI_API_KEY=<key from https://aistudio.google.com/apikey>
// Optional:  supabase secrets set GEMINI_MODELS=gemini-flash-latest,gemini-2.5-flash
// Deploy:    supabase functions deploy gemini-extract --no-verify-jwt
//            (the caller's Supabase session is verified inside the function instead)

import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  normalizeExtraction,
  parseModelJson,
  RESPONSE_SCHEMA,
  responseText,
  SYSTEM_INSTRUCTION,
  USER_PROMPT,
} from "./extraction.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf",
]);
const MAX_FILES = 5;
const MAX_BASE64_CHARS = 18_000_000; // Gemini caps inline request payloads at ~20 MB
const DEADLINE_MS = 80_000; // overall budget, well under the Edge Function wall-clock limit
const ATTEMPT_MS = 45_000; // one model call never runs longer than this
const HEDGE_MS = 12_000; // if a model has not answered by then, start the next one in parallel
const MAX_ATTEMPTS = 6; // total Gemini calls per scan, across all models
const RETRY_DELAYS_MS = [800, 2_000, 4_000]; // pause before retrying after a transient failure
const DEFAULT_MODELS = "gemini-flash-latest,gemini-flash-lite-latest,gemini-2.5-flash";

// Reading a document needs little reasoning, and "thinking" is what makes Flash slow, so turn it
// off. Models that reject one setting get the next one; the last option sends no setting at all.
const THINKING_OPTIONS: (Record<string, unknown> | null)[] = [
  { thinkingBudget: 0 },
  { thinkingLevel: "low" },
  null,
];

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// retry: transient (overloaded, empty/garbled reply) -> try again, maybe on the same model
// skip:  this model is unusable right now (renamed/retired, its quota is used up) -> other models only
// fatal: no model will do better (bad API key, blocked request) -> stop
type FailureKind = "retry" | "skip" | "fatal";

class ModelError extends Error {
  constructor(message: string, readonly kind: FailureKind) {
    super(message);
  }
}

async function callGemini(model: string, apiKey: string, parts: unknown[], signal: AbortSignal, thinkingIdx = 0) {
  const thinkingConfig = THINKING_OPTIONS[thinkingIdx];
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          maxOutputTokens: 8192,
          ...(thinkingConfig ? { thinkingConfig } : {}),
        },
      }),
    },
  );

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    if (res.status === 400 && thinkingConfig && /thinking/i.test(detail)) {
      return callGemini(model, apiKey, parts, signal, thinkingIdx + 1);
    }
    const kind: FailureKind = res.status === 404 || res.status === 429 ? "skip"
      : res.status >= 500 || res.status === 408 ? "retry"
      : "fatal";
    throw new ModelError(`${model}: HTTP ${res.status} ${detail}`, kind);
  }

  const { text, finishReason, blockReason } = responseText(await res.json());
  if (blockReason) throw new ModelError(`${model}: request blocked (${blockReason})`, "fatal");
  if (!text) throw new ModelError(`${model}: empty response (${finishReason || "no candidates"})`, "retry");

  try {
    return normalizeExtraction(parseModelJson(text));
  } catch {
    const why = finishReason === "MAX_TOKENS" ? "response was cut off" : "malformed JSON";
    throw new ModelError(`${model}: ${why}`, "retry");
  }
}

type Extracted = Awaited<ReturnType<typeof callGemini>>;

/**
 * Tries the models in rotation until one returns a good answer, within MAX_ATTEMPTS and DEADLINE_MS.
 * - A slow call is not waited for: after HEDGE_MS another call starts in parallel.
 * - Transient failures (Gemini's free tier often answers "503 overloaded") are retried after a pause.
 * The first good answer wins and the other calls are aborted.
 */
function extractWithFallback(models: string[], apiKey: string, parts: unknown[]) {
  return new Promise<{ data: Extracted; model: string }>((resolve, reject) => {
    const deadline = Date.now() + DEADLINE_MS;
    const winner = new AbortController();
    const errors: string[] = [];
    const skipped = new Set<string>();
    let cursor = 0, attempts = 0, failures = 0, running = 0, settled = false, waiting = false;
    let hedge: ReturnType<typeof setTimeout> | undefined;

    const finish = (ok?: { data: Extracted; model: string }) => {
      settled = true;
      clearTimeout(hedge);
      winner.abort();
      ok ? resolve(ok) : reject(errors);
    };

    const nextModel = () => {
      for (let i = 0; i < models.length; i++) {
        const m = models[(cursor + i) % models.length];
        if (!skipped.has(m)) {
          cursor = (cursor + i + 1) % models.length;
          return m;
        }
      }
      return null;
    };

    const launch = () => {
      if (settled) return;
      const remaining = deadline - Date.now();
      const model = attempts < MAX_ATTEMPTS && remaining >= 5_000 ? nextModel() : null;
      if (!model) {
        if (running === 0 && !waiting) finish();
        return;
      }
      attempts++;
      running++;
      clearTimeout(hedge);
      hedge = setTimeout(launch, HEDGE_MS);
      const t0 = Date.now();
      const signal = AbortSignal.any([winner.signal, AbortSignal.timeout(Math.min(remaining, ATTEMPT_MS))]);
      callGemini(model, apiKey, parts, signal).then(
        (data) => {
          if (settled) return;
          console.log(`gemini-extract: ${model} ok in ${Date.now() - t0} ms (attempt ${attempts})`);
          finish({ data, model });
        },
        (err) => {
          if (settled) return;
          running--;
          const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
          const msg = timedOut ? `${model}: timed out after ${Date.now() - t0} ms`
            : err instanceof Error ? err.message : String(err);
          errors.push(msg);
          console.error("gemini-extract:", msg);
          const kind: FailureKind = err instanceof ModelError ? err.kind : "retry"; // network errors are transient
          if (kind === "fatal") {
            attempts = MAX_ATTEMPTS;
            if (running === 0) finish();
            return;
          }
          if (kind === "skip" || timedOut) skipped.add(model);
          if (running > 0) return; // another call is still in flight; the hedge timer covers relaunching
          const delay = RETRY_DELAYS_MS[Math.min(failures++, RETRY_DELAYS_MS.length - 1)];
          waiting = true;
          setTimeout(() => {
            waiting = false;
            launch();
          }, delay);
        },
      );
    };

    launch();
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  // Only signed-in users of this project may spend the API quota.
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { persistSession: false } },
  );
  const { data: userData, error: authError } = token ? await supabase.auth.getUser(token) : { data: null, error: true };
  if (authError || !userData?.user) return json(401, { error: "Please sign in again." });

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return json(500, { error: "GEMINI_API_KEY secret is not configured on the server." });

  let body: { files?: { mimeType?: string; data?: string }[] };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid request body." });
  }

  const files = Array.isArray(body?.files) ? body.files : [];
  if (files.length === 0) return json(400, { error: "No document attached." });
  if (files.length > MAX_FILES) return json(400, { error: `Attach at most ${MAX_FILES} pages/files.` });
  let totalChars = 0;
  for (const f of files) {
    if (!f?.data || typeof f.data !== "string" || !ALLOWED_MIME.has(f.mimeType || "")) {
      return json(400, { error: `Unsupported file type: ${f?.mimeType || "unknown"}. Use JPG, PNG, WEBP, HEIC or PDF.` });
    }
    totalChars += f.data.length;
  }
  if (totalChars > MAX_BASE64_CHARS) return json(413, { error: "Files are too large. Keep the total under ~13 MB." });

  const parts = [
    ...files.map((f) => ({ inlineData: { mimeType: f.mimeType, data: f.data } })),
    { text: USER_PROMPT },
  ];

  const models = (Deno.env.get("GEMINI_MODELS") || DEFAULT_MODELS).split(",").map((m) => m.trim()).filter(Boolean);
  let errors: string[] = [];
  try {
    return json(200, await extractWithFallback(models, apiKey, parts));
  } catch (errs) {
    errors = Array.isArray(errs) ? errs : [String(errs)];
  }

  const quota = errors.length > 0 && errors.every((e) => e.includes("HTTP 429"));
  const slow = errors.length > 0 && errors.every((e) => e.includes("timed out"));
  return json(502, {
    error: quota
      ? "The free AI quota is used up for now. Try again in a minute, or fill the form manually."
      : slow
      ? "The AI service is too slow right now. Try again, upload fewer pages, or fill the form manually."
      : errors.some((e) => /HTTP 40[03]/.test(e) && /api.?key/i.test(e))
      ? "The Gemini API key was rejected. Check the GEMINI_API_KEY secret in Supabase."
      : errors.some((e) => /HTTP 50[03]/.test(e))
      ? "Google's free AI service is busy right now. Please try again in a moment, or fill the form manually."
      : "Could not read the document. Try a clearer photo, or fill the form manually.",
    details: errors,
  });
});
