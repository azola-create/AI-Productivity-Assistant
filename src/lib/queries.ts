import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { endOfDay, startOfDay, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { Chat, ChatMessage, EmailRecord, MeetingRecord, PlanBlock, ResearchRecord, Task } from "./types";

export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Task[];
    },
  });
}

export function usePlanBlocks(day: Date) {
  const from = startOfDay(day).toISOString();
  const to = endOfDay(day).toISOString();
  return useQuery({
    queryKey: ["plan_blocks", from],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_blocks")
        .select("*")
        .gte("start_at", from)
        .lte("start_at", to)
        .order("start_at");
      if (error) throw new Error(error.message);
      return (data ?? []) as PlanBlock[];
    },
  });
}

export function useWeeklyCompleted() {
  return useQuery({
    queryKey: ["completed_stats"],
    queryFn: async () => {
      const since = subDays(new Date(), 14).toISOString();
      const { data, error } = await supabase
        .from("tasks")
        .select("completed_at")
        .eq("status", "completed")
        .gte("completed_at", since);
      if (error) throw new Error(error.message);
      const weekAgo = subDays(new Date(), 7).getTime();
      let thisWeek = 0;
      let lastWeek = 0;
      for (const row of data ?? []) {
        if (!row.completed_at) continue;
        const t = new Date(row.completed_at).getTime();
        if (t >= weekAgo) thisWeek += 1;
        else lastWeek += 1;
      }
      return { thisWeek, lastWeek };
    },
  });
}

export function useInvalidateWorkspace() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["tasks"] });
    void qc.invalidateQueries({ queryKey: ["plan_blocks"] });
    void qc.invalidateQueries({ queryKey: ["completed_stats"] });
  };
}

export function useTaskMutations() {
  const invalidate = useInvalidateWorkspace();

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Task> }) => {
      const { error } = await supabase.from("tasks").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  const create = useMutation({
    mutationFn: async (task: Partial<Task> & { title: string; user_id: string }) => {
      const { data, error } = await supabase.from("tasks").insert(task).select("*").single();
      if (error) throw new Error(error.message);
      return data as Task;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  return { update, create, remove, invalidate };
}

export function useMeetings() {
  return useQuery({
    queryKey: ["meetings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as MeetingRecord[];
    },
  });
}

export function useEmails() {
  return useQuery({
    queryKey: ["emails"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emails")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as EmailRecord[];
    },
  });
}

export function useResearch() {
  return useQuery({
    queryKey: ["research"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("research_items")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as ResearchRecord[];
    },
  });
}

export function useChats() {
  return useQuery({
    queryKey: ["chats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chats")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Chat[];
    },
  });
}

export function useChatMessages(chatId: string | null) {
  return useQuery({
    queryKey: ["chat_messages", chatId],
    enabled: !!chatId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("chat_id", chatId!)
        .order("created_at");
      if (error) throw new Error(error.message);
      return (data ?? []) as ChatMessage[];
    },
  });
}
