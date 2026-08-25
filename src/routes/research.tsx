import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { FileDown, Loader2, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app-shell";
import { AiNotice, ReadAloud } from "@/components/ai-output";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { analyseResearch, type ResearchOutput } from "@/lib/ai.functions";
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
    ],
  }),
  component: ResearchPage,
});

function ResearchPage() {
  const { user } = useAuth();
  const invalidate = useInvalidateWorkspace();
  const { data: history } = useResearch();
  const analyse = useServerFn(analyseResearch);

  const [text, setText] = useState("");
  const [output, setOutput] = useState<ResearchOutput | null>(null);

  const run = useMutation({
    mutationFn: async () => analyse({ data: { text } }),
    onSuccess: async (result) => {
      setOutput(result);
      if (user) {
        await supabase.from("research_items").insert({
          user_id: user.id,
          title: result.title,
          source_text: text.slice(0, 40000),
          output: result as unknown as Record<string, unknown>,
        });
        invalidate();
      }
    },
    onError: (e: Error) => toast.error("Could not analyse the text", { description: e.message }),
  });

  const sections = output
    ? [
        { heading: "Executive summary", body: output.executiveSummary },
        { heading: "Insights", bullets: output.insights },
        { heading: "Recommendations", bullets: output.recommendations },
      ]
    : [];

  const readable = output
    ? [output.executiveSummary, ...output.insights, ...output.recommendations].join(". ")
    : "";

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
          <Button disabled={!text.trim() || run.isPending} onClick={() => run.mutate()}>
            {run.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
            Analyse text
          </Button>
        </div>

        <div className="space-y-6">
          <div className="panel space-y-4 p-5">
            {!output ? (
              <EmptyState
                icon={Search}
                title="Nothing analysed yet"
                description="Paste an article and AURA will summarise it for a three-minute read."
              />
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">{output.title}</h2>
                  <div className="flex gap-2">
                    <ReadAloud text={readable} />
                    <Button size="sm" variant="outline" onClick={() => void exportPdf(output.title, sections)}>
                      <FileDown className="mr-2 size-4" /> PDF
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void exportDocx(output.title, sections)}>
                      <FileDown className="mr-2 size-4" /> Word
                    </Button>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{output.executiveSummary}</p>
                <List title="Insights" items={output.insights} />
                <List title="Recommendations" items={output.recommendations} />
                <AiNotice />
              </>
            )}
          </div>

          {history && history.length > 0 ? (
            <div className="panel space-y-2 p-5">
              <h3 className="text-base font-semibold">Recent analyses</h3>
              <ul className="text-sm text-muted-foreground">
                {history.slice(0, 5).map((r) => (
                  <li key={r.id} className="flex justify-between gap-3 border-b border-border py-2 last:border-0">
                    <span className="truncate text-foreground">{r.title}</span>
                    <span className="shrink-0">{format(new Date(r.created_at), "d MMM")}</span>
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

function List({ title, items }: { title: string; items: string[] }) {
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
