import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Secure server-side text-to-speech.
 * Uses the ElevenLabs Hermes voice when ELEVENLABS_API_KEY is configured.
 * The API key never leaves the server; the client receives base64 audio only.
 * When no key is configured the client falls back to built-in browser speech.
 */
export const speakText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ text: z.string().min(1).max(5000), speed: z.number().min(0.7).max(1.2).optional() }).parse(d),
  )
  .handler(async ({ data }): Promise<{ audio: string | null; reason?: string }> => {
    const key = process.env["ELEVENLABS_API_KEY"];
    if (!key) return { audio: null, reason: "not_configured" };

    const voiceId = process.env["ELEVENLABS_VOICE_ID"] || "hermes";
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: data.text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: { stability: 0.4, similarity_boost: 0.75, speed: data.speed ?? 1 },
        }),
      },
    );

    if (!res.ok) {
      return { audio: null, reason: "provider_error" };
    }

    const buf = new Uint8Array(await res.arrayBuffer());
    let binary = "";
    for (let i = 0; i < buf.length; i += 0x8000) {
      binary += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    }
    return { audio: btoa(binary) };
  });
