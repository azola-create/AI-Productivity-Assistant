import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { CalendarCheck, Check, FileDown, FileText, Loader2, Mail, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app-shell";
import {
  AiNotice,
  AssumptionsCard,
  AuditTrail,
  ReadAloud,
  RegenerationHistory,
  ReviewGate,
  type RegenVersion,
} from "@/components/ai-output";
import { EmptyState, ErrorState, LoadingLines } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { summariseMeeting, type MeetingSummary } from "@/lib/ai.functions";
import { useAuditEvents, useAuditLog } from "@/lib/audit";
import { summariseChanges } from "@/lib/diff";
import { exportDocx, exportPdf } from "@/lib/export";
import { useInvalidateWorkspace, useMeetings } from "@/lib/queries";
import { setEmailPrefill, setPlanPrefill } from "@/lib/handoff";
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

const toLines = (v: string) =>
  v
    .split("\n")
    .map((l) => l.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);

const snapshotOf = (s: MeetingSummary) => ({
  Title: s.title,
  Summary: s.summary,
  "Key points": s.keyPoints,
  Decisions: s.decisions,
  Actions: s.actions.map((a) => `${a.title} — ${a.owner} — ${a.deadline}`),
});

const summaryToText = (s: MeetingSummary) =>
  [
    s.title,
    s.summary,
    ...s.keyPoints.map((k) => `Key point: ${k}`),
    ...s.decisions.map((d) => `Decision: ${d}`),
    ...s.actions.map((a) => `Action: ${a.title} (${a.owner}) ${a.deadline}`),
  ].join("\n");

function MeetingsPage() {
  const { user } = useAuth();
  const invalidate = useInvalidateWorkspace();
  const meetingsQ = useMeetings();
  const meetings = meetingsQ.data;
  const navigate = useNavigate();
  const [approvedIds, setApprovedIds] = useState<string[]>([]);
  const [approving, setApproving] = useState(false);
  const summarise = useServerFn(summariseMeeting);
  const logAudit = useAuditLog("meetings");
  const auditQ = useAuditEvents("meetings");

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [summary, setSummary] = useState<MeetingSummary | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [reviewed, setReviewed] = useState(false);
  const [edited, setEdited] = useState(false);
  const [versions, setVersions] = useState<RegenVersion[]>([]);

  function editSummary(next: MeetingSummary) {
    setSummary(next);
    setReviewed(false);
    if (!edited) {
      setEdited(true);
      void logAudit("edited", { item: next.title, detail: "Manual edits made to the AI meeting summary." });
    }
  }

  function confirmReview(v: boolean) {
    setReviewed(v);
    if (v) {
      void logAudit("reviewed", {
        item: summary?.title ?? "Meeting summary",
        detail: "Confirmed the summary and actions were reviewed and edited.",
      });
    }
  }

  const run = useMutation({
    mutationFn: async (mode: "generate" | "regenerate") =>
      summarise({
        data: {
          notes,
          today: format(new Date(), "yyyy-MM-dd"),
          existing: mode === "regenerate" && summary ? summaryToText(summary) : "",
        },
      }),
    onSuccess: async (result, mode) => {
      const previous = summary;
      setSummary(result);
      setActions(result.actions.map((a) => ({ ...a, include: true })));
      setReviewed(false);
      setEdited(false);

      if (mode === "regenerate" && previous) {
        const restorePoint = previous;
        setVersions((v) => [
          {
            id: `${Date.now()}`,
            label: `Regeneration ${v.length + 1}`,
            at: new Date().toISOString(),
            changes: summariseChanges(snapshotOf(previous), snapshotOf(result)),
            restore: () => {
              setSummary(restorePoint);
              setActions(restorePoint.actions.map((a) => ({ ...a, include: true })));
              setReviewed(false);
              toast("Previous summary restored");
            },
          },
          ...v,
        ]);
        void logAudit("regenerated", {
          item: result.title,
          detail: "Regenerated using the manager's current edits as context.",
        });
        toast.success("Summary regenerated", { description: "Check the regeneration history for what changed." });
      } else {
        setVersions([]);
        void logAudit("generated", { item: result.title, detail: "Summary generated from pasted meeting notes." });
      }

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

  const readable = summary ? [summary.summary, ...summary.keyPoints, ...summary.decisions].join(". ") : "";
  const gateHint = "Confirm you reviewed and edited this summary first.";

  async function approveActions() {
    if (!user) {
      toast.error("You need to be signed in.");
      return;
    }
    const chosen = actions.filter((a) => a.include);
    if (!chosen.length) {
      toast.error("Select at least one action.");
      return;
    }
    setApproving(true);
    const { data, error } = await supabase
      .from("tasks")
      .insert(
        chosen.map((a) => ({
          user_id: user.id,
          title: a.title,
          description: a.owner ? `Owner: ${a.owner}` : "",
          deadline: a.deadline ? new Date(`${a.deadline}T09:00:00`).toISOString() : null,
          duration_minutes: a.durationMinutes || 60,
          ai_priority: a.priority,
          source: "meeting",
        })),
      )
      .select("id");
    setApproving(false);
    if (error) {
      toast.error("Could not add the tasks", { description: error.message });
      return;
    }
    const ids = (data ?? []).map((r) => r.id);
    setApprovedIds(ids);
    invalidate();
    void logAudit("approved", {
      item: summary?.title ?? "Meeting actions",
      detail: `${chosen.length} reviewed action${chosen.length > 1 ? "s" : ""} added to the Task Library.`,
    });
    toast.success(`${chosen.length} action${chosen.length > 1 ? "s" : ""} added to your Task Library`, {
      description: "Plan them into your day or turn them into a follow-up email.",
      action: {
        label: "Undo",
        onClick: () => {
          void (async () => {
            const { error: undoError } = await supabase.from("tasks").delete().in("id", ids);
            if (undoError) {
              toast.error("Could not undo", { description: undoError.message });
              return;
            }
            setApprovedIds([]);
            invalidate();
            toast("Approved actions removed again");
          })();
        },
      },
    });
  }

  function planApproved() {
    if (!approvedIds.length) return;
    setPlanPrefill({ taskIds: approvedIds, label: summary?.title ?? "Meeting actions" });
    void navigate({ to: "/plan" });
  }

  function draftFollowUp() {
    if (!summary) return;
    const chosen = actions.filter((a) => a.include);
    setEmailPrefill({
      audience: "Meeting attendees",
      objective: `Send a follow-up after "${summary.title}" confirming decisions and next steps`,
      context: summary.summary,
      keyPoints: [
        ...summary.decisions.map((d) => `Decision: ${d}`),
        ...(chosen.length ? chosen : actions).map(
          (a) => `Action: ${a.title}${a.owner ? ` (${a.owner})` : ""}${a.deadline ? ` by ${a.deadline}` : ""}`,
        ),
      ].join("\n"),
      tone: "Professional",
    });
    void navigate({ to: "/email" });
  }

  const sections = summary
    ? [
        { heading: "Summary", body: summary.summary },
        { heading: "Key points", bullets: summary.keyPoints },
        { heading: "Decisions", bullets: summary.decisions },
        { heading: "Action items", bullets: summary.actions.map((a) => `${a.title} — ${a.owner}`) },
      ]
    : [];

  function exportAs(kind: "PDF" | "Word") {
    if (!summary) return;
    void (kind === "PDF" ? exportPdf(summary.title, sections) : exportDocx(summary.title, sections));
    void logAudit("exported", { item: summary.title, detail: `Exported as ${kind} with the AI disclaimer attached.` });
  }

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
          <Button disabled={!notes.trim() || run.isPending} onClick={() => run.mutate("generate")}>
            {run.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
            Summarise notes
          </Button>
        </div>

        <div className="space-y-6">
          {run.isPending && !summary ? (
            <div className="panel space-y-3 p-5" aria-live="polite">
              <p className="text-sm text-muted-foreground">AURA is reading your notes…</p>
              <LoadingLines rows={6} />
            </div>
          ) : run.error && !summary ? (
            <div className="panel p-5">
              <ErrorState message={(run.error as Error).message} onRetry={() => run.mutate("generate")} />
            </div>
          ) : !summary ? (
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
                  <div className="flex flex-wrap gap-2">
                    <ReadAloud text={readable} />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={run.isPending}
                      onClick={() => run.mutate("regenerate")}
                    >
                      {run.isPending ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 size-4" />
                      )}
                      Regenerate with my edits
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!reviewed}
                      title={reviewed ? undefined : gateHint}
                      onClick={() => exportAs("PDF")}
                    >
                      <FileDown className="mr-2 size-4" /> PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!reviewed}
                      title={reviewed ? undefined : gateHint}
                      onClick={() => exportAs("Word")}
                    >
                      <FileDown className="mr-2 size-4" /> Word
                    </Button>
                  </div>
                </div>

                {run.isError ? (
                  <ErrorState
                    message={(run.error as Error).message || "That regeneration failed."}
                    onRetry={() => run.mutate("regenerate")}
                  />
                ) : null}

                <div className="space-y-1.5">
                  <Label htmlFor="m-summary">Summary</Label>
                  <Textarea
                    id="m-summary"
                    rows={5}
                    value={summary.summary}
                    onChange={(e) => editSummary({ ...summary, summary: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="m-points">Key points (one per line)</Label>
                  <Textarea
                    id="m-points"
                    rows={5}
                    value={summary.keyPoints.join("\n")}
                    onChange={(e) => editSummary({ ...summary, keyPoints: toLines(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="m-decisions">Decisions (one per line)</Label>
                  <Textarea
                    id="m-decisions"
                    rows={4}
                    value={summary.decisions.join("\n")}
                    onChange={(e) => editSummary({ ...summary, decisions: toLines(e.target.value) })}
                  />
                </div>

                <AssumptionsCard assumptions={summary.assumptions} uncertainties={summary.uncertainties} />
                <RegenerationHistory versions={versions} />
                <ReviewGate
                  id="meeting-review-gate"
                  checked={reviewed}
                  onChange={confirmReview}
                  hint="Required before you can export this summary or approve its actions."
                />
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
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={approving || !reviewed}
                    title={reviewed ? undefined : gateHint}
                    onClick={() => void approveActions()}
                  >
                    {approving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />}
                    Approve selected actions
                  </Button>
                  <Button variant="outline" disabled={!approvedIds.length} onClick={planApproved}>
                    <CalendarCheck className="mr-2 size-4" /> Plan approved tasks
                  </Button>
                  <Button variant="outline" disabled={!reviewed} title={reviewed ? undefined : gateHint} onClick={draftFollowUp}>
                    <Mail className="mr-2 size-4" /> Draft follow-up email
                  </Button>
                </div>
              </div>
            </>
          )}

          <div className="panel space-y-2 p-5">
            <h3 className="text-base font-semibold">Recent meetings</h3>
            {meetingsQ.isLoading ? (
              <LoadingLines rows={3} />
            ) : meetingsQ.error ? (
              <ErrorState message={(meetingsQ.error as Error).message} onRetry={() => void meetingsQ.refetch()} />
            ) : !meetings || meetings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Summarised meetings will be listed here for quick reference.
              </p>
            ) : (
              <ul className="text-sm text-muted-foreground">
                {meetings.slice(0, 5).map((m) => (
                  <li key={m.id} className="flex justify-between gap-3 border-b border-border py-2 last:border-0">
                    <span className="truncate text-foreground">{m.title}</span>
                    <span className="shrink-0">{format(new Date(m.created_at), "d MMM")}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <AuditTrail events={auditQ.data ?? []} isLoading={auditQ.isLoading} />
        </div>
      </div>
    </AppLayout>
  );
}
