import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { subscribeAnnouncements } from "../firebase/announcements";
import { firestoreMessage } from "../hooks/useQuery";

// One live subscription to announcements, shared by the Announcements page,
// the Dashboard card and the notification bell.
//
// "Unread" is tracked per leader per device: the time they last opened the
// bell or the Announcements page is kept in localStorage. Your own posts and
// comments never count as unread.

const AnnouncementsContext = createContext(null);
const seenKey = (uid) => `pf-leaders-announcements-seen-${uid}`;

function readSeen(uid) {
  try {
    return Number(localStorage.getItem(seenKey(uid))) || 0;
  } catch {
    return 0;
  }
}

export function AnnouncementsProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const [state, setState] = useState({ items: [], loading: true, error: null });
  const [seenAt, setSeenAt] = useState(() => readSeen(uid));

  useEffect(() => {
    if (!uid) return;
    setSeenAt(readSeen(uid));
    setState({ items: [], loading: true, error: null });
    return subscribeAnnouncements(
      (items) => setState({ items, loading: false, error: null }),
      (err) => setState({ items: [], loading: false, error: firestoreMessage(err) })
    );
  }, [uid]);

  const isUnread = useCallback((item) => item.createdBy !== uid && item.createdAt > seenAt, [uid, seenAt]);
  const hasNewComment = useCallback(
    (item) => Boolean(item.lastCommentAt) && item.lastCommentBy !== uid && item.lastCommentAt > seenAt,
    [uid, seenAt]
  );

  // What the bell lists, newest first: every announcement, plus the latest
  // comment on each one when somebody else wrote it.
  const notifications = useMemo(() => {
    const events = [];
    for (const item of state.items) {
      events.push({ key: `${item.id}-post`, type: "post", item, at: item.createdAt, byName: item.createdByName, unread: isUnread(item) });
      if (item.lastCommentAt && item.lastCommentBy !== uid) {
        events.push({ key: `${item.id}-comment`, type: "comment", item, at: item.lastCommentAt, byName: item.lastCommentByName, unread: hasNewComment(item) });
      }
    }
    return events.sort((a, b) => b.at - a.at);
  }, [state.items, uid, isUnread, hasNewComment]);

  const unreadCount = useMemo(() => notifications.filter((event) => event.unread).length, [notifications]);

  const markAllSeen = useCallback(() => {
    const now = Date.now();
    setSeenAt(now);
    try {
      localStorage.setItem(seenKey(uid), String(now));
    } catch {
      // Storage unavailable — they'll just show as unread again next visit.
    }
  }, [uid]);

  const value = { ...state, notifications, unreadCount, isUnread, hasNewComment, markAllSeen };
  return <AnnouncementsContext.Provider value={value}>{children}</AnnouncementsContext.Provider>;
}

export function useAnnouncements() {
  const ctx = useContext(AnnouncementsContext);
  if (!ctx) throw new Error("useAnnouncements must be used within an AnnouncementsProvider");
  return ctx;
}

// "Just now", "5 min ago", "3 hr ago", "Yesterday", then a date.
export function timeAgo(ms) {
  const minutes = Math.floor((Date.now() - ms) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  if (hours < 48) return "Yesterday";
  const date = new Date(ms);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}
