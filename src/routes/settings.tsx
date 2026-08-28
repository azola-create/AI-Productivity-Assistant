import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarDays, Check, KeyRound, Loader2, Mail, Moon, Save, Sun } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — AURAwork" },
      { name: "description", content: "Manage your AURAwork profile, working hours, appearance and integrations." },
      { property: "og:title", content: "Settings — AURAwork" },
      {
        property: "og:description",
        content: "Manage your AURAwork profile, working hours, appearance and integrations.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const { theme, toggle } = useTheme();
  const [form, setForm] = useState({ full_name: "", job_title: "", work_start: "08:30", work_end: "17:00" });
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ next: "", confirm: "" });
  const [updatingPw, setUpdatingPw] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  async function updatePassword() {
    if (pw.next.length < 8) {
      toast.error("Use at least 8 characters for your new password.");
      return;
    }
    if (pw.next !== pw.confirm) {
      toast.error("The two passwords do not match.");
      return;
    }
    setUpdatingPw(true);
    const { error } = await supabase.auth.updateUser({ password: pw.next });
    setUpdatingPw(false);
    if (error) {
      toast.error("Could not update your password", {
        description: error.message,
        action: { label: "Retry", onClick: () => void updatePassword() },
      });
      return;
    }
    setPw({ next: "", confirm: "" });
    toast.success("Password updated");
  }

  async function sendResetLink() {
    if (!user?.email) {
      toast.error("No email address on this account.");
      return;
    }
    setSendingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSendingReset(false);
    if (error) {
      toast.error("Could not send the recovery email", {
        description: error.message,
        action: { label: "Retry", onClick: () => void sendResetLink() },
      });
      return;
    }
    toast.success("Recovery email sent", { description: `Check ${user.email} for the reset link.` });
  }

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name,
        job_title: profile.job_title,
        work_start: profile.work_start,
        work_end: profile.work_end,
      });
    }
  }, [profile]);

  async function save() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update(form).eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Could not save your settings", { description: error.message });
      return;
    }
    await refreshProfile();
    toast.success("Settings saved");
  }

  return (
    <AppLayout
      eyebrow="Workspace"
      title="Settings"
      description="Your profile and working hours shape every plan AURA builds."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="panel space-y-4 p-5">
          <h2 className="text-lg font-semibold">Profile</h2>
          <div className="space-y-1.5">
            <Label htmlFor="s-name">Full name</Label>
            <Input id="s-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-role">Job title</Label>
            <Input id="s-role" value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-email">Email</Label>
            <Input id="s-email" value={user?.email ?? ""} readOnly disabled />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="s-start">Work day starts</Label>
              <Input
                id="s-start"
                type="time"
                value={form.work_start}
                onChange={(e) => setForm({ ...form, work_start: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-end">Work day ends</Label>
              <Input
                id="s-end"
                type="time"
                value={form.work_end}
                onChange={(e) => setForm({ ...form, work_end: e.target.value })}
              />
            </div>
          </div>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
            Save changes
          </Button>
        </div>

        <div className="space-y-6">
          <div className="panel space-y-4 p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <KeyRound className="size-4" aria-hidden />
              </span>
              <div>
                <h2 className="text-lg font-semibold">Password &amp; security</h2>
                <p className="text-sm text-muted-foreground">Change your password, or email yourself a reset link.</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="s-pw">New password</Label>
                <Input
                  id="s-pw"
                  type="password"
                  autoComplete="new-password"
                  value={pw.next}
                  onChange={(e) => setPw({ ...pw, next: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-pw2">Confirm password</Label>
                <Input
                  id="s-pw2"
                  type="password"
                  autoComplete="new-password"
                  value={pw.confirm}
                  onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void updatePassword()} disabled={updatingPw}>
                {updatingPw ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Update password
              </Button>
              <Button variant="outline" onClick={() => void sendResetLink()} disabled={sendingReset}>
                {sendingReset ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Email me a reset link
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Forgot your password? The reset link opens a secure page where you can choose a new one.
            </p>
          </div>

          <div className="panel space-y-4 p-5">
            <div>
              <h2 className="text-lg font-semibold">Appearance</h2>
              <p className="text-sm text-muted-foreground">Choose the theme that suits your workspace.</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  {theme === "dark" ? <Moon className="size-4" aria-hidden /> : <Sun className="size-4" aria-hidden />}
                </span>
                <span>
                  <span className="block text-sm font-medium">Dark mode</span>
                  <span className="block text-xs text-muted-foreground">
                    {theme === "dark" ? "Low-light interface enabled" : "Bright, daylight interface"}
                  </span>
                </span>
              </span>
              <Switch
                checked={theme === "dark"}
                onCheckedChange={() => toggle()}
                aria-label="Toggle dark mode"
              />
            </div>
          </div>

          <div className="panel space-y-4 p-5">
            <div>
              <h2 className="text-lg font-semibold">Integrations</h2>
              <p className="text-sm text-muted-foreground">
                Calendar and inbox sync will let AURA plan around the commitments you already have.
              </p>
            </div>
            <ul className="space-y-3">
              {[
                {
                  name: "Google Calendar",
                  blurb: "Pull events into Plan My Day so focus blocks never clash with meetings.",
                  Icon: CalendarDays,
                  points: [
                    "Read-only access to your events",
                    "Focus blocks scheduled around real meetings",
                    "Travel and buffer time respected",
                  ],
                },
                {
                  name: "Microsoft Outlook",
                  blurb: "Send drafted follow-up emails straight from your work mailbox.",
                  Icon: Mail,
                  points: [
                    "Send follow-ups from your own address",
                    "Outlook calendar merged into your day plan",
                    "Drafts saved to your mailbox before sending",
                  ],
                },
              ].map(({ name, blurb, Icon, points }) => (
                <li
                  key={name}
                  className="rounded-lg border border-dashed border-border bg-muted/30 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <span className="flex items-start gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{name}</span>
                          <StatusBadge tone="muted">Coming soon</StatusBadge>
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">{blurb}</span>
                      </span>
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 sm:self-center"
                      onClick={() =>
                        toast.success(`We'll let you know when ${name} sync is ready`, {
                          description: user?.email
                            ? `Notification will go to ${user.email}.`
                            : undefined,
                        })
                      }
                    >
                      Notify me
                    </Button>
                  </div>
                  <ul className="mt-3 space-y-1.5 pl-12">
                    {points.map((point) => (
                      <li key={point} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Check className="mt-0.5 size-3 shrink-0 text-primary" aria-hidden />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Sync will be read-only at launch — AURA reads your commitments and never changes them without asking.
            </p>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
