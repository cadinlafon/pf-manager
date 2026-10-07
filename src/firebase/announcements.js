import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./config";
import { COLLECTIONS, col, docRef } from "./collections";
import { PREVIEW } from "../lib/preview";

// Announcements from leaders to all other leaders.
//
//   leaderAnnouncements/{id}
//     title, body, createdBy, createdByName, createdAt, updatedAt, edited
//     attachment: null | { type: "link" | "form" | "volunteer", url, label }
//     commentCount, lastCommentAt, lastCommentBy, lastCommentByName
//
//   leaderAnnouncements/{id}/comments/{commentId}
//     body, createdBy, createdByName, createdAt
//
// Author names are stored on each post and comment so they can always be
// shown. The comment summary on the announcement (count + who commented last)
// is what lets the list and the notification bell know about new comments
// without loading every thread; it is written in the same batch as the comment.
//
// In dev preview mode there is no signed-in user, so everything is kept in this
// browser's localStorage instead and never touches Firestore.

const commentsCol = (id) => collection(db, COLLECTIONS.announcements, id, "comments");

// ── Preview store ────────────────────────────────────────────────────
const PREVIEW_KEY = "pf-leaders-preview-announcements";
const PREVIEW_COMMENTS_KEY = "pf-leaders-preview-announcement-comments";
const previewListeners = new Set();
function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}
const readPreview = () => read(PREVIEW_KEY, []);
const readPreviewComments = () => read(PREVIEW_COMMENTS_KEY, {});
function writePreview(items, comments) {
  localStorage.setItem(PREVIEW_KEY, JSON.stringify(items));
  if (comments) localStorage.setItem(PREVIEW_COMMENTS_KEY, JSON.stringify(comments));
  previewListeners.forEach((listener) => listener());
}
function previewSubscribe(emit) {
  previewListeners.add(emit);
  emit();
  return () => previewListeners.delete(emit);
}

// ── Announcements ────────────────────────────────────────────────────
// Live list, newest first. Returns an unsubscribe function.
export function subscribeAnnouncements(onData, onError) {
  if (PREVIEW) return previewSubscribe(() => onData([...readPreview()].sort((a, b) => b.createdAt - a.createdAt)));

  return onSnapshot(
    query(col("announcements"), orderBy("createdAt", "desc"), limit(50)),
    (snap) =>
      onData(
        snap.docs.map((d) => {
          // "estimate" gives a just-posted item a time before the server confirms it.
          const data = d.data({ serverTimestamps: "estimate" });
          return {
            id: d.id,
            ...data,
            createdAt: data.createdAt?.toMillis() ?? Date.now(),
            lastCommentAt: data.lastCommentAt?.toMillis() ?? null,
          };
        })
      ),
    onError
  );
}

export async function createAnnouncement({ title, body, attachment }, author) {
  const data = { title, body, attachment: attachment || null, createdBy: author.uid, createdByName: author.name, commentCount: 0 };
  if (PREVIEW) {
    writePreview([...readPreview(), { id: `a${Date.now()}`, ...data, createdAt: Date.now() }]);
    return;
  }
  await addDoc(col("announcements"), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function updateAnnouncement(id, { title, body, attachment }) {
  const changes = { title, body, attachment: attachment || null, edited: true };
  if (PREVIEW) {
    writePreview(readPreview().map((item) => (item.id === id ? { ...item, ...changes } : item)));
    return;
  }
  await updateDoc(docRef("announcements", id), { ...changes, updatedAt: serverTimestamp() });
}

// Deletes the announcement and its comments.
export async function deleteAnnouncement(id) {
  if (PREVIEW) {
    const comments = readPreviewComments();
    delete comments[id];
    writePreview(readPreview().filter((item) => item.id !== id), comments);
    return;
  }
  const snap = await getDocs(commentsCol(id));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(docRef("announcements", id));
}

// ── Comments ─────────────────────────────────────────────────────────
// Live thread, oldest first. Returns an unsubscribe function.
export function subscribeComments(id, onData, onError) {
  if (PREVIEW) return previewSubscribe(() => onData([...(readPreviewComments()[id] || [])].sort((a, b) => a.createdAt - b.createdAt)));

  return onSnapshot(
    query(commentsCol(id), orderBy("createdAt", "asc"), limit(200)),
    (snap) =>
      onData(
        snap.docs.map((d) => {
          const data = d.data({ serverTimestamps: "estimate" });
          return { id: d.id, ...data, createdAt: data.createdAt?.toMillis() ?? Date.now() };
        })
      ),
    onError
  );
}

export async function addComment(id, body, author) {
  const comment = { body, createdBy: author.uid, createdByName: author.name };
  if (PREVIEW) {
    const comments = readPreviewComments();
    comments[id] = [...(comments[id] || []), { id: `c${Date.now()}`, ...comment, createdAt: Date.now() }];
    writePreview(
      readPreview().map((item) =>
        item.id === id
          ? { ...item, commentCount: (item.commentCount || 0) + 1, lastCommentAt: Date.now(), lastCommentBy: author.uid, lastCommentByName: author.name }
          : item
      ),
      comments
    );
    return;
  }
  const batch = writeBatch(db);
  batch.set(doc(commentsCol(id)), { ...comment, createdAt: serverTimestamp() });
  batch.update(docRef("announcements", id), {
    commentCount: increment(1),
    lastCommentAt: serverTimestamp(),
    lastCommentBy: author.uid,
    lastCommentByName: author.name,
  });
  await batch.commit();
}

export async function deleteComment(id, commentId) {
  if (PREVIEW) {
    const comments = readPreviewComments();
    comments[id] = (comments[id] || []).filter((comment) => comment.id !== commentId);
    writePreview(
      readPreview().map((item) => (item.id === id ? { ...item, commentCount: Math.max(0, (item.commentCount || 0) - 1) } : item)),
      comments
    );
    return;
  }
  const batch = writeBatch(db);
  batch.delete(doc(commentsCol(id), commentId));
  batch.update(docRef("announcements", id), { commentCount: increment(-1) });
  await batch.commit();
}
