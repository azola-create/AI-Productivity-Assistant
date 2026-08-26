import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Copy, FileDown, Loader2, Mail, Maximize2, Minimize2, Sparkles, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app-shell";
import { AiNotice, ReadAloud } from "@/components/ai-output";
import { EmptyState, ErrorState, LoadingLines } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { draftEmail, type EmailDraft } from "@/lib/ai.functions";
import { exportDocx, exportPdf } from "@/lib/export";
import { takeEmailPrefill } from "@/lib/handoff";
import { useInvalidateWorkspace } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/email")({
  head: () => ({
    meta: [
      { title: "Draft an Email — AURAwork" },
      { name: "description", content: "Draft professional workplace email with tone, audience and length controls." },
      { property: "og:title", content: "Draft an Email — AURAwork" },
      {
        property: "og:description",
        content: "Draft professional workplace email with tone, audience and length controls.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EmailPage,
});

const TONES = ["Professional", "Friendly", "Direct", "Diplomatic", "Formal"];

const draftToText = (d: EmailDraft) =>
  [d.greeting, d.body, d.callToAction, d.signature].filter((p) => p && p.trim()).join("\n\n");

function EmailPage() {
  const { user, profile } = useAuth();
  const invalidate = useInvalidateWorkspace();
  const generate = useServerFn(draftEmail);

  const [form, setForm] = useState({
    audience: "",
    objective: "",
    context: "",
    keyPoints: "",
    tone: "Professional",
  });
  const [draft, setDraft] = useState<EmailDraft | null>(null);
  const previous = useRef<EmailDraft | null>(null);

  // Prefill from a reviewed meeting hand-off.
  useEffect(() => {
    const prefill = takeEmailPrefill();
    if (!prefill) return;
    setForm((f) => ({ ...f, ...prefill, tone: prefill.tone ?? f.tone }));
    toast("Meeting context loaded", { description: "Review the inputs, then draft the follow-up." });
  }, []);

  function restore(snapshot: EmailDraft | null) {
    setDraft(snapshot);
  }

  const run = useMutation({
    mutationFn: async (mode: "generate" | "shorten" | "expand") =>
      generate({
        data: {
          ...form,
          senderName: profile?.full_name ?? "",
          mode,
          existing: draft ? draftToText(draft) : "",
        },
      }),
    onMutate: () => {
      previous.current = draft;
    },
    onSuccess: async (result, mode) => {
      const snapshot = previous.current;
      setDraft(result);
      if (mode === "generate") {
        toast.success("Draft ready", { description: "Edit anything before you send." });
      } else {
        toast.success(mode === "shorten" ? "Draft shortened" : "Draft expanded", {
          description: "You can undo this change.",
          action: snapshot
            ? {
                label: "Undo",
                onClick: () => {
                  restore(snapshot);
                  toast("Previous draft restored");
                },
              }
            : undefined,
        });
      }
      if (user) {
        const { error } = await supabase.from("emails").insert({
          user_id: user.id,
          subject: result.subject,
          body: draftToText(result),
          inputs: form as unknown as never,
        });
        if (error) {
          toast.error("Draft not saved to your workspace", { description: error.message });
          return;
        }
        invalidate();
      }
    },
    onError: (e: Error) => toast.error("Could not draft the email", { description: e.message }),
  });

  const fullText = draft ? `Subject: ${draft.subject}\n\n${draftToText(draft)}` : "";
  const canGenerate = Boolean(form.audience.trim() && form.objective.trim());

  return (
    <AppLayout
      eyebrow="AI tool"
      title="Draft an Email"
      description="Give AURA the audience, the objective and the tone. Edit anything before you send."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="panel space-y-4 p-5">
          <div className="space-y-1.5">
            <Label htmlFor="e-audience">Audience</Label>
            <Input
              id="e-audience"
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value })}
              placeholder="Head of Finance"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-objective">Objective</Label>
            <Input
              id="e-objective"
              value={form.objective}
              onChange={(e) => setForm({ ...form, objective: e.target.value })}
              placeholder="Request approval for the revised Q3 budget"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-context">Context (optional)</Label>
            <Textarea
              id="e-context"
              rows={4}
              value={form.context}
              onChange={(e) => setForm({ ...form, context: e.target.value })}
              placeholder="Background the reader needs."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-points">Key points (optional)</Label>
            <Textarea
              id="e-points"
              rows={4}
              value={form.keyPoints}
              onChange={(e) => setForm({ ...form, keyPoints: e.target.value })}
              placeholder="One point per line."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-tone">Tone</Label>
            <Select value={form.tone} onValueChange={(v) => setForm({ ...form, tone: v })}>
              <SelectTrigger id="e-tone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button disabled={!canGenerate || run.isPending} onClick={() => run.mutate("generate")}>
            {run.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
            {run.isPending ? "Drafting…" : "Draft email"}
          </Button>
        </div>

        <div className="panel space-y-4 p-5">
          {run.isPending && !draft ? (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> AURA is drafting your email…
              </p>
              <LoadingLines rows={6} />
            </div>
          ) : run.isError && !draft ? (
            <ErrorState
              message={(run.error as Error).message || "The draft could not be generated."}
              onRetry={() => run.mutate("generate")}
            />
          ) : !draft ? (
            <EmptyState
              icon={Mail}
              title="No draft yet"
              description="Fill in the audience and objective, then let AURA write the first version."
              action={
                <Button disabled={!canGenerate} onClick={() => run.mutate("generate")}>
                  <Sparkles className="mr-2 size-4" /> Draft email
                </Button>
              }
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Draft</h2>
                <div className="flex flex-wrap gap-2">
                  <ReadAloud text={fullText} />
                  <Button size="sm" variant="outline" disabled={run.isPending} onClick={() => run.mutate("shorten")}>
                    <Minimize2 className="mr-2 size-4" /> Shorten
                  </Button>
                  <Button size="sm" variant="outline" disabled={run.isPending} onClick={() => run.mutate("expand")}>
                    <Maximize2 className="mr-2 size-4" /> Expand
                  </Button>
                  {previous.current ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        restore(previous.current);
                        toast("Previous draft restored");
                      }}
                    >
                      <Undo2 className="mr-2 size-4" /> Undo change
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void navigator.clipboard.writeText(fullText);
                      toast.success("Email copied");
                    }}
                  >
                    <Copy className="mr-2 size-4" /> Copy
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void exportPdf(draft.subject || "Email draft", [{ body: fullText }])}
                  >
                    <FileDown className="mr-2 size-4" /> PDF
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void exportDocx(draft.subject || "Email draft", [{ body: fullText }])}
                  >
                    <FileDown className="mr-2 size-4" /> Word
                  </Button>
                </div>
              </div>

              {run.isPending ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
                  <Loader2 className="size-4 animate-spin" /> Rewriting the draft…
                </p>
              ) : null}
              {run.isError ? (
                <ErrorState
                  message={(run.error as Error).message || "That rewrite failed."}
                  onRetry={() => run.mutate("generate")}
                />
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="e-subject">Subject</Label>
                <Input
                  id="e-subject"
                  value={draft.subject}
                  onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-body">Body</Label>
                <Textarea
                  id="e-body"
                  rows={16}
                  value={draftToText(draft)}
                  onChange={(e) =>
                    setDraft({ ...draft, greeting: "", body: e.target.value, callToAction: "", signature: "" })
                  }
                />
              </div>
              <AiNotice />
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
