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
const DEADLINE_MS = 140_000; // stay under the Edge Function wall-clock limit
const DEFAULT_MODELS = "gemini-flash-latest,gemini-2.5-flash,gemini-flash-lite-latest";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

class ModelError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
  }
}

async function callGemini(model: string, apiKey: string, parts: unknown[], timeoutMs: number) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          maxOutputTokens: 16384,
        },
      }),
    },
  );

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    // 404: model renamed/retired, 429: free-tier quota, 5xx: overloaded -> try the next model
    const retryable = res.status === 404 || res.status === 429 || res.status >= 500;
    throw new ModelError(`${model}: HTTP ${res.status} ${detail}`, retryable);
  }

  const { text, finishReason, blockReason } = responseText(await res.json());
  if (blockReason) throw new ModelError(`${model}: request blocked (${blockReason})`, false);
  if (!text) throw new ModelError(`${model}: empty response (${finishReason || "no candidates"})`, true);

  try {
    return normalizeExtraction(parseModelJson(text));
  } catch {
    const why = finishReason === "MAX_TOKENS" ? "response was cut off" : "malformed JSON";
    throw new ModelError(`${model}: ${why}`, true);
  }
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
  const started = Date.now();
  const errors: string[] = [];

  for (const model of models) {
    const remaining = DEADLINE_MS - (Date.now() - started);
    if (remaining < 10_000) break;
    try {
      const data = await callGemini(model, apiKey, parts, remaining);
      return json(200, { data, model });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(msg);
      console.error("gemini-extract:", msg);
      if (err instanceof ModelError && !err.retryable) break;
    }
  }

  const quota = errors.some((e) => e.includes("HTTP 429"));
  return json(502, {
    error: quota
      ? "The free AI quota is used up for now. Try again in a minute, or fill the form manually."
      : "Could not read the document. Try a clearer photo, or fill the form manually.",
    details: errors,
  });
});
