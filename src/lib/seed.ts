import { addDays, addHours, setHours, setMinutes, startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

function at(day: Date, h: number, m = 0) {
  return setMinutes(setHours(startOfDay(day), h), m).toISOString();
}

/** Seeds a realistic fictional manager workspace on first sign-in. */
export async function seedWorkspace(userId: string) {
  const today = new Date();
  const tomorrow = addDays(today, 1);

  const tasks = [
    {
      title: "Finalise Q3 performance report",
      description: "Consolidate regional numbers, write the commentary and circulate for exec review.",
      deadline: at(tomorrow, 12),
      duration_minutes: 90,
      urgency: 5,
      importance: 5,
      ai_priority: "high",
      status: "backlog",
    },
    {
      title: "Review budget variance for operations",
      description: "Check the 4.2% overspend on contractor lines and prepare a short explanation.",
      deadline: at(today, 16),
      duration_minutes: 45,
      urgency: 4,
      importance: 4,
      ai_priority: "high",
      status: "backlog",
    },
    {
      title: "Prepare one-to-one notes for Naledi",
      description: "Career development conversation, plus feedback on the onboarding revamp.",
      deadline: at(addDays(today, 2), 9),
      duration_minutes: 30,
      urgency: 3,
      importance: 4,
      ai_priority: "medium",
      status: "backlog",
    },
    {
      title: "Approve vendor renewal for analytics platform",
      description: "Compare the two quotes and sign off before the contract lapses.",
      deadline: at(addDays(today, 5), 17),
      duration_minutes: 25,
      urgency: 3,
      importance: 3,
      ai_priority: "medium",
      status: "backlog",
    },
    {
      title: "Draft hiring brief for the second analyst role",
      description: "Scope responsibilities and required experience before the panel meets.",
      deadline: at(addDays(today, 9), 12),
      duration_minutes: 60,
      urgency: 2,
      importance: 4,
      ai_priority: "medium",
      status: "backlog",
    },
    {
      title: "Update the risk register",
      description: "Two items need re-rating after last week's incident review.",
      deadline: null,
      duration_minutes: 40,
      urgency: 2,
      importance: 2,
      ai_priority: "low",
      status: "backlog",
    },
  ];

  const completed = [
    "Sign off monthly team timesheets",
    "Respond to the procurement escalation",
    "Close out the customer churn analysis",
    "Run the weekly delivery stand-up",
    "Send the board pre-read",
  ].map((title, i) => ({
    title,
    description: "",
    deadline: null,
    duration_minutes: 30,
    urgency: 3,
    importance: 3,
    ai_priority: "medium",
    status: "completed",
    completed_at: addHours(addDays(today, -(i + 1)), 10).toISOString(),
  }));

  const { data: inserted } = await supabase
    .from("tasks")
    .insert([...tasks, ...completed].map((t) => ({ ...t, user_id: userId })))
    .select("id,title");

  const findId = (title: string) => inserted?.find((t) => t.title === title)?.id ?? null;

  await supabase.from("plan_blocks").insert([
    {
      user_id: userId,
      task_id: findId("Finalise Q3 performance report"),
      title: "Deep work — Q3 performance report",
      kind: "focus",
      start_at: at(today, 9, 30),
      end_at: at(today, 11, 0),
      rationale: "Longest uninterrupted block before tomorrow's deadline.",
    },
    {
      user_id: userId,
      task_id: null,
      title: "Leadership sync",
      kind: "meeting",
      start_at: at(today, 11, 30),
      end_at: at(today, 12, 15),
      rationale: "Recurring weekly.",
    },
    {
      user_id: userId,
      task_id: findId("Review budget variance for operations"),
      title: "Budget variance review",
      kind: "task",
      start_at: at(today, 14, 0),
      end_at: at(today, 14, 45),
      rationale: "Due end of day.",
    },
  ]);

  await supabase.from("profiles").update({ seeded: true }).eq("id", userId);
}
