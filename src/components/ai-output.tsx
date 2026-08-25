import { Info, Pause, Play, RotateCcw, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      Review AI-generated content before use. You make the final decision.
    </p>
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
