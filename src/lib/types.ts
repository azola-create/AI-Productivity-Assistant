export type TaskStatus = "backlog" | "planned" | "completed" | "archived";
export type Priority = "high" | "medium" | "low";

export type Task = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  notes: string;
  deadline: string | null;
  duration_minutes: number;
  urgency: number;
  importance: number;
  status: TaskStatus;
  ai_priority: Priority;
  source: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PlanBlock = {
  id: string;
  user_id: string;
  task_id: string | null;
  title: string;
  kind: "focus" | "task" | "break" | "admin" | "meeting";
  start_at: string;
  end_at: string;
  completed: boolean;
  rationale: string;
  created_at: string;
};

export type Profile = {
  id: string;
  full_name: string;
  job_title: string;
  work_start: string;
  work_end: string;
  theme: string;
  seeded: boolean;
};

export type MeetingRecord = {
  id: string;
  title: string;
  raw_notes: string;
  summary: import("./ai.functions").MeetingSummary | null;
  reviewed: boolean;
  created_at: string;
};

export type EmailRecord = {
  id: string;
  subject: string;
  body: string;
  inputs: Record<string, unknown> | null;
  created_at: string;
};

export type ResearchRecord = {
  id: string;
  title: string;
  source_text: string;
  output: import("./ai.functions").ResearchOutput | null;
  created_at: string;
};

export type Chat = { id: string; title: string; created_at: string; updated_at: string };
export type ChatMessage = {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};
