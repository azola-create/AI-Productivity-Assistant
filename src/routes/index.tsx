import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  ArrowRight,
  CalendarCheck,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Shuffle,
  Sparkles,
  Timer,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app-shell";
import { AiNotice } from "@/components/ai-output";
import { FocusSession } from "@/components/focus-session";
import { EmptyState, ErrorState, LoadingLines } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { generateInsight, type AuraInsight } from "@/lib/ai.functions";
import { combine, dayKey, deadlineState, formatDuration, greetingFor, hhmm, priorityScore } from "@/lib/format";
import { usePlanBlocks, useTaskMutations, useTasks, useWeeklyCompleted } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import type { Task } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — AURAwork" },
      {
        name: "description",
        content:
          "Your day at a glance: upcoming deadlines, priority tasks, completed work and one AURA insight that protects your focus time.",
      },
      { property: "og:title", content: "Dashboard — AURAwork" },
      {
        property: "og:description",
        content: "Clear priorities. Focused work. A productive week starts here.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function CompletionRing({ value, total }: { value: number; total: number }) {
  const pct = total ? Math.min(100, (value / total) * 100) : 0;
  const r = 46;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 112 112" className="h-28 w-28" role="img" aria-label={`${value} tasks completed this week`}>
      <circle cx="56" cy="56" r={r} fill="none" stroke="var(--color-muted)" strokeWidth="10" />
      <circle
        cx="56"
        cy="56"
        r={r}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (c * pct) / 100}
        transform="rotate(-90 56 56)"
      />
      <text
        x="56"
        y="60"
        textAnchor="middle"
        className="fill-foreground font-display text-2xl font-bold"
        style={{ fontSize: 26 }}
      >
        {value}
      </text>
    </svg>
  );
}

function Dashboard() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const today = new Date();
  const tasksQ = useTasks();
  const blocksQ = usePlanBlocks(today);
  const statsQ = useWeeklyCompleted();
  const { update, invalidate } = useTaskMutations();
  const [focusTask, setFocusTask] = useState<Task | null>(null);
  const [insight, setInsight] = useState<AuraInsight | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const runInsight = useServerFn(generateInsight);
  const open = (tasksQ.data ?? []).filter((t) => t.status !== "completed" && t.status !== "archived");

  const insightM = useMutation({
    mutationFn: async (nudge: string) =>
      runInsight({
        data: {
          now: new Date().toISOString(),
          workStart: profile?.work_start ?? "08:30",
          workEnd: profile?.work_end ?? "17:00",
          nudge,
          avoid: (blocksQ.data ?? []).map((b) => ({
            title: b.title,
            start: hhmm(b.start_at),
            end: hhmm(b.end_at),
          })),
          tasks: open.slice(0, 8).map((t) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            deadline: t.deadline,
            duration_minutes: t.duration_minutes,
            urgency: t.urgency,
            importance: t.importance,
          })),
        },
      }),
    onSuccess: (res) => {
      setInsight(res);
      setDismissed(false);
    },
    onError: (e: Error) => toast.error("Insight unavailable", { description: e.message }),
  });

  const deadlines = useMemo(
    () =>
      open
        .filter((t) => t.deadline)
        .sort((a, b) => parseISO(a.deadline!).getTime() - parseISO(b.deadline!).getTime())
        .slice(0, 5),
    [open],
  );

  const priorities = useMemo(() => [...open].sort((a, b) => priorityScore(b) - priorityScore(a)).slice(0, 3), [open]);

  const stats = statsQ.data ?? { thisWeek: 0, lastWeek: 0 };
  const delta = stats.thisWeek - stats.lastWeek;

  async function completeTask(t: Task) {
    await update.mutateAsync({
      id: t.id,
      patch: { status: "completed", completed_at: new Date().toISOString() },
    });
    toast.success("Task completed", { description: t.title });
  }

  async function addFocusBlock() {
    if (!insight || !user) return;
    const key = dayKey(today);
    const { error } = await supabase.from("plan_blocks").insert({
      user_id: user.id,
      title: insight.taskTitle ? `Focus — ${insight.taskTitle}` : "Protected focus time",
      kind: "focus",
      start_at: combine(key, insight.start).toISOString(),
      end_at: combine(key, insight.end).toISOString(),
      rationale: insight.recommendation,
    });
    if (error) {
      toast.error("Could not add the focus block", { description: error.message });
      return;
    }
    invalidate();
    toast.success("Focus block added to today's plan", {
      action: { label: "Open plan", onClick: () => void navigate({ to: "/plan" }) },
    });
  }

  const name = (profile?.full_name || user?.email?.split("@")[0] || "there").split(" ")[0];

  return (
    <AppLayout
      title={`${greetingFor()}, ${name}.`}
      eyebrow={format(today, "EEEE d MMMM")}
      description="Clear priorities. Focused work. A productive week starts here."
      actions={
        <Button size="lg" asChild>
          <Link to="/plan">
            <CalendarCheck className="h-4 w-4" /> Plan My Day
          </Link>
        </Button>
      }
    >
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Today at a glance */}
        <section className="panel p-5 lg:col-span-2" aria-labelledby="glance">
          <h2 id="glance" className="font-display text-lg font-semibold">
            Today at a glance
          </h2>

          <div className="mt-5 grid gap-6 md:grid-cols-2">
            <div>
              <p className="eyebrow mb-3">Upcoming deadlines</p>
              {tasksQ.isLoading ? (
                <LoadingLines rows={3} />
              ) : tasksQ.isError ? (
                <ErrorState message="Could not load your deadlines." onRetry={() => void tasksQ.refetch()} />
              ) : deadlines.length === 0 ? (
                <p className="text-sm text-muted-foreground">No deadlines on the horizon.</p>
              ) : (
                <ul className="space-y-2.5">
                  {deadlines.map((t) => {
                    const state = deadlineState(t.deadline);
                    return (
                      <li
                        key={t.id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{t.title}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {format(parseISO(t.deadline!), "d MMM · HH:mm")}
                          </span>
                        </span>
                        {state && <StatusBadge tone={state.tone}>{state.label}</StatusBadge>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div>
              <p className="eyebrow mb-3">Priority tasks</p>
              {tasksQ.isLoading ? (
                <LoadingLines rows={3} />
              ) : priorities.length === 0 ? (
                <div className="rounded-lg bg-done px-4 py-5 text-sm text-done-foreground">
                  Today&rsquo;s priorities are complete. Clear priorities. Focused work. A productive week
                  starts here.
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {priorities.map((t) => (
                    <li key={t.id} className="rounded-lg border border-border px-3 py-2.5">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          className="mt-0.5"
                          aria-label={`Mark ${t.title} complete`}
                          onCheckedChange={(v) => v && void completeTask(t)}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{t.title}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" aria-hidden />
                            {formatDuration(t.duration_minutes)}
                            <StatusBadge tone={t.ai_priority === "high" ? "risk" : "muted"}>
                              {t.ai_priority} priority
                            </StatusBadge>
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-1.5 -ml-2 h-7 text-primary"
                            onClick={() => setFocusTask(t)}
                          >
                            <Timer className="h-3.5 w-3.5" /> Start focus session
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* Tasks completed */}
        <section className="panel flex flex-col p-5" aria-labelledby="completed">
          <h2 id="completed" className="font-display text-lg font-semibold">
            Tasks completed
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">Last 7 days</p>
          {statsQ.isLoading ? (
            <Skeleton className="mt-6 h-28 w-28 rounded-full" />
          ) : (
            <>
              <div className="mt-4 flex items-center gap-5">
                <CompletionRing value={stats.thisWeek} total={Math.max(stats.thisWeek, stats.lastWeek, 8)} />
                <div>
                  <p
                    className={`flex items-center gap-1.5 text-sm font-medium ${
                      delta >= 0 ? "text-done-foreground" : "text-risk-foreground"
                    }`}
                  >
                    {delta >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {delta >= 0 ? "+" : ""}
                    {delta} vs last week
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stats.lastWeek} completed the week before.
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-2">
                {[
                  { label: "This week", v: stats.thisWeek },
                  { label: "Last week", v: stats.lastWeek },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-xs text-muted-foreground">{row.label}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-primary/80"
                        style={{
                          width: `${(row.v / Math.max(1, stats.thisWeek, stats.lastWeek)) * 100}%`,
                        }}
                      />
                    </span>
                    <span className="w-5 text-right text-xs tabular-nums">{row.v}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      {/* AURA Insight */}
      {!dismissed && (
        <section
          className="aura-surface mt-5 rounded-xl border border-border p-5 shadow-soft"
          aria-labelledby="insight"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden />
              <h2 id="insight" className="font-display text-base font-semibold">
                AURA Insight
              </h2>
              <StatusBadge tone="primary">AI suggestion</StatusBadge>
            </div>
            <Button variant="ghost" size="icon" aria-label="Dismiss insight" onClick={() => setDismissed(true)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-3 max-w-2xl">
            {insightM.isPending ? (
              <LoadingLines rows={2} />
            ) : insight ? (
              <>
                <p className="text-[15px] font-medium leading-relaxed">{insight.recommendation}</p>
                {insight.headline && (
                  <p className="mt-1 text-xs text-muted-foreground">{insight.headline}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Ask AURA where your longest uninterrupted block is today and which task deserves it.
              </p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {insight && (
              <Button size="sm" onClick={() => void addFocusBlock()}>
                <CalendarPlus className="h-4 w-4" /> Add focus block
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={insightM.isPending || open.length === 0}
              onClick={() => insightM.mutate("Suggest a different time window than the previous suggestion.")}
            >
              <Shuffle className="h-4 w-4" /> Suggest another time
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={insightM.isPending || open.length === 0}
              onClick={() => insightM.mutate("")}
            >
              {insightM.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {insight ? "Refresh insight" : "Generate insight"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
              Dismiss
            </Button>
          </div>
          <AiNotice className="mt-3" />
        </section>
      )}

      {/* Today's schedule */}
      <section className="panel mt-5 p-5" aria-labelledby="schedule">
        <div className="flex items-center justify-between gap-3">
          <h2 id="schedule" className="font-display text-lg font-semibold">
            Today&rsquo;s schedule
          </h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/plan">
              Open plan <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="mt-4">
          {blocksQ.isLoading ? (
            <LoadingLines rows={3} />
          ) : (blocksQ.data ?? []).length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title="Nothing scheduled yet"
              description="Build a time-blocked plan from your priority tasks and available work hours."
              action={
                <Button asChild>
                  <Link to="/plan">Plan My Day</Link>
                </Button>
              }
            />
          ) : (
            <ul className="space-y-2">
              {(blocksQ.data ?? []).map((b) => (
                <li
                  key={b.id}
                  className={`flex items-center gap-4 rounded-lg border px-4 py-3 ${
                    b.kind === "focus" ? "border-primary/40 bg-focus" : "border-border bg-card"
                  }`}
                >
                  <span className="w-24 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                    {hhmm(b.start_at)}–{hhmm(b.end_at)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{b.title}</span>
                  {b.completed && (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-done-foreground" aria-label="Completed" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <FocusSession
        task={focusTask}
        onClose={() => setFocusTask(null)}
        onComplete={async (t) => {
          await completeTask(t);
          setFocusTask(null);
        }}
      />
    </AppLayout>
  );
}
