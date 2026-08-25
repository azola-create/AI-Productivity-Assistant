import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app-shell";
import { AiNotice, ReadAloud } from "@/components/ai-output";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { auraChat } from "@/lib/ai.functions";
import { useChatMessages, useChats, useInvalidateWorkspace } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "AURA Chat — AURAwork" },
      { name: "description", content: "A calm, professional AI assistant for everyday workplace questions." },
      { property: "og:title", content: "AURA Chat — AURAwork" },
      { property: "og:description", content: "A calm, professional AI assistant for everyday workplace questions." },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { user } = useAuth();
  const invalidate = useInvalidateWorkspace();
  const { data: chats } = useChats();
  const [chatId, setChatId] = useState<string | null>(null);
  const { data: messages } = useChatMessages(chatId);
  const [input, setInput] = useState("");
  const send = useServerFn(auraChat);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const ask = useMutation({
    mutationFn: async (content: string) => {
      if (!user) throw new Error("You need to be signed in.");
      let id = chatId;
      if (!id) {
        const { data, error } = await supabase
          .from("chats")
          .insert({ user_id: user.id, title: content.slice(0, 60) })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        id = data.id;
        setChatId(id);
      }
      await supabase.from("chat_messages").insert({ user_id: user.id, chat_id: id, role: "user", content });
      invalidate();
      const history = [
        ...(messages ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user" as const, content },
      ];
      const reply = await send({ data: { messages: history } });
      await supabase.from("chat_messages").insert({ user_id: user.id, chat_id: id, role: "assistant", content: reply });
      await supabase.from("chats").update({ updated_at: new Date().toISOString() }).eq("id", id);
      invalidate();
    },
    onError: (e: Error) => toast.error("AURA could not reply", { description: e.message }),
  });

  function submit() {
    const content = input.trim();
    if (!content || ask.isPending) return;
    setInput("");
    ask.mutate(content);
  }

  return (
    <AppLayout
      eyebrow="AI tool"
      title="AURA Chat"
      description="Ask anything about your work day — drafting, planning, structuring or thinking things through."
      actions={
        <Button
          variant="outline"
          onClick={() => {
            setChatId(null);
            setInput("");
          }}
        >
          <Plus className="mr-2 size-4" /> New conversation
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <div className="panel hidden space-y-2 p-4 lg:block">
          <h2 className="text-sm font-semibold">Conversations</h2>
          {(chats ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No conversations yet.</p>
          ) : (
            <ul className="space-y-1">
              {(chats ?? []).map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setChatId(c.id)}
                    className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      chatId === c.id ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {c.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel flex min-h-[60vh] flex-col p-5">
          <div className="flex-1 space-y-4 overflow-y-auto">
            {(messages ?? []).length === 0 ? (
              <EmptyState
                icon={MessageCircle}
                title="Start a conversation"
                description="Ask AURA to structure an idea, prepare for a conversation or plan an approach."
              />
            ) : (
              (messages ?? []).map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "ml-auto bg-primary/10 text-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {m.role === "assistant" ? (
                    <div className="mt-2">
                      <ReadAloud text={m.content} />
                    </div>
                  ) : null}
                </div>
              ))
            )}
            {ask.isPending ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> AURA is thinking…
              </p>
            ) : null}
            <div ref={endRef} />
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                rows={2}
                placeholder="Ask AURA…"
                aria-label="Message AURA"
              />
              <Button onClick={submit} disabled={!input.trim() || ask.isPending} aria-label="Send message">
                <Send className="size-4" />
              </Button>
            </div>
            <AiNotice />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
