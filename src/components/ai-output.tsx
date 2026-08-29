import {
  History,
  HelpCircle,
  Info,
  Lightbulb,
  Pause,
  Play,
  RotateCcw,
  ScrollText,
  Square,
  Undo2,
  Volume2,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AUDIT_LABELS, type AuditEvent } from "@/lib/audit";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSpeech } from "@/hooks/useSpeech";

export function AiNotice({ className = "" }: { className?: string }) {
  return (
    <p
      className={`flex items-start gap-2 text-xs text-muted-foreground ${className}`}
      role="note"
    >
      <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
      AI-generated content may be incomplete or inaccurate. Review and edit before use.
    </p>
  );
}

/** What the AI assumed, and what it is unsure about. Shown on every AI output card. */
export function AssumptionsCard({
  assumptions,
  uncertainties,
  className = "",
}: {
  assumptions?: string[];
  uncertainties?: string[];
  className?: string;
}) {
  const a = (assumptions ?? []).filter(Boolean);
  const u = (uncertainties ?? []).filter(Boolean);

  return (
    <section
      className={`rounded-lg border border-border bg-muted/40 p-4 ${className}`}
      aria-label="Assumptions and uncertainty"
    >
      <h4 className="text-sm font-semibold">Assumptions & uncertainty</h4>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Lightbulb className="h-3.5 w-3.5" aria-hidden /> AURA assumed
          </p>
          {a.length ? (
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {a.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">No assumptions were reported.</p>
          )}
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <HelpCircle className="h-3.5 w-3.5" aria-hidden /> Check before you rely on this
          </p>
          {u.length ? (
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {u.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">Nothing flagged — still read it end to end.</p>
          )}
        </div>
      </div>
    </section>
  );
}

/** Confirmation gate: saving, exporting or sending stays disabled until this is ticked. */
export function ReviewGate({
  id,
  checked,
  onChange,
  label = "I have reviewed and edited this AI content.",
  hint = "Required before you can save, export or send it.",
  className = "",
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-start gap-3 rounded-lg border border-border p-3 ${className}`}>
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        aria-describedby={`${id}-hint`}
      />
      <label htmlFor={id} className="cursor-pointer text-sm leading-snug">
        <span className="font-medium text-foreground">{label}</span>
        <span id={`${id}-hint`} className="mt-0.5 block text-xs text-muted-foreground">
          {hint}
        </span>
      </label>
    </div>
  );
}

/** Accessible read-aloud controls for a full AI output. */
export function ReadAloud({ text, label = "Read aloud" }: { text: string; label?: string }) {
  const s = useSpeech();
  const busy = s.status === "loading";

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Read aloud controls">
      {s.status === "playing" ? (
        <Button variant="outline" size="sm" onClick={s.pause} aria-label="Pause reading">
          <Pause className="h-4 w-4" /> Pause
        </Button>
      ) : s.status === "paused" ? (
        <Button variant="outline" size="sm" onClick={s.resume} aria-label="Resume reading">
          <Play className="h-4 w-4" /> Resume
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={busy || !text.trim()}
          onClick={() => void s.play(text)}
          aria-label={label}
        >
          <Volume2 className="h-4 w-4" /> {busy ? "Preparing…" : label}
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={s.stop}
        disabled={s.status === "idle"}
        aria-label="Stop reading"
      >
        <Square className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={s.replay} disabled={busy} aria-label="Replay reading">
        <RotateCcw className="h-4 w-4" />
      </Button>
      <Select value={String(s.speed)} onValueChange={(v) => s.setSpeed(Number(v))}>
        <SelectTrigger className="h-8 w-[86px]" aria-label="Playback speed">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[0.75, 0.9, 1, 1.1, 1.2].map((v) => (
            <SelectItem key={v} value={String(v)}>
              {v}×
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** One saved version of an AI output, kept locally while the user refines it. */
export type RegenVersion = {
  id: string;
  label: string;
  at: string;
  changes: string[];
  restore?: () => void;
};

/** Shows what changed across regenerations before the user finalises the output. */
export function RegenerationHistory({
  versions,
  className = "",
}: {
  versions: RegenVersion[];
  className?: string;
}) {
  if (!versions.length) return null;

  return (
    <section
      className={`rounded-lg border border-border p-4 ${className}`}
      aria-label="Regeneration history"
    >
      <h4 className="flex items-center gap-1.5 text-sm font-semibold">
        <History className="h-4 w-4" aria-hidden /> Regeneration history
      </h4>
      <ol className="mt-3 space-y-3">
        {versions.map((v) => (
          <li key={v.id} className="border-l-2 border-border pl-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-foreground">
                {v.label}
                <span className="ml-2 font-normal text-muted-foreground">
                  {format(new Date(v.at), "d MMM HH:mm")}
                </span>
              </p>
              {v.restore ? (
                <Button size="sm" variant="ghost" onClick={v.restore} aria-label={`Restore ${v.label}`}>
                  <Undo2 className="mr-1.5 h-3.5 w-3.5" /> Restore
                </Button>
              ) : null}
            </div>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
              {v.changes.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Audit trail: when AI content was reviewed, edited, saved, regenerated or exported. */
export function AuditTrail({
  events,
  isLoading = false,
  className = "",
  title = "Audit trail",
}: {
  events: AuditEvent[];
  isLoading?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <section className={`panel space-y-2 p-5 ${className}`} aria-label={title}>
      <h3 className="flex items-center gap-1.5 text-base font-semibold">
        <ScrollText className="h-4 w-4" aria-hidden /> {title}
      </h3>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading activity…</p>
      ) : !events.length ? (
        <p className="text-sm text-muted-foreground">
          Reviews, edits, saves, regenerations and exports will be recorded here.
        </p>
      ) : (
        <ul className="text-sm">
          {events.map((e) => (
            <li key={e.id} className="flex flex-wrap justify-between gap-2 border-b border-border py-2 last:border-0">
              <span className="text-foreground">
                {AUDIT_LABELS[e.action] ?? e.action}
                {e.item_label ? <span className="text-muted-foreground"> · {e.item_label}</span> : null}
                {e.detail ? <span className="block text-xs text-muted-foreground">{e.detail}</span> : null}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {format(new Date(e.created_at), "d MMM HH:mm")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
