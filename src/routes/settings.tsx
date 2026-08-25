import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarDays, Loader2, Mail, Moon, Save, Sun } from "lucide-react";
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
                },
                {
                  name: "Microsoft Outlook",
                  blurb: "Send drafted follow-up emails straight from your work mailbox.",
                  Icon: Mail,
                },
              ].map(({ name, blurb, Icon }) => (
                <li
                  key={name}
                  className="flex flex-col gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
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
                  <Button variant="outline" size="sm" disabled className="shrink-0 sm:self-center">
                    Connect
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
