import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAi, parseJson, BASE_STYLE, AiError } from "./ai.server";

const taskInput = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional().default(""),
  deadline: z.string().nullable().optional(),
  duration_minutes: z.number(),
  urgency: z.number(),
  importance: z.number(),
});

function fail(e: unknown): never {
  if (e instanceof AiError) throw new Error(e.message);
  throw new Error(e instanceof Error ? e.message : "Something went wrong. Please retry.");
}

/* ---------------------------------- plan --------------------------------- */

export type PlannedBlock = {
  title: string;
  start: string;
  end: string;
  kind: "focus" | "task" | "break" | "admin";
  taskId: string | null;
  rationale: string;
};
export type DayPlan = { blocks: PlannedBlock[]; explanation: string };

export const generateDayPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        date: z.string(),
        workStart: z.string(),
        workEnd: z.string(),
        tasks: z.array(taskInput),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<DayPlan> => {
    try {
      const raw = await callAi({
        system: `${BASE_STYLE}
You build realistic time-blocked day plans. Respect the working window exactly. Never schedule outside it.
Weigh urgency, importance, deadline proximity and estimated duration. Protect the longest uninterrupted morning block for the highest-value deep work and mark it kind "focus".
Include one short break. Leave a little slack; do not fill every minute.
Reply with JSON only:
{"blocks":[{"title":string,"start":"HH:MM","end":"HH:MM","kind":"focus"|"task"|"break"|"admin","taskId":string|null,"rationale":string}],"explanation":string}
"explanation" is 2-3 sentences a manager can read aloud, explaining the ordering trade-offs and any missing context.`,
        user: JSON.stringify(data),
        json: true,
      });
      const parsed = parseJson<DayPlan>(raw, { blocks: [], explanation: "" });
      return { blocks: parsed.blocks ?? [], explanation: parsed.explanation ?? "" };
    } catch (e) {
      fail(e);
    }
  });

/* -------------------------------- insight -------------------------------- */

export type AuraInsight = {
  headline: string;
  recommendation: string;
  start: string;
  end: string;
  taskTitle: string;
};

export const generateInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        now: z.string(),
        workStart: z.string(),
        workEnd: z.string(),
        avoid: z.array(z.object({ title: z.string(), start: z.string(), end: z.string() })),
        tasks: z.array(taskInput),
        nudge: z.string().optional().default(""),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<AuraInsight> => {
    try {
      const raw = await callAi({
        system: `${BASE_STYLE}
Your single job is protecting uninterrupted focus time. Assess priority tasks, deadlines, remaining time today, task durations and already-booked blocks.
Find the longest free, uninterrupted window inside the working hours that does not clash with booked blocks, and match it to the task that most needs deep work before its deadline.
Reply with JSON only:
{"headline":string,"recommendation":string,"start":"HH:MM","end":"HH:MM","taskTitle":string}
"recommendation" is ONE short actionable sentence, e.g. "Protect 09:30-11:00 for the quarterly report. This is your longest uninterrupted block before tomorrow's deadline."
If there is not enough information, say so in one sentence and still propose the best available window.`,
        user: JSON.stringify(data),
        json: true,
      });
      return parseJson<AuraInsight>(raw, {
        headline: "Protect your focus",
        recommendation: "Not enough context yet — add a task with a deadline and duration.",
        start: "09:30",
        end: "11:00",
        taskTitle: "",
      });
    } catch (e) {
      fail(e);
    }
  });

/* -------------------------------- meeting -------------------------------- */

export type MeetingSummary = {
  title: string;
  summary: string;
  keyPoints: string[];
  decisions: string[];
  actions: {
    title: string;
    owner: string;
    deadline: string;
    durationMinutes: number;
    priority: "high" | "medium" | "low";
  }[];
};

export const summariseMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ notes: z.string().min(1), today: z.string() }).parse(d))
  .handler(async ({ data }): Promise<MeetingSummary> => {
    try {
      const raw = await callAi({
        system: `${BASE_STYLE}
Summarise pasted meeting notes for a manager. Be faithful to the notes; never invent decisions.
Deadlines must be ISO dates (YYYY-MM-DD) inferred sensibly from today's date; use "" when the notes give no signal.
Owners are suggestions only — use "Unassigned" if unclear.
Reply with JSON only:
{"title":string,"summary":string,"keyPoints":string[],"decisions":string[],"actions":[{"title":string,"owner":string,"deadline":string,"durationMinutes":number,"priority":"high"|"medium"|"low"}]}
"summary" is 2-4 sentences. Keep each list item to one line.`,
        user: `Today is ${data.today}.\n\nMeeting notes:\n${data.notes}`,
        json: true,
      });
      const parsed = parseJson<MeetingSummary>(raw, {
        title: "Meeting summary",
        summary: "",
        keyPoints: [],
        decisions: [],
        actions: [],
      });
      return {
        title: parsed.title || "Meeting summary",
        summary: parsed.summary || "",
        keyPoints: parsed.keyPoints ?? [],
        decisions: parsed.decisions ?? [],
        actions: parsed.actions ?? [],
      };
    } catch (e) {
      fail(e);
    }
  });

/* --------------------------------- email --------------------------------- */

export type EmailDraft = {
  subject: string;
  greeting: string;
  body: string;
  callToAction: string;
  signature: string;
};

export const draftEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        audience: z.string(),
        objective: z.string(),
        context: z.string().optional().default(""),
        keyPoints: z.string().optional().default(""),
        tone: z.string(),
        senderName: z.string().optional().default(""),
        mode: z.enum(["generate", "shorten", "expand"]).optional().default("generate"),
        existing: z.string().optional().default(""),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<EmailDraft> => {
    const modeLine =
      data.mode === "shorten"
        ? "Rewrite the existing draft to be materially shorter while keeping every commitment and the call to action."
        : data.mode === "expand"
          ? "Expand the existing draft with useful specifics and context. Do not pad with filler."
          : "Write a fresh draft.";
    try {
      const raw = await callAi({
        system: `${BASE_STYLE}
You write workplace email for a manager. ${modeLine}
Match the requested tone exactly. Keep the body scannable — short paragraphs, a bullet list only when it genuinely helps.
Reply with JSON only:
{"subject":string,"greeting":string,"body":string,"callToAction":string,"signature":string}
Use \\n for line breaks inside body. The signature ends with the sender's name.
If key context is missing, include one bracketed placeholder such as [confirm date] rather than inventing facts.`,
        user: JSON.stringify(data),
        json: true,
      });
      return parseJson<EmailDraft>(raw, {
        subject: "",
        greeting: "",
        body: "",
        callToAction: "",
        signature: "",
      });
    } catch (e) {
      fail(e);
    }
  });

/* -------------------------------- research -------------------------------- */

export type ResearchOutput = {
  title: string;
  executiveSummary: string;
  insights: string[];
  recommendations: string[];
};

export const analyseResearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ text: z.string().min(1) }).parse(d))
  .handler(async ({ data }): Promise<ResearchOutput> => {
    try {
      const raw = await callAi({
        system: `${BASE_STYLE}
Analyse pasted article text for a manager who has three minutes. Stay strictly inside the supplied text; flag gaps instead of filling them.
Reply with JSON only:
{"title":string,"executiveSummary":string,"insights":string[],"recommendations":string[]}
"executiveSummary" is 3-5 sentences. Insights are factual takeaways; recommendations are practical actions for the manager.`,
        user: data.text.slice(0, 40000),
        json: true,
      });
      return parseJson<ResearchOutput>(raw, {
        title: "Research summary",
        executiveSummary: "",
        insights: [],
        recommendations: [],
      });
    } catch (e) {
      fail(e);
    }
  });

/* ---------------------------------- chat --------------------------------- */

export const auraChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<string> => {
    try {
      return await callAi({
        system: `${BASE_STYLE}
This is AURA Chat: a general workplace assistant. You do not have access to the manager's tasks, plans or meeting records — say so if asked about them and point to the relevant AURAwork screen.
Answer in a calm, professional, concise register. Use short paragraphs or tight bullet lists. Lead with the answer.`,
        user: "",
        messages: data.messages,
      });
    } catch (e) {
      fail(e);
    }
  });
