import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { Check, FileDown, FileText, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app-shell";
import { AiNotice, ReadAloud } from "@/components/ai-output";
import { EmptyState } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { summariseMeeting, type MeetingSummary } from "@/lib/ai.functions";
import { exportDocx, exportPdf } from "@/lib/export";
import { useInvalidateWorkspace, useMeetings } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/meetings")({
  head: () => ({
    meta: [
      { title: "Meeting Summariser — AURAwork" },
      {
        name: "description",
        content: "Turn raw meeting notes into a clear summary, decisions and reviewed action items.",
      },
      { property: "og:title", content: "Meeting Summariser — AURAwork" },
      {
        property: "og:description",
        content: "Turn raw meeting notes into a clear summary, decisions and reviewed action items.",
      },
    ],
  }),
  component: MeetingsPage,
});

type Action = MeetingSummary["actions"][number] & { include?: boolean };

function MeetingsPage() {
  const { user } = useAuth();
  const invalidate = useInvalidateWorkspace();
  const { data: meetings } = useMeetings();
  const summarise = useServerFn(summariseMeeting);

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [summary, setSummary] = useState<MeetingSummary | null>(null);
  const [actions, setActions] = useState<Action[]>([]);

  const run = useMutation({
    mutationFn: async () =>
      summarise({ data: { notes, today: format(new Date(), "yyyy-MM-dd") } }),
    onSuccess: async (result) => {
      setSummary(result);
      setActions(result.actions.map((a) => ({ ...a, include: true })));
      if (user) {
        await supabase.from("meetings").insert({
          user_id: user.id,
          title: title.trim() || result.title,
          raw_notes: notes,
          summary: result as unknown as never,
        });
        invalidate();
      }
    },
    onError: (e: Error) => toast.error("Could not summarise the notes", { description: e.message }),
  });

  const readable = summary
    ? [summary.summary, ...summary.keyPoints, ...summary.decisions].join(". ")
    : "";

  async function approveActions() {
    if (!user) return;
    const chosen = actions.filter((a) => a.include);
    if (!chosen.length) {
      toast.error("Select at least one action.");
      return;
    }
    const { error } = await supabase.from("tasks").insert(
      chosen.map((a) => ({
        user_id: user.id,
        title: a.title,
        description: a.owner ? `Owner: ${a.owner}` : "",
        deadline: a.deadline ? new Date(`${a.deadline}T09:00:00`).toISOString() : null,
        duration_minutes: a.durationMinutes || 60,
        ai_priority: a.priority,
        source: "meeting",
      })),
    );
    if (error) {
      toast.error("Could not add the tasks", { description: error.message });
      return;
    }
    invalidate();
    toast.success(`${chosen.length} action${chosen.length > 1 ? "s" : ""} added to your Task Library`);
  }

  const sections = summary
    ? [
        { heading: "Summary", body: summary.summary },
        { heading: "Key points", bullets: summary.keyPoints },
        { heading: "Decisions", bullets: summary.decisions },
        { heading: "Action items", bullets: summary.actions.map((a) => `${a.title} — ${a.owner}`) },
      ]
    : [];

  return (
    <AppLayout
      eyebrow="AI tool"
      title="Meeting Summariser"
      description="Paste your notes. AURA returns a summary, the decisions taken and action items you approve."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="panel space-y-4 p-5">
          <div className="space-y-1.5">
            <Label htmlFor="m-title">Meeting title (optional)</Label>
            <Input id="m-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Weekly ops review" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-notes">Meeting notes</Label>
            <Textarea
              id="m-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={16}
              placeholder="Paste raw notes, bullet points or a transcript."
            />
          </div>
          <Button disabled={!notes.trim() || run.isPending} onClick={() => run.mutate()}>
            {run.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
            Summarise notes
          </Button>
        </div>

        <div className="space-y-6">
          {!summary ? (
            <div className="panel p-5">
              <EmptyState
                icon={FileText}
                title="No summary yet"
                description="Paste meeting notes and AURA will extract the summary, decisions and actions."
              />
            </div>
          ) : (
            <>
              <div className="panel space-y-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">{summary.title}</h2>
                  <div className="flex gap-2">
                    <ReadAloud text={readable} />
                    <Button size="sm" variant="outline" onClick={() => void exportPdf(summary.title, sections)}>
                      <FileDown className="mr-2 size-4" /> PDF
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void exportDocx(summary.title, sections)}>
                      <FileDown className="mr-2 size-4" /> Word
                    </Button>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{summary.summary}</p>
                <Section title="Key points" items={summary.keyPoints} />
                <Section title="Decisions" items={summary.decisions} />
                <AiNotice />
              </div>

              <div className="panel space-y-4 p-5">
                <h3 className="text-base font-semibold">Action review</h3>
                <p className="text-sm text-muted-foreground">
                  Approve the actions that should become tasks. Nothing is saved to your library until you approve.
                </p>
                <ul className="space-y-3">
                  {actions.map((a, i) => (
                    <li key={`${a.title}-${i}`} className="flex items-start gap-3 rounded-lg border border-border p-3">
                      <Checkbox
                        id={`a-${i}`}
                        checked={a.include ?? false}
                        onCheckedChange={(v) =>
                          setActions((prev) => prev.map((x, j) => (j === i ? { ...x, include: v === true } : x)))
                        }
                      />
                      <label htmlFor={`a-${i}`} className="flex-1 cursor-pointer text-sm">
                        <span className="font-medium text-foreground">{a.title}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {a.owner || "Unassigned"} · {a.deadline || "No date"} · {a.durationMinutes || 60} min
                        </span>
                      </label>
                      <StatusBadge tone={a.priority === "high" ? "risk" : a.priority === "low" ? "muted" : "focus"}>
                        {a.priority}
                      </StatusBadge>
                    </li>
                  ))}
                </ul>
                <Button onClick={() => void approveActions()}>
                  <Check className="mr-2 size-4" /> Approve selected actions
                </Button>
              </div>
            </>
          )}

          {meetings && meetings.length > 0 ? (
            <div className="panel space-y-2 p-5">
              <h3 className="text-base font-semibold">Recent meetings</h3>
              <ul className="text-sm text-muted-foreground">
                {meetings.slice(0, 5).map((m) => (
                  <li key={m.id} className="flex justify-between gap-3 border-b border-border py-2 last:border-0">
                    <span className="truncate text-foreground">{m.title}</span>
                    <span className="shrink-0">{format(new Date(m.created_at), "d MMM")}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </AppLayout>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/60" />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
