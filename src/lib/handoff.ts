/**
 * Small sessionStorage bridge used to connect AURAwork flows:
 * meeting review -> task library -> day plan -> follow-up email.
 */

export type EmailPrefill = {
  audience: string;
  objective: string;
  context: string;
  keyPoints: string;
  tone?: string;
};

export type PlanPrefill = {
  taskIds: string[];
  label: string;
};

const EMAIL_KEY = "aura:email-prefill";
const PLAN_KEY = "aura:plan-prefill";

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(key, JSON.stringify(value));
}

function take<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(key);
  if (!raw) return null;
  window.sessionStorage.removeItem(key);
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const setEmailPrefill = (v: EmailPrefill) => write(EMAIL_KEY, v);
export const takeEmailPrefill = () => take<EmailPrefill>(EMAIL_KEY);
export const setPlanPrefill = (v: PlanPrefill) => write(PLAN_KEY, v);
export const takePlanPrefill = () => take<PlanPrefill>(PLAN_KEY);
