// transcribe-lyrics
// Listens to a user's uploaded song (audio or video) and returns the sung
// lyrics, formatted for the Create "Lyrics" box ([Verse] / [Chorus] sections).
//
// Uses Gemini 3.8 Flash on the FREE tier of the Gemini API (GEMINI_API_KEY
// secret, already used by auto-categorize). Supabase Edge Functions are also
// on the free plan, so this feature costs nothing.
//
// Body: { url: string, kind: "audio" | "video", mimeType?: string }
// Returns: { lyrics: string, instrumental: boolean }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const MODEL = "gemini-3.8-flash";
const MAX_BYTES = 100 * 1024 * 1024; // inline / URL limit

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const PROMPT = `You are a professional lyrics transcriber.
Listen carefully to the VOCALS in this song and write down the exact lyrics that are sung.

Rules:
- Keep the original language(s) exactly as sung (e.g. Swahili, English, Sheng) — do NOT translate.
- Group lines into sections and label each with a tag on its own line: [Intro], [Verse 1], [Pre-Chorus], [Chorus], [Verse 2], [Bridge], [Outro].
- One sung line per text line. Put a blank line between sections.
- Write repeated choruses out again each time they are sung.
- Do not add timestamps, notes, explanations, artist names or quotes.
- If a word is unclear, write your best guess — never write "[inaudible]".
- If the track has no sung or rapped vocals at all, reply with exactly: NO_LYRICS
Output ONLY the lyrics.`;

/** Pull the model's text out of an Interactions API response (steps schema, with legacy fallback). */
function extractText(data: any): string {
  const parts: string[] = [];
  for (const step of data?.steps ?? []) {
    if (step?.type === "model_output") {
      for (const c of step.content ?? []) if (c?.type === "text" && c.text) parts.push(c.text);
    }
  }
  if (!parts.length) {
    for (const o of data?.outputs ?? []) if (o?.type === "text" && o.text) parts.push(o.text);
  }
  if (!parts.length && typeof data?.output_text === "string") parts.push(data.output_text);
  return parts.join("").trim();
}

function audioMime(url: string, given?: string): string {
  if (given && given.startsWith("audio/")) return given;
  const ext = (url.split("?")[0].match(/\.([a-z0-9]+)$/i)?.[1] || "").toLowerCase();
  switch (ext) {
    case "mp3": return "audio/mp3";
    case "wav": return "audio/wav";
    case "ogg": return "audio/ogg";
    case "flac": return "audio/flac";
    case "aac": return "audio/aac";
    case "aiff":
    case "aif": return "audio/aiff";
    default: return "audio/mp4"; // m4a / mp4 audio
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (!GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY is not set" }, 500);

    const { url, kind, mimeType } = await req.json();
    if (!url || (kind !== "audio" && kind !== "video")) {
      return json({ error: "Missing url or kind" }, 400);
    }
    // Only transcribe files from OUR storage (prevents using this as a free proxy)
    if (SUPABASE_URL && !String(url).startsWith(SUPABASE_URL)) {
      return json({ error: "Invalid source url" }, 400);
    }

    // Download media to send as inlineData (limit 20MB for inlineData)
    const MAX_INLINE_BYTES = 20 * 1024 * 1024;
    const res = await fetch(url);
    if (!res.ok) return json({ error: `Could not read media (${res.status})` }, 400);
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > MAX_INLINE_BYTES) return json({ error: "File is too large (max 20MB)" }, 413);
    
    const base64Data = encodeBase64(buf);
    const finalMimeType = kind === "video" ? (mimeType || "video/mp4") : audioMime(url, mimeType);

    const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inlineData: {
                mimeType: finalMimeType,
                data: base64Data
              }
            },
            { text: PROMPT }
          ]
        }]
      }),
    });

    const data = await aiRes.json().catch(() => ({}));
    if (!aiRes.ok) {
      const msg = data?.error?.message || `Gemini error ${aiRes.status}`;
      return json({ error: msg, rateLimited: aiRes.status === 429 }, aiRes.status === 429 ? 429 : 502);
    }

    const text = (data?.candidates?.[0]?.content?.parts ?? [])
      .filter((p: any) => p?.text && !p?.thought)
      .map((p: any) => p.text)
      .join("");
    const cleanText = text
      .replace(/^```[a-z]*\n?|```$/gim, "") // strip accidental code fences
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (!cleanText || /^NO_LYRICS\b/i.test(cleanText)) {
      return json({ lyrics: "", instrumental: true });
    }
    return json({ lyrics: cleanText.slice(0, 5000), instrumental: false }); // Suno lyrics limit
  } catch (e: any) {
    return json({ error: e?.message || "Transcription failed" }, 500);
  }
});
