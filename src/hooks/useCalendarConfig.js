import { useCallback, useEffect, useState } from "react";
import { getCalendarConfig } from "../firebase/calendarConfig";
import { firestoreMessage } from "./useQuery";
import { DEFAULT_DISPLAY } from "../lib/googleCalendar";

// The shared connected-calendar setting: { config, loading, error, reload }.
// `config` is null when no calendar is connected.
export function useCalendarConfig() {
  const [state, setState] = useState({ config: null, loading: true, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: null }));
    getCalendarConfig()
      .then((config) => !cancelled && setState({ config, loading: false, error: null }))
      .catch((err) => !cancelled && setState({ config: null, loading: false, error: firestoreMessage(err) }));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}

// How the calendar is displayed (view, size, week start) is a personal
// preference, remembered per device rather than shared with every leader.
const DISPLAY_KEY = "pf-leaders-calendar-display";

export function useCalendarDisplay() {
  const [display, setDisplay] = useState(() => {
    try {
      return { ...DEFAULT_DISPLAY, ...JSON.parse(localStorage.getItem(DISPLAY_KEY)) };
    } catch {
      return DEFAULT_DISPLAY;
    }
  });

  const update = useCallback((key, value) => {
    setDisplay((current) => {
      const next = { ...current, [key]: value };
      try {
        localStorage.setItem(DISPLAY_KEY, JSON.stringify(next));
      } catch {
        // Storage unavailable — the choice just won't persist.
      }
      return next;
    });
  }, []);

  return [display, update];
}
