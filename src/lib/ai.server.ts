const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.7-flash";

export class AiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function callAi(opts: {
  system: string;
  user: string;
  json?: boolean;
  messages?: { role: string; content: string }[];
}): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new AiError(401, "AI is not configured for this workspace.");

  const messages = opts.messages
    ? [{ role: "system", content: opts.system }, ...opts.messages]
    : [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ];

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "Lovable-API-Key": key,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 429)
      throw new AiError(429, "AURA is handling a lot of requests right now. Try again in a moment.");
    if (res.status === 402)
      throw new AiError(402, "AI credits are exhausted for this workspace. Add credits to continue.");
    throw new AiError(res.status, text.slice(0, 300) || "The AI request failed.");
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "";
}

export function parseJson<T>(raw: string, fallback: T): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        /* ignore */
      }
    }
    return fallback;
  }
}

export const BASE_STYLE = `You are AURA, the assistant inside AURAwork, a productivity workspace for busy managers.
Write concisely, professionally and practically. Prefer specifics over generalities.
If the manager has not given enough context, say so plainly and ask one focused clarifying question inside the output rather than inventing detail.
Never use emoji. Never pad with filler.`;
