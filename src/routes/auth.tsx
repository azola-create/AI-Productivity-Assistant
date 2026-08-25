import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — AURAwork" },
      {
        name: "description",
        content:
          "Sign in or create your AURAwork account to plan your day, summarise meetings and protect focus time.",
      },
      { property: "og:title", content: "Sign in — AURAwork" },
      { property: "og:description", content: "Your personal executive productivity workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function passwordProblem(pw: string) {
  if (pw.length < 8) return "Use at least 8 characters.";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Include at least one letter and one number.";
  return null;
}

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) void navigate({ to: "/" });
  }, [user, loading, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "signup") {
      const problem = passwordProblem(password);
      if (problem) return setError(problem);
      if (!name.trim()) return setError("Please tell us your name.");
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name.trim() },
          },
        });
        if (err) throw err;
        toast.success("Welcome to AURAwork", { description: "Your workspace is ready." });
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
      void navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="aura-surface relative hidden flex-col justify-between p-12 lg:flex">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card font-display text-base font-bold text-primary"
          >
            A
          </span>
          <span className="font-display text-lg font-bold">AURAwork</span>
        </div>
        <div className="max-w-md">
          <p className="eyebrow mb-3">Less admin. More leadership.</p>
          <h2 className="font-display text-4xl font-bold leading-[1.12]">
            Clear priorities. Focused work. A productive week starts here.
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
            AURAwork plans your day, turns meeting notes into reviewed actions, drafts the email that
            follows, and protects the uninterrupted time your best work needs.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          AI suggests. You decide. Every output is editable before it is used.
        </p>
      </section>

      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold">
            {mode === "signin" ? "Sign in to AURAwork" : "Create your workspace"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Pick up where your week left off."
              : "A personal workspace for your tasks, plans and drafts."}
          </p>

          <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)} className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  placeholder="Thandi Mokoena"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                aria-describedby="password-hint"
              />
              {mode === "signup" && (
                <p id="password-hint" className="text-xs text-muted-foreground">
                  At least 8 characters, including a letter and a number.
                </p>
              )}
            </div>

            {error && (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
