import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — AURAwork" },
      { name: "description", content: "Choose a new password for your AURAwork workspace account." },
      { property: "og:title", content: "Reset password — AURAwork" },
      { property: "og:description", content: "Choose a new password for your AURAwork workspace account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit() {
    if (password.length < 8) {
      toast.error("Use at least 8 characters for your new password.");
      return;
    }
    if (password !== confirm) {
      toast.error("The two passwords do not match.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      toast.error("Could not update your password", { description: error.message });
      return;
    }
    toast.success("Password updated. You are signed in.");
    void navigate({ to: "/", replace: true });
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="panel w-full max-w-md space-y-5 p-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <KeyRound className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-semibold">Set a new password</h1>
            <p className="text-sm text-muted-foreground">
              {ready
                ? "Choose a password you have not used before."
                : "Open this page from the recovery link in your email."}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rp-new">New password</Label>
          <Input
            id="rp-new"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rp-confirm">Confirm new password</Label>
          <Input
            id="rp-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        <Button className="w-full" onClick={() => void submit()} disabled={saving || !ready}>
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Update password
        </Button>
      </div>
    </main>
  );
}
