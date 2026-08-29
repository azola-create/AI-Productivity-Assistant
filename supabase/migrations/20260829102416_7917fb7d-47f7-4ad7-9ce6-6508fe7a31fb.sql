CREATE TABLE public.ai_audit_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  surface TEXT NOT NULL,
  item_label TEXT NOT NULL DEFAULT '',
  item_id TEXT,
  action TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_audit_events TO authenticated;
GRANT ALL ON public.ai_audit_events TO service_role;

ALTER TABLE public.ai_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own audit events"
ON public.ai_audit_events FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX ai_audit_events_user_created_idx ON public.ai_audit_events (user_id, created_at DESC);