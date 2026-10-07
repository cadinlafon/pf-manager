import { useCallback, useEffect, useState } from "react";

// Runs an async loader (a Firestore read) and exposes
// { data, loading, error, reload }. Pass `enabled: false` to skip loading.
export function useQuery(loader, { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, loading: enabled, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setState({ data: [], loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: null }));
    loader()
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((err) => !cancelled && setState({ data: null, loading: false, error: firestoreMessage(err) }));
    return () => {
      cancelled = true;
    };
  }, [loader, enabled, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { ...state, reload };
}

export function firestoreMessage(err) {
  if (err?.code === "permission-denied") {
    return "Firestore denied this request. The PF Management security rules probably haven't been added yet (see firestore.rules.leaders).";
  }
  if (err?.code === "unavailable") return "Can't reach the server. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}
