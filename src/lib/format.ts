import { differenceInCalendarDays, format, isAfter, parseISO, startOfDay } from "date-fns";

export function hhmm(iso: string) {
  return format(parseISO(iso), "HH:mm");
}

export function dayKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function combine(dateKey: string, time: string) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(`${dateKey}T00:00:00`);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

export function minutesBetween(a: string, b: string) {
  return Math.max(0, Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 60000));
}

export type DeadlineState = { label: string; tone: "risk" | "focus" | "done" | "muted" };

export function deadlineState(deadline: string | null): DeadlineState | null {
  if (!deadline) return null;
  const d = parseISO(deadline);
  const diff = differenceInCalendarDays(startOfDay(d), startOfDay(new Date()));
  if (!isAfter(d, new Date()) && diff < 0) return { label: "Overdue", tone: "risk" };
  if (diff === 0) return { label: "Today", tone: "focus" };
  if (diff === 1) return { label: "Tomorrow", tone: "focus" };
  if (diff <= 7) return { label: format(d, "EEE d MMM"), tone: "muted" };
  return { label: format(d, "d MMM"), tone: "muted" };
}

export function greetingFor(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function priorityScore(t: { urgency: number; importance: number; deadline: string | null }) {
  let score = t.urgency * 1.2 + t.importance * 1.4;
  if (t.deadline) {
    const diff = differenceInCalendarDays(startOfDay(parseISO(t.deadline)), startOfDay(new Date()));
    if (diff <= 0) score += 5;
    else if (diff === 1) score += 3.5;
    else if (diff <= 3) score += 2;
    else if (diff <= 7) score += 1;
  }
  return score;
}

export function formatDuration(mins: number) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
