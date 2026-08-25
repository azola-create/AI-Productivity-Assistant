import type { ReactNode } from "react";

const tones = {
  focus: "bg-focus text-focus-foreground border-primary/25",
  done: "bg-done text-done-foreground border-done-foreground/20",
  risk: "bg-risk text-risk-foreground border-risk-foreground/25",
  muted: "bg-muted text-muted-foreground border-border",
  primary: "bg-primary/10 text-primary border-primary/25",
} as const;

export type Tone = keyof typeof tones;

export function StatusBadge({
  tone = "muted",
  children,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
