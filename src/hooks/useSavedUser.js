import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getSavedUserState, recordOpened, setFavorite } from "../firebase/saved";

// The signed-in leader's own favorites and recently-opened resources.
// Changes show immediately and are saved in the background.
export function useSavedUser() {
  const { user } = useAuth();
  const uid = user.uid;
  const [favorites, setFavorites] = useState(() => new Set());
  const [recent, setRecent] = useState({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSavedUserState(uid)
      .then((state) => {
        if (cancelled) return;
        setFavorites(new Set(state.favorites));
        setRecent(state.recent || {});
      })
      .catch(() => {})
      .finally(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const toggleFavorite = useCallback(
    (id) => {
      setFavorites((current) => {
        const next = new Set(current);
        const makeFavorite = !next.has(id);
        if (makeFavorite) next.add(id);
        else next.delete(id);
        setFavorite(uid, id, makeFavorite).catch(() => {});
        return next;
      });
    },
    [uid]
  );

  const markOpened = useCallback(
    (id) => {
      setRecent((current) => {
        const next = { ...current, [id]: Date.now() };
        recordOpened(uid, id, current).catch(() => {});
        return next;
      });
    },
    [uid]
  );

  return { favorites, recent, ready, toggleFavorite, markOpened };
}
