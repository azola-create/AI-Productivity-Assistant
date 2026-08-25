import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarClock, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const { theme, setTheme } = useTheme();
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
          <div className="panel space-y-3 p-5">
            <h2 className="text-lg font-semibold">Appearance</h2>
            <p className="text-sm text-muted-foreground">Choose the theme that suits your workspace.</p>
            <div className="flex gap-2">
              <Button variant={theme === "light" ? "default" : "outline"} onClick={() => setTheme("light")}>
                Light
              </Button>
              <Button variant={theme === "dark" ? "default" : "outline"} onClick={() => setTheme("dark")}>
                Dark
              </Button>
            </div>
          </div>

          <div className="panel space-y-3 p-5">
            <h2 className="text-lg font-semibold">Integrations</h2>
            <p className="text-sm text-muted-foreground">
              Calendar sync will let AURA plan around meetings you already have.
            </p>
            <ul className="space-y-2">
              {["Google Calendar", "Microsoft Outlook"].map((name) => (
                <li key={name} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
                    {name}
                  </span>
                  <StatusBadge tone="muted">Coming soon</StatusBadge>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
