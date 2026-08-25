# AURAwork

Build a polished, responsive, fully functional AI workplace productivity web application called AURAwork.

PRODUCT PURPOSE

AURAwork is a one-stop productivity workspace for busy managers. It reduces repetitive administrative work—planning tasks, summarising meetings, drafting emails, researching pasted content, and answering routine workplace questions—so managers can focus on decisions, execution, and leadership.

Brand:

- Product name: AURAwork

- Sidebar tagline: “Less admin. More leadership.”

- Core promise: “Clear priorities. Focused work. A productive week starts here.”

- The experience must feel like a clean executive workspace: calm, premium, focused, and employer-showcase-ready.

- Do not copy the reference screenshot’s colours, layout, or visual identity. Use it only as general inspiration for a workplace assistant dashboard structure.

DESIGN SYSTEM

- Use a light executive theme by default with an optional dark mode toggle.

- Light palette: warm off-white/stone background #F7F7F4, white cards, deep ink navy text #172033, cobalt primary #2457D6, pale sky-blue focus blocks #DCEBFF, muted emerald completed state #DDF3E8, and soft amber deadline-risk state #FFF0CC.

- Use subtle aura gradients only in the welcome/greeting panel and AURA Insight card: refined blue-to-mint ambient gradients, never neon, gothic, purple-red, or overly glassy.

- Use generous whitespace, a precise grid, refined typography, thin cool-grey borders, soft shadows, accessible contrast, and subtle microinteractions.

- Use Lucide icons throughout. Use high-quality, original components inspired by 21st.dev/community/components.

- Avoid generic AI illustrations, visual clutter, excessive rounded cards, and horizontal shortcut tool rows.

APP SHELL AND NAVIGATION

- Create a fixed, collapsible left sidebar on desktop, with icon tooltips when collapsed.

- Sidebar navigation order:

  1. Dashboard — LayoutDashboard icon

  2. Plan My Day — CalendarCheck icon

  3. Meeting Summariser — FileText icon

  4. Draft an Email — Mail icon

  5. Research Assistant — Search icon

  6. AURA Chat — MessageCircle icon

  7. Task Library — FolderOpen icon

  8. Settings — Settings icon

- Include profile controls and a light/dark mode toggle in the sidebar footer.

- Ensure full mobile responsiveness with a compact accessible mobile navigation pattern.

AUTHENTICATION AND DATA

- Implement email and password sign-up, login, logout, password validation, protected routes, and user profiles.

- Give each user a personal saved workspace where their tasks, plans, meeting summaries, emails, research outputs, and chat history are stored.

- Use a secure backend/database approach appropriate to Lovable’s stack. Never expose API keys in browser code.

DASHBOARD

- Display a dynamic greeting:

  “Good morning, [Name]. Clear priorities. Focused work. A productive week starts here.”

- Place one prominent primary call-to-action: “Plan My Day.”

- Do not place horizontal tool shortcuts on the dashboard.

- Include a “Today at a glance” panel with:

  - Upcoming deadlines: nearest 3–5 deadlines with task title, due date/time, and status badges such as Today, Tomorrow, or Overdue.

  - Priority tasks: top three AI-suggested tasks with completion checkbox, estimated duration, priority, and a Start focus session control.

- Include “Tasks completed” as the headline productivity metric, showing weekly completed count, week-on-week comparison, and a restrained completion ring or bar chart.

- Include an AURA Insight card focused on protecting uninterrupted focus time. It must assess current priority tasks, deadlines, available time, task duration, and calendar blocks, then offer one short actionable recommendation.

- Example: “Protect 09:30–11:00 for the quarterly report. This is your longest uninterrupted block before tomorrow’s deadline.”

- AURA Insight must offer: Add focus block, Suggest another time, Refresh insight, and Dismiss.

- Label it as an AI suggestion and ensure the manager makes the final decision.

PLAN MY DAY

- Build a fully functional task-planning experience with an internal calendar.

- Let users create tasks with title, description, deadline, estimated duration, urgency, importance, and optional notes.

- Generate editable daily and weekly time-blocked plans using urgency, importance, deadlines, estimated duration, and available work hours.

- Clearly distinguish protected focus time using pale sky blue with a cobalt outline, not purple or red.

- Allow the manager to manually reorder, edit, reschedule, complete, or remove planned tasks.

- Include a focus session mode with timer, task details, and an end-session control.

- When all priority tasks are completed, show:

  “Today’s priorities are complete. Clear priorities. Focused work. A productive week starts here.”

- Offer “Prepare tomorrow.” It must open a review screen for unfinished tasks rather than moving them automatically.

- The manager must choose for each unfinished task: Carry to tomorrow, Reschedule, Delegate / mark no longer needed, or Keep in backlog.

- Only selected tasks are used to build tomorrow’s editable plan.

TASK LIBRARY

- Build a personal task backlog called “Task Library.”

- Include search, filters for priority/deadline/status, sorting by AI suggestion/due date/recently added, and task actions to edit, schedule, archive, or mark complete.

- Display AI priority suggestions, but always allow the manager to change priorities and schedules.

- Do not include team assignment; this app supports personal manager tasks only.

MEETING SUMMARISER

- Allow the manager to paste meeting notes and submit them to the AI.

- Generate an editable structured output with: concise summary, key points, decisions, proposed action items, suggested owners, and suggested deadlines.

- The main action after summarisation must be “Review action items.”

- Open an Action Review panel where each proposed action can be approved, edited, or discarded before being added to the Task Library or a selected day plan.

- Never add extracted action items automatically.

- After actions have been reviewed, provide a secondary action: “Draft follow-up email.”

DRAFT AN EMAIL

- Build a real AI-powered email generator.

- Inputs: audience (client, manager, team), objective, context, key points, and tone.

- Offer tone options: Professional and concise (default), formal, warm and collaborative, informal, persuasive, and directive.

- Generate editable email outputs with subject line, greeting, body, call to action, and signature area.

- Add controls for Copy, Edit, Regenerate, Shorten, Expand, Save, Export PDF, Export DOCX, and Read aloud.

- When launched from a reviewed meeting, prefill the email with approved decisions and actions.

RESEARCH ASSISTANT

- Accept pasted article text only.

- Generate a clear, editable output with: executive summary, key insights, and recommendations.

- Provide Copy, Save, Export PDF, Export DOCX, Regenerate, and Read aloud actions.

- Show a visible but concise note that AI summaries should be reviewed for accuracy before being used.

AURA CHAT

- Create a general workplace AI chat assistant, separate from task and meeting data context.

- Support multi-turn conversations, saved chat history, copy response, regenerate response, and read full response aloud.

- Keep the tone professional, concise, useful, and calm.

TEXT-TO-SPEECH

- Integrate text-to-speech for all full AI-generated outputs: email, meeting summary, research output, task plan explanation, and AURA Chat response.

- Use ElevenLabs Hermes voice through secure server-side API calls.

- Provide accessible controls: Play, Pause, Stop, Replay, and speed selection.

- Do not read only selected text; read full AI outputs only.

- Build a Python backend service or server-side Python API endpoints that securely handle ElevenLabs text-to-speech requests and AI orchestration.

- Keep all API secrets server-side in environment variables.

AI OUTPUT QUALITY

- Structure AI prompts so outputs are concise, practical, professional, and directly actionable.

- Ask the AI to state uncertainty or request clarification when the user has not provided enough context.

- Every AI output must be editable before it is saved, exported, acted on, or used in a follow-up email.

- Include an unobtrusive “Review AI-generated content before use” message in relevant output screens.

CALENDAR INTEGRATIONS

- Fully build an internal calendar.

- Add polished, non-functional “Connect Google Calendar” and “Connect Outlook” integration placeholders in Settings, clearly marked “Coming soon.”

EXPORTS AND STATES

- Support PDF and DOCX exports for emails, meeting summaries, research outputs, and plans.

- Add polished loading states, empty states, confirmation toasts, undo for deletion where appropriate, and clear error states with retry actions.

- Seed the initial demo experience with realistic fictional manager data so the app looks useful on first launch.

- Ensure keyboard accessibility, visible focus states, descriptive labels, and responsive behaviour.

DELIVERABLE

Create a working, cohesive employer-quality web application—not a static mockup. All core workflows must be connected: meeting notes can become reviewed tasks; approved tasks can enter the Task Library or day plan; and reviewed meeting actions can create a professional and concise follow-up email.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b1c4be92-f1f8-495f-8a94-a0d58ccf721c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
