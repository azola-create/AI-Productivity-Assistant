import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { addDays, addMinutes, format, parseISO } from "date-fns";
import {
  ArrowDown,
  ArrowUp,
  CalendarCheck,
  CheckCircle2,
  Loader2,
  Plus,
  Sparkles,
  Sunrise,
  Timer,
  Trash2,
  Volume2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app-shell";
import { AiNotice, ReadAloud } from "@/components/ai-output";
import { FocusSession } from "@/components/focus-session";
import { EmptyState, LoadingLines } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";
import { TaskDialog } from "@/components/task-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { generateDayPlan } from "@/lib/ai.functions";
import { combine, dayKey, formatDuration, hhmm, minutesBetween, priorityScore } from "@/lib/format";
import { exportDocx, exportPdf } from "@/lib/export";
import { usePlanBlocks, useTaskMutations, useTasks } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import type { PlanBlock, Task } from "@/lib/types";

export const Route = createFileRoute("/plan")({
  head: () => ({
    meta: [
      { title: "Plan My Day — AURAwork" },
      {
        name: "description",
        content:
          "Build an editable, time-blocked day or week from your tasks, deadlines and working hours, with protected focus time.",
      },
      { property: "og:title", content: "Plan My Day — AURAwork" },
      { property: "og:description", content: "Time-blocked plans that protect your focus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlanPage,
});

type Decision = "carry" | "reschedule" | "drop" | "backlog";

function PlanPage() {
  const { user, profile } = useAuth();
  const [dateKey, setDateKey] = useState(dayKey(new Date()));
  const day = parseISO(`${dateKey}T00:00:00`);
  const tasksQ = useTasks();
  const blocksQ = usePlanBlocks(day);
  const { update, invalidate } = useTaskMutations();
  const [focusTask, setFocusTask] = useState<Task | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [tomorrowOpen, setTomorrowOpen] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});

  const run = useServerFn(generateDayPlan);
  const tasks = tasksQ.data ?? [];
  const blocks = blocksQ.data ?? [];
  const open = tasks.filter((t) => t.status !== "completed" && t.status !== "archived");

  const planM = useMutation({
    mutationFn: async (subset?: Task[]) => {
      const pool = (subset ?? open).slice(0, 10);
      if (pool.length === 0) throw new Error("Add at least one task before generating a plan.");
      return run({
        data: {
          date: dateKey,
          workStart: profile?.work_start ?? "08:30",
          workEnd: profile?.work_end ?? "17:00",
          tasks: pool.map((t) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            deadline: t.deadline,
            duration_minutes: t.duration_minutes,
            urgency: t.urgency,
            importance: t.importance,
          })),
        },
      });
    },
    onSuccess: async (plan) => {
      if (!user) return;
      await supabase
        .from("plan_blocks")
        .delete()
        .eq("user_id", user.id)
        .gte("start_at", combine(dateKey, "00:00").toISOString())
        .lte("start_at", combine(dateKey, "23:59").toISOString());
      const rows = plan.blocks.map((b) => ({
        user_id: user.id,
        task_id: tasks.some((t) => t.id === b.taskId) ? b.taskId : null,
        title: b.title,
        kind: b.kind,
        start_at: combine(dateKey, b.start).toISOString(),
        end_at: combine(dateKey, b.end).toISOString(),
        rationale: b.rationale ?? "",
      }));
      if (rows.length) await supabase.from("plan_blocks").insert(rows);
      const ids = plan.blocks.map((b) => b.taskId).filter(Boolean) as string[];
      if (ids.length) await supabase.from("tasks").update({ status: "planned" }).in("id", ids);
      setExplanation(plan.explanation);
      invalidate();
      toast.success("Plan ready", { description: "Every block is editable." });
    },
    onError: (e: Error) => toast.error("Could not build the plan", { description: e.message }),
  });

  async function patchBlock(id: string, patch: Partial<PlanBlock>) {
    const { error } = await supabase.from("plan_blocks").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate();
  }

  async function removeBlock(b: PlanBlock) {
    const { error } = await supabase.from("plan_blocks").delete().eq("id", b.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate();
    toast("Block removed", {
      action: {
        label: "Undo",
        onClick: async () => {
          await supabase.from("plan_blocks").insert({
            user_id: b.user_id,
            task_id: b.task_id,
            title: b.title,
            kind: b.kind,
            start_at: b.start_at,
            end_at: b.end_at,
            rationale: b.rationale,
          });
          invalidate();
        },
      },
    });
  }

  async function swap(index: number, dir: -1 | 1) {
    const a = blocks[index];
    const b = blocks[index + dir];
    if (!a || !b) return;
    const aLen = minutesBetween(a.start_at, a.end_at);
    const bLen = minutesBetween(b.start_at, b.end_at);
    const first = dir === -1 ? b : a;
    const startIso = first.start_at;
    const moved = dir === -1 ? a : b;
    const second = dir === -1 ? b : a;
    const movedLen = dir === -1 ? aLen : bLen;
    const secondLen = dir === -1 ? bLen : aLen;
    const newMovedEnd = addMinutes(parseISO(startIso), movedLen);
    await patchBlock(moved.id, { start_at: startIso, end_at: newMovedEnd.toISOString() });
    await patchBlock(second.id, {
      start_at: newMovedEnd.toISOString(),
      end_at: addMinutes(newMovedEnd, secondLen).toISOString(),
    });
  }

  async function completeBlock(b: PlanBlock) {
    await patchBlock(b.id, { completed: !b.completed });
    if (!b.completed && b.task_id) {
      await update.mutateAsync({
        id: b.task_id,
        patch: { status: "completed", completed_at: new Date().toISOString() },
      });
    }
  }

  const unfinished = blocks.filter((b) => !b.completed && b.task_id);
  const allDone = blocks.length > 0 && blocks.every((b) => b.completed);

  async function buildTomorrow() {
    const carry = unfinished
      .filter((b) => decisions[b.id] === "carry" || decisions[b.id] === "reschedule")
      .map((b) => tasks.find((t) => t.id === b.task_id))
      .filter(Boolean) as Task[];

    for (const b of unfinished) {
      const d = decisions[b.id];
      if (!b.task_id) continue;
      if (d === "drop") await update.mutateAsync({ id: b.task_id, patch: { status: "archived" } });
      if (d === "backlog") await update.mutateAsync({ id: b.task_id, patch: { status: "backlog" } });
    }

    setTomorrowOpen(false);
    if (carry.length === 0) {
      toast("Nothing carried over", { description: "Tomorrow starts clear." });
      invalidate();
      return;
    }
    setDateKey(dayKey(addDays(day, 1)));
    setTimeout(() => planM.mutate(carry), 60);
  }

  const planText = `${explanation}\n\n${blocks
    .map((b) => `${hhmm(b.start_at)} to ${hhmm(b.end_at)}: ${b.title}`)
    .join(". ")}`;

  return (
    <AppLayout
      eyebrow="Plan My Day"
      title={format(day, "EEEE d MMMM")}
      description="A time-blocked plan built from urgency, importance, deadlines and your available work hours. Everything here is editable."
      actions={
        <>
          <Input
            type="date"
            value={dateKey}
            onChange={(e) => setDateKey(e.target.value)}
            aria-label="Plan date"
            className="w-[160px]"
          />
          <Button variant="outline" onClick={() => setTaskOpen(true)}>
            <Plus className="h-4 w-4" /> New task
          </Button>
          <Button onClick={() => planM.mutate(undefined)} disabled={planM.isPending}>
            {planM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {blocks.length ? "Regenerate plan" : "Generate plan"}
          </Button>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <section className="panel p-5" aria-labelledby="timeline">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="timeline" className="font-display text-lg font-semibold">
              Time blocks
            </h2>
            {blocks.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void exportPdf(`AURAwork plan — ${format(day, "d MMM yyyy")}`, [
                      { heading: "Why this order", body: explanation },
                      {
                        heading: "Schedule",
                        bullets: blocks.map((b) => `${hhmm(b.start_at)}–${hhmm(b.end_at)} · ${b.title}`),
                      },
                    ])
                  }
                >
                  Export PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void exportDocx(`AURAwork plan — ${format(day, "d MMM yyyy")}`, [
                      { heading: "Why this order", body: explanation },
                      {
                        heading: "Schedule",
                        bullets: blocks.map((b) => `${hhmm(b.start_at)}–${hhmm(b.end_at)} · ${b.title}`),
                      },
                    ])
                  }
                >
                  Export DOCX
                </Button>
              </div>
            )}
          </div>

          {allDone && (
            <div className="mt-4 rounded-lg bg-done px-4 py-4 text-sm font-medium text-done-foreground">
              Today&rsquo;s priorities are complete. Clear priorities. Focused work. A productive week starts
              here.
            </div>
          )}

          <div className="mt-4">
            {blocksQ.isLoading || planM.isPending ? (
              <LoadingLines rows={5} />
            ) : blocks.length === 0 ? (
              <EmptyState
                icon={CalendarCheck}
                title="No plan for this day yet"
                description="Generate a time-blocked plan from your open tasks, then edit anything you want to change."
                action={
                  <Button onClick={() => planM.mutate(undefined)}>
                    <Sparkles className="h-4 w-4" /> Generate plan
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-2.5">
                {blocks.map((b, i) => {
                  const task = tasks.find((t) => t.id === b.task_id) ?? null;
                  return (
                    <li
                      key={b.id}
                      className={`rounded-xl border p-3.5 transition-colors ${
                        b.kind === "focus"
                          ? "border-primary/45 bg-focus"
                          : b.completed
                            ? "border-done-foreground/20 bg-done"
                            : "border-border bg-card"
                      }`}
                    >
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="flex shrink-0 items-center gap-1">
                          <Input
                            type="time"
                            aria-label={`Start time for ${b.title}`}
                            value={hhmm(b.start_at)}
                            onChange={(e) =>
                              void patchBlock(b.id, {
                                start_at: combine(dateKey, e.target.value).toISOString(),
                              })
                            }
                            className="h-8 w-[92px] px-2 text-xs"
                          />
                          <Input
                            type="time"
                            aria-label={`End time for ${b.title}`}
                            value={hhmm(b.end_at)}
                            onChange={(e) =>
                              void patchBlock(b.id, {
                                end_at: combine(dateKey, e.target.value).toISOString(),
                              })
                            }
                            className="h-8 w-[92px] px-2 text-xs"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <Input
                            value={b.title}
                            aria-label="Block title"
                            onChange={(e) => void patchBlock(b.id, { title: e.target.value })}
                            className="h-8 border-transparent bg-transparent px-1 text-sm font-medium shadow-none focus-visible:border-input"
                          />
                          <div className="mt-1 flex flex-wrap items-center gap-2 px-1">
                            {b.kind === "focus" && <StatusBadge tone="primary">Protected focus</StatusBadge>}
                            {b.kind === "break" && <StatusBadge tone="muted">Break</StatusBadge>}
                            {b.completed && <StatusBadge tone="done">Completed</StatusBadge>}
                            {b.rationale && (
                              <span className="text-xs text-muted-foreground">{b.rationale}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Move earlier"
                            disabled={i === 0}
                            onClick={() => void swap(i, -1)}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Move later"
                            disabled={i === blocks.length - 1}
                            onClick={() => void swap(i, 1)}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          {task && (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Start focus session"
                              onClick={() => setFocusTask(task)}
                            >
                              <Timer className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={b.completed ? "Mark not done" : "Mark complete"}
                            onClick={() => void completeBlock(b)}
                          >
                            <CheckCircle2
                              className={`h-4 w-4 ${b.completed ? "text-done-foreground" : ""}`}
                            />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Remove block"
                            onClick={() => void removeBlock(b)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {explanation && (
            <div className="mt-5 rounded-lg border border-border bg-muted/40 p-4">
              <p className="eyebrow mb-2 flex items-center gap-1.5">
                <Volume2 className="h-3 w-3" aria-hidden /> Why this order
              </p>
              <p className="text-sm leading-relaxed">{explanation}</p>
              <div className="mt-3">
                <ReadAloud text={planText} label="Read plan aloud" />
              </div>
              <AiNotice className="mt-3" />
            </div>
          )}
        </section>

        <aside className="space-y-5">
          <section className="panel p-5">
            <h2 className="font-display text-lg font-semibold">Prepare tomorrow</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Review what is unfinished. Nothing moves until you decide.
            </p>
            <Button className="mt-4 w-full" variant="outline" onClick={() => setTomorrowOpen(true)}>
              <Sunrise className="h-4 w-4" /> Prepare tomorrow
            </Button>
          </section>

          <section className="panel p-5">
            <h2 className="font-display text-lg font-semibold">Unscheduled tasks</h2>
            <p className="mt-1 text-xs text-muted-foreground">Ranked by AURA&rsquo;s priority suggestion.</p>
            <ul className="mt-4 space-y-2">
              {[...open]
                .sort((a, b) => priorityScore(b) - priorityScore(a))
                .slice(0, 6)
                .map((t) => (
                  <li key={t.id} className="rounded-lg border border-border px-3 py-2.5">
                    <p className="text-sm font-medium">{t.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDuration(t.duration_minutes)}
                      {t.deadline ? ` · due ${format(parseISO(t.deadline), "d MMM")}` : ""}
                    </p>
                  </li>
                ))}
              {open.length === 0 && <p className="text-sm text-muted-foreground">Nothing waiting.</p>}
            </ul>
          </section>
        </aside>
      </div>

      <Dialog open={tomorrowOpen} onOpenChange={setTomorrowOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogTitle>Prepare tomorrow</DialogTitle>
          <DialogDescription>
            Choose what happens to each unfinished item. Only what you carry or reschedule is used to build
            tomorrow&rsquo;s editable plan.
          </DialogDescription>
          <div className="space-y-3">
            {unfinished.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing unfinished on this day.</p>
            )}
            {unfinished.map((b) => (
              <div key={b.id} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium">{b.title}</p>
                <Select
                  value={decisions[b.id] ?? ""}
                  onValueChange={(v) => setDecisions((d) => ({ ...d, [b.id]: v as Decision }))}
                >
                  <SelectTrigger className="mt-2" aria-label={`Decision for ${b.title}`}>
                    <SelectValue placeholder="Choose an action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="carry">Carry to tomorrow</SelectItem>
                    <SelectItem value="reschedule">Reschedule</SelectItem>
                    <SelectItem value="drop">Delegate / no longer needed</SelectItem>
                    <SelectItem value="backlog">Keep in backlog</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTomorrowOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void buildTomorrow()}>Build tomorrow&rsquo;s plan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TaskDialog open={taskOpen} onOpenChange={setTaskOpen} />

      <FocusSession
        task={focusTask}
        onClose={() => setFocusTask(null)}
        onComplete={async (t) => {
          await update.mutateAsync({
            id: t.id,
            patch: { status: "completed", completed_at: new Date().toISOString() },
          });
          setFocusTask(null);
          toast.success("Task completed", { description: t.title });
        }}
      />
    </AppLayout>
  );
}
