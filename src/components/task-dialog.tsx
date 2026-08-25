import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
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
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useTaskMutations } from "@/lib/queries";
import type { Priority, Task } from "@/lib/types";

const emptyTask = {
  title: "",
  description: "",
  notes: "",
  deadline: "",
  duration_minutes: 60,
  urgency: 3,
  importance: 3,
};

export function TaskDialog({
  open,
  onOpenChange,
  task,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task?: Task | null;
}) {
  const { user } = useAuth();
  const { create, update } = useTaskMutations();
  const [form, setForm] = useState(emptyTask);

  useEffect(() => {
    if (!open) return;
    setForm(
      task
        ? {
            title: task.title,
            description: task.description,
            notes: task.notes,
            deadline: task.deadline ? format(parseISO(task.deadline), "yyyy-MM-dd'T'HH:mm") : "",
            duration_minutes: task.duration_minutes,
            urgency: task.urgency,
            importance: task.importance,
          }
        : emptyTask,
    );
  }, [open, task]);

  async function save() {
    if (!form.title.trim()) {
      toast.error("Give the task a title.");
      return;
    }
    if (!user) return;
    const priority: Priority =
      form.urgency + form.importance >= 8 ? "high" : form.urgency + form.importance <= 4 ? "low" : "medium";
    const payload = {
      title: form.title.trim(),
      description: form.description,
      notes: form.notes,
      deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      duration_minutes: form.duration_minutes,
      urgency: form.urgency,
      importance: form.importance,
      ai_priority: priority,
    };
    if (task) {
      await update.mutateAsync({ id: task.id, patch: payload });
      toast.success("Task updated");
    } else {
      await create.mutateAsync({ ...payload, user_id: user.id });
      toast.success("Task added to your library");
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
        <DialogDescription>
          Urgency, importance, the deadline and the estimated duration all feed AURA&rsquo;s planning.
        </DialogDescription>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="t-title">Title</Label>
            <Input
              id="t-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Finalise Q3 performance report"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-desc">Description</Label>
            <Textarea
              id="t-desc"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="t-deadline">Deadline</Label>
              <Input
                id="t-deadline"
                type="datetime-local"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-duration">Estimated duration (minutes)</Label>
              <Input
                id="t-duration"
                type="number"
                min={5}
                step={5}
                value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="t-urgency">Urgency — {form.urgency}/5</Label>
              <Slider
                id="t-urgency"
                min={1}
                max={5}
                step={1}
                value={[form.urgency]}
                onValueChange={([v]) => setForm({ ...form, urgency: v ?? form.urgency })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-importance">Importance — {form.importance}/5</Label>
              <Slider
                id="t-importance"
                min={1}
                max={5}
                step={1}
                value={[form.importance]}
                onValueChange={([v]) => setForm({ ...form, importance: v ?? form.importance })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-notes">Notes (optional)</Label>
            <Textarea
              id="t-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void save()}>{task ? "Save changes" : "Add task"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
