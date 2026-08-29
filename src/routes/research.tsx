import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { FileDown, Loader2, RefreshCw, Save, Search, Sparkles } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { analyseResearch, type ResearchOutput } from "@/lib/ai.functions";
import { useAuditEvents, useAuditLog } from "@/lib/audit";
import { summariseChanges } from "@/lib/diff";
import { exportDocx, exportPdf } from "@/lib/export";
import { useInvalidateWorkspace, useResearch } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/research")({
  head: () => ({
    meta: [
      { title: "Research Assistant — AURAwork" },
      { name: "description", content: "Turn long articles into an executive summary, insights and recommendations." },
      { property: "og:title", content: "Research Assistant — AURAwork" },
      {
        property: "og:description",
        content: "Turn long articles into an executive summary, insights and recommendations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResearchPage,
});

const toLines = (v: string) =>
  v
    .split("\n")
    .map((l) => l.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);

const snapshotOf = (o: ResearchOutput) => ({
  Title: o.title,
  "Executive summary": o.executiveSummary,
  Insights: o.insights,
  Recommendations: o.recommendations,
});

const outputToText = (o: ResearchOutput) =>
  [o.executiveSummary, ...o.insights, ...o.recommendations].join("\n");

function ResearchPage() {
  const { user } = useAuth();
  const invalidate = useInvalidateWorkspace();
  const historyQ = useResearch();
  const analyse = useServerFn(analyseResearch);
  const logAudit = useAuditLog("research");
  const auditQ = useAuditEvents("research");

  const [text, setText] = useState("");
  const [output, setOutput] = useState<ResearchOutput | null>(null);
  const [saved, setSaved] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [edited, setEdited] = useState(false);
  const [versions, setVersions] = useState<RegenVersion[]>([]);

  // Any edit invalidates the review confirmation.
  function editOutput(next: ResearchOutput) {
    setOutput(next);
    setSaved(false);
    setReviewed(false);
    if (!edited) {
      setEdited(true);
      void logAudit("edited", { item: next.title, detail: "Manual edits made to the AI analysis." });
    }
  }

  function confirmReview(v: boolean) {
    setReviewed(v);
    if (v) {
      void logAudit("reviewed", {
        item: output?.title ?? "Research analysis",
        detail: "Confirmed the analysis was reviewed and edited.",
      });
    }
  }

  const run = useMutation({
    mutationFn: async (mode: "generate" | "regenerate") =>
      analyse({ data: { text, existing: mode === "regenerate" && output ? outputToText(output) : "" } }),
    onSuccess: (result, mode) => {
      const previous = output;
      setOutput(result);
      setSaved(false);
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
              setOutput(restorePoint);
              setReviewed(false);
              setSaved(false);
              toast("Previous version restored");
            },
          },
          ...v,
        ]);
        void logAudit("regenerated", {
          item: result.title,
          detail: "Regenerated using the manager's current edits as context.",
        });
        toast.success("Analysis regenerated", { description: "Check the regeneration history for what changed." });
        return;
      }

      setVersions([]);
      void logAudit("generated", { item: result.title, detail: "First analysis generated from pasted text." });
      toast.success("Analysis ready", { description: "Edit anything before you save it." });
    },
    onError: (e: Error) => toast.error("Could not analyse the text", { description: e.message }),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("You need to be signed in to save.");
      if (!output) throw new Error("Nothing to save yet.");
      const { data, error } = await supabase
        .from("research_items")
        .insert({
          user_id: user.id,
          title: output.title,
          source_text: text.slice(0, 40000),
          output: output as unknown as never,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return data.id as string;
    },
    onSuccess: (id) => {
      setSaved(true);
      invalidate();
      void logAudit("saved", { item: output?.title, itemId: id, detail: "Saved to the workspace after review." });
      toast.success("Analysis saved", {
        description: output?.title,
        action: {
          label: "Undo",
          onClick: async () => {
            const { error } = await supabase.from("research_items").delete().eq("id", id);
            if (error) {
              toast.error("Could not undo", { description: error.message });
              return;
            }
            setSaved(false);
            invalidate();
            toast("Save undone");
          },
        },
      });
    },
    onError: (e: Error) => toast.error("Could not save the analysis", { description: e.message }),
  });

  const sections = output
    ? [
        { heading: "Executive summary", body: output.executiveSummary },
        { heading: "Insights", bullets: output.insights },
        { heading: "Recommendations", bullets: output.recommendations },
      ]
    : [];

  const readable = output ? [output.executiveSummary, ...output.insights, ...output.recommendations].join(". ") : "";
  const gateHint = "Confirm you reviewed and edited this analysis first.";

  function exportAs(kind: "PDF" | "Word") {
    if (!output) return;
    void (kind === "PDF" ? exportPdf(output.title, sections) : exportDocx(output.title, sections));
    void logAudit("exported", { item: output.title, detail: `Exported as ${kind} with the AI disclaimer attached.` });
  }

  return (
    <AppLayout
      eyebrow="AI tool"
      title="Research Assistant"
      description="Paste an article or report. AURA returns what matters, and what you should do about it."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="panel space-y-4 p-5">
          <div className="space-y-1.5">
            <Label htmlFor="r-text">Article or report text</Label>
            <Textarea
              id="r-text"
              rows={18}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste the full text here."
            />
          </div>
          <Button disabled={!text.trim() || run.isPending} onClick={() => run.mutate("generate")}>
            {run.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
            {run.isPending ? "Analysing…" : "Analyse text"}
          </Button>
        </div>

        <div className="space-y-6">
          <div className="panel space-y-4 p-5">
            {run.isPending && !output ? (
              <div className="space-y-3">
                <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
                  <Loader2 className="size-4 animate-spin" /> AURA is reading the text…
                </p>
                <LoadingLines rows={7} />
              </div>
            ) : run.isError && !output ? (
              <ErrorState
                message={(run.error as Error).message || "The text could not be analysed."}
                onRetry={() => run.mutate("generate")}
              />
            ) : !output ? (
              <EmptyState
                icon={Search}
                title="Nothing analysed yet"
                description="Paste an article and AURA will summarise it for a three-minute read."
                action={
                  <Button disabled={!text.trim()} onClick={() => run.mutate("generate")}>
                    <Sparkles className="mr-2 size-4" /> Analyse text
                  </Button>
                }
              />
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">Editable analysis</h2>
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
                      onClick={() => save.mutate()}
                      disabled={!reviewed || save.isPending || saved}
                      title={reviewed ? undefined : gateHint}
                    >
                      {save.isPending ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 size-4" />
                      )}
                      {saved ? "Saved" : "Save"}
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
                  <Label htmlFor="r-title">Title</Label>
                  <Input
                    id="r-title"
                    value={output.title}
                    onChange={(e) => editOutput({ ...output, title: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="r-summary">Executive summary</Label>
                  <Textarea
                    id="r-summary"
                    rows={5}
                    value={output.executiveSummary}
                    onChange={(e) => editOutput({ ...output, executiveSummary: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="r-insights">Insights (one per line)</Label>
                  <Textarea
                    id="r-insights"
                    rows={6}
                    value={output.insights.join("\n")}
                    onChange={(e) => editOutput({ ...output, insights: toLines(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="r-recs">Recommendations (one per line)</Label>
                  <Textarea
                    id="r-recs"
                    rows={6}
                    value={output.recommendations.join("\n")}
                    onChange={(e) => editOutput({ ...output, recommendations: toLines(e.target.value) })}
                  />
                </div>

                <AssumptionsCard assumptions={output.assumptions} uncertainties={output.uncertainties} />
                <RegenerationHistory versions={versions} />
                <ReviewGate
                  id="research-review-gate"
                  checked={reviewed}
                  onChange={confirmReview}
                  hint="Required before you can save or export this analysis."
                />
                <AiNotice />
              </>
            )}
          </div>

          <div className="panel space-y-2 p-5">
            <h3 className="text-base font-semibold">Recent analyses</h3>
            {historyQ.isLoading ? (
              <LoadingLines rows={3} />
            ) : historyQ.isError ? (
              <ErrorState
                message={(historyQ.error as Error).message || "History could not be loaded."}
                onRetry={() => void historyQ.refetch()}
              />
            ) : (historyQ.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Saved analyses will appear here.</p>
            ) : (
              <ul className="text-sm text-muted-foreground">
                {(historyQ.data ?? []).slice(0, 5).map((r) => (
                  <li key={r.id} className="flex justify-between gap-3 border-b border-border py-2 last:border-0">
                    <span className="truncate text-foreground">{r.title}</span>
                    <span className="shrink-0">{format(new Date(r.created_at), "d MMM")}</span>
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
