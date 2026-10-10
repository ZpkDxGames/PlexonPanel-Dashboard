"use client";
import { useCallback, useState } from "react";
import { appendSessionActivity, type SessionActivity, type SessionActivityInput } from "../lib/session-activity";

export function useSessionActivity() {
  const [activity, setActivity] = useState<SessionActivity[]>([]);
  const observeActivity = useCallback((input: SessionActivityInput) => setActivity(current => appendSessionActivity(current, input, Date.now())), []);
  const clearActivity = useCallback(() => setActivity([]), []);
  return { activity, observeActivity, clearActivity };
}
