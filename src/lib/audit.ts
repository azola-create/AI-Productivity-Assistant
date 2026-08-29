import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AuditAction =
  | "generated"
  | "regenerated"
  | "edited"
  | "reviewed"
  | "saved"
  | "exported"
  | "sent"
  | "approved";

export type AuditEvent = {
  id: string;
  surface: string;
  item_label: string;
  item_id: string | null;
  action: AuditAction;
  detail: string;
  created_at: string;
};

export const AUDIT_LABELS: Record<AuditAction, string> = {
  generated: "Generated",
  regenerated: "Regenerated",
  edited: "Edited",
  reviewed: "Review confirmed",
  saved: "Saved",
  exported: "Exported",
  sent: "Sent / copied",
  approved: "Approved",
};

export function useAuditEvents(surface: string, limit = 8) {
  return useQuery({
    queryKey: ["audit", surface],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_audit_events")
        .select("id, surface, item_label, item_id, action, detail, created_at")
        .eq("surface", surface)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as AuditEvent[];
    },
  });
}

/** Records who did what to a piece of AI content. Failures never block the user's action. */
export function useAuditLog(surface: string) {
  const { user } = useAuth();
  const qc = useQueryClient();

  return async function log(
    action: AuditAction,
    opts: { item?: string; itemId?: string | null; detail?: string } = {},
  ) {
    if (!user) return;
    const { error } = await supabase.from("ai_audit_events").insert({
      user_id: user.id,
      surface,
      action,
      item_label: opts.item ?? "",
      item_id: opts.itemId ?? null,
      detail: opts.detail ?? "",
    });
    if (error) return;
    void qc.invalidateQueries({ queryKey: ["audit", surface] });
  };
}
