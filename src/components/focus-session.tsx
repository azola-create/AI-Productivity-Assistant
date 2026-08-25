import { useEffect, useRef, useState } from "react";
import { Pause, Play, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import type { Task } from "@/lib/types";
import { formatDuration } from "@/lib/format";

export function FocusSession({
  task,
  onClose,
  onComplete,
}: {
  task: Task | null;
  onClose: () => void;
  onComplete: (task: Task) => void;
}) {
  const total = (task?.duration_minutes ?? 25) * 60;
  const [left, setLeft] = useState(total);
  const [running, setRunning] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setLeft((task?.duration_minutes ?? 25) * 60);
    setRunning(true);
  }, [task]);

  useEffect(() => {
    if (!task || !running) return;
    timer.current = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [task, running]);

  if (!task) return null;
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-primary" aria-hidden /> Focus session
        </DialogTitle>
        <DialogDescription className="sr-only">Timed focus session for a single task.</DialogDescription>

        <div className="rounded-xl border border-primary/25 bg-focus p-5 text-focus-foreground">
          <p className="text-sm font-semibold">{task.title}</p>
          {task.description && <p className="mt-1 text-xs opacity-80">{task.description}</p>}
          <p className="mt-3 text-xs opacity-80">
            Planned {formatDuration(task.duration_minutes)} · Priority {task.ai_priority}
          </p>
        </div>

        <div className="text-center">
          <p aria-live="polite" className="font-display text-5xl font-bold tabular-nums">
            {mm}:{ss}
          </p>
          <Progress value={((total - left) / total) * 100} className="mt-4" />
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" onClick={() => setRunning((r) => !r)}>
            {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {running ? "Pause" : "Resume"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            End session
          </Button>
          <Button onClick={() => onComplete(task)}>Mark complete</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
