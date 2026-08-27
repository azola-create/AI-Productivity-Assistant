import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { CheckCircle2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app-shell";
import { EmptyState, ErrorState, LoadingLines } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";
import { TaskDialog } from "@/components/task-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTaskMutations, useTasks } from "@/lib/queries";
import type { Task } from "@/lib/types";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Task Library — AURAwork" },
      { name: "description", content: "Search, filter and manage every task in your AURAwork workspace." },
      { property: "og:title", content: "Task Library — AURAwork" },
      { property: "og:description", content: "Search, filter and manage every task in your AURAwork workspace." },
    ],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const { data: tasks, isLoading, error, refetch } = useTasks();
  const { update, remove, create } = useTaskMutations();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [editing, setEditing] = useState<Task | null>(null);
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (tasks ?? []).filter((t) => {
      if (status !== "all" && t.status !== status) return false;
      if (priority !== "all" && t.ai_priority !== priority) return false;
      if (!q) return true;
      return `${t.title} ${t.description} ${t.notes}`.toLowerCase().includes(q);
    });
  }, [tasks, query, status, priority]);

  async function completeTask(t: Task) {
    const previous = { status: t.status, completed_at: t.completed_at };
    try {
      await update.mutateAsync({
        id: t.id,
        patch: { status: "completed", completed_at: new Date().toISOString() },
      });
      toast.success("Task completed", {
        description: t.title,
        action: {
          label: "Undo",
          onClick: () => {
            void update.mutateAsync({ id: t.id, patch: previous }).catch((err: unknown) => {
              toast.error("Could not undo", { description: (err as Error).message });
            });
          },
        },
      });
    } catch (err) {
      toast.error("Could not complete this task", {
        description: (err as Error).message,
        action: { label: "Retry", onClick: () => void completeTask(t) },
      });
    }
  }

  async function deleteTask(t: Task) {
    try {
      await remove.mutateAsync(t.id);
      toast("Task deleted", {
        description: t.title,
        action: {
          label: "Undo",
          onClick: () => {
            const { created_at: _c, updated_at: _u, ...restore } = t;
            void create.mutateAsync(restore).catch((err: unknown) => {
              toast.error("Could not restore the task", { description: (err as Error).message });
            });
          },
        },
      });
    } catch (err) {
      toast.error("Could not delete this task", {
        description: (err as Error).message,
        action: { label: "Retry", onClick: () => void deleteTask(t) },
      });
    }
  }

  return (
    <AppLayout
      eyebrow="Workspace"
      title="Task Library"
      description="Every task you and AURA have captured, in one searchable place."
      actions={
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="mr-2 size-4" /> New task
        </Button>
      }
    >
      <div className="panel space-y-4 p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks"
              className="pl-9"
              aria-label="Search tasks"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="sm:w-40" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="backlog">Backlog</SelectItem>
              <SelectItem value="planned">Planned</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="sm:w-40" aria-label="Filter by priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <LoadingLines rows={5} />
        ) : error ? (
          <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No tasks match"
            description="Adjust the filters, or add a task to get started."
          />
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                <button
                  className="flex-1 text-left"
                  onClick={() => {
                    setEditing(t);
                    setOpen(true);
                  }}
                >
                  <span className="font-medium text-foreground">{t.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {t.deadline ? `Due ${format(parseISO(t.deadline), "d MMM yyyy")}` : "No deadline"} ·{" "}
                    {t.duration_minutes} min
                  </span>
                </button>
                <StatusBadge tone={t.ai_priority === "high" ? "risk" : t.ai_priority === "low" ? "muted" : "focus"}>
                  {t.ai_priority}
                </StatusBadge>
                <StatusBadge tone={t.status === "completed" ? "done" : "primary"}>{t.status}</StatusBadge>
                {t.status !== "completed" && (
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={update.isPending}
                    aria-label={`Mark ${t.title} complete`}
                    onClick={() => void completeTask(t)}
                  >
                    <CheckCircle2 className="size-4" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={remove.isPending}
                  aria-label={`Delete ${t.title}`}
                  onClick={() => void deleteTask(t)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <TaskDialog open={open} onOpenChange={setOpen} task={editing} />
    </AppLayout>
  );
}
