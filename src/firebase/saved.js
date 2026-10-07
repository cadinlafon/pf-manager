import {
  arrayRemove,
  arrayUnion,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { storage } from "./config";
import { col, docRef } from "./collections";
import { PREVIEW } from "../lib/preview";
import { isFileType, safeFileName } from "../lib/saved";

// Saved resources
//
//   leaderSaved/{id}                       (Firestore)
//     type: "link" | "document" | "image" | "note" | "file"
//     title, description, category, tags[], visibility, pinned
//     url                                  (links)
//     content                              (notes)
//     fileName, fileType, fileSize, storagePath   (uploads)
//     createdBy, createdByName, createdAt, updatedAt
//
//   leaderSaved/{id}/{fileName}            (Storage) — the uploaded file
//
//   leaderSavedUsers/{uid}                 (Firestore) — private to each leader
//     favorites: [resourceId], recent: { [resourceId]: millis }
//
// A resource is referenced everywhere by its id, so other features can attach
// one later by storing that id (or its /saved/{id} path).
//
// Download links are never stored. A Firebase download link works for anyone
// who has it, so one is only requested at the moment a leader who is allowed
// to see the file opens it (Storage rules check that).
//
// In dev preview mode there is no signed-in user: resources go in this
// browser's localStorage, and small files are kept inline.

const millis = (value) => (typeof value?.toMillis === "function" ? value.toMillis() : value ?? null);
const fromDoc = (d) => ({ id: d.id, ...d.data(), createdAt: millis(d.data().createdAt), updatedAt: millis(d.data().updatedAt) });

// ── Preview store ────────────────────────────────────────────────────
const PREVIEW_KEY = "pf-leaders-preview-saved";
const PREVIEW_USER_KEY = "pf-leaders-preview-saved-user";
const PREVIEW_MAX_FILE = 1.5 * 1024 * 1024;
function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}
const readPreview = () => read(PREVIEW_KEY, []);
const writePreview = (rows) => localStorage.setItem(PREVIEW_KEY, JSON.stringify(rows));
function fileToDataUrl(file) {
  if (file.size > PREVIEW_MAX_FILE) throw new Error("Preview mode can only hold files up to 1.5 MB.");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// ── Reading ──────────────────────────────────────────────────────────
// Everything this leader may see. The rules only allow a query that can't
// return a hidden resource, so it takes one query per case.
export async function listSaved(uid, role) {
  if (PREVIEW) return readPreview();
  const queries = [query(col("saved"), where("createdBy", "==", uid)), query(col("saved"), where("visibility", "==", "leaders"))];
  if (role === "main_admin") queries.push(query(col("saved"), where("visibility", "==", "admins")));
  const snaps = await Promise.all(queries.map((q) => getDocs(q)));
  const byId = new Map();
  snaps.forEach((snap) => snap.docs.forEach((d) => byId.set(d.id, fromDoc(d))));
  return [...byId.values()];
}

// Returns null when the resource doesn't exist or this leader may not see it.
export async function getSaved(id) {
  if (PREVIEW) return readPreview().find((row) => row.id === id) || null;
  try {
    const snap = await getDoc(docRef("saved", id));
    return snap.exists() ? fromDoc(snap) : null;
  } catch (err) {
    if (err.code === "permission-denied") return null;
    throw err;
  }
}

// A short-lived use of the file's address, for opening or previewing it now.
export async function getFileUrl(resource) {
  if (PREVIEW) return resource.dataUrl;
  return getDownloadURL(ref(storage, resource.storagePath));
}

// ── Writing ──────────────────────────────────────────────────────────
function upload(path, file, onProgress) {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, path), file, {
      contentType: file.type || "application/octet-stream",
      // "inline" lets PDFs and images open in the browser; the name is used when saved.
      contentDisposition: `inline; filename="${safeFileName(file.name).replace(/"/g, "")}"`,
    });
    task.on("state_changed", (snap) => onProgress?.(snap.totalBytes ? snap.bytesTransferred / snap.totalBytes : 0), reject, resolve);
  });
}

const fileFields = (id, file) => ({
  fileName: file.name,
  fileType: file.type || "",
  fileSize: file.size,
  storagePath: `leaderSaved/${id}/${Date.now().toString(36)}-${safeFileName(file.name)}`,
});

// `data`: { type, title, description, category, tags, visibility, pinned, url?, content? }
// Returns the new resource's id.
export async function createSaved(data, file, author, onProgress) {
  if (PREVIEW) {
    const id = `sv${Date.now().toString(36)}`;
    const extra = file ? { fileName: file.name, fileType: file.type, fileSize: file.size, dataUrl: await fileToDataUrl(file) } : {};
    writePreview([...readPreview(), { id, ...data, ...extra, createdBy: author.uid, createdByName: author.name, createdAt: Date.now(), updatedAt: Date.now() }]);
    return id;
  }

  const ref_ = doc(col("saved"));
  const record = {
    ...data,
    ...(file ? fileFields(ref_.id, file) : {}),
    createdBy: author.uid,
    createdByName: author.name,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  // The record goes first: Storage rules only accept an upload for a resource
  // that exists and belongs to the uploader.
  await setDoc(ref_, record);
  if (file) {
    try {
      await upload(record.storagePath, file, onProgress);
    } catch (err) {
      await deleteDoc(ref_).catch(() => {});
      throw err;
    }
  }
  return ref_.id;
}

// `newFile` replaces the uploaded file; the old one is removed afterwards so
// nothing is left behind in Storage.
export async function updateSaved(resource, data, newFile, onProgress) {
  if (PREVIEW) {
    const extra = newFile ? { fileName: newFile.name, fileType: newFile.type, fileSize: newFile.size, dataUrl: await fileToDataUrl(newFile) } : {};
    writePreview(readPreview().map((row) => (row.id === resource.id ? { ...row, ...data, ...extra, updatedAt: Date.now() } : row)));
    return;
  }

  const changes = { ...data, updatedAt: serverTimestamp() };
  if (newFile) {
    const fields = fileFields(resource.id, newFile);
    await upload(fields.storagePath, newFile, onProgress);
    Object.assign(changes, fields);
  }
  await updateDoc(docRef("saved", resource.id), changes);
  if (newFile && resource.storagePath) await deleteObject(ref(storage, resource.storagePath)).catch(() => {});
}

export async function setPinned(id, pinned) {
  if (PREVIEW) {
    writePreview(readPreview().map((row) => (row.id === id ? { ...row, pinned } : row)));
    return;
  }
  await updateDoc(docRef("saved", id), { pinned });
}

// Removes the file first (the rules need the record to check ownership), then the record.
export async function deleteSaved(resource) {
  if (PREVIEW) {
    writePreview(readPreview().filter((row) => row.id !== resource.id));
    return;
  }
  if (isFileType(resource.type) && resource.storagePath) {
    await deleteObject(ref(storage, resource.storagePath)).catch((err) => {
      if (err.code !== "storage/object-not-found") throw err;
    });
  }
  await deleteDoc(docRef("saved", resource.id));
}

// ── Per-leader favorites + recently opened ───────────────────────────
const RECENT_LIMIT = 12;

export async function getSavedUserState(uid) {
  if (PREVIEW) return { favorites: [], recent: {}, ...read(PREVIEW_USER_KEY, {}) };
  const snap = await getDoc(docRef("savedUsers", uid));
  return { favorites: [], recent: {}, ...(snap.exists() ? snap.data() : {}) };
}

export async function setFavorite(uid, id, favorite) {
  if (PREVIEW) {
    const state = { favorites: [], recent: {}, ...read(PREVIEW_USER_KEY, {}) };
    state.favorites = favorite ? [...new Set([...state.favorites, id])] : state.favorites.filter((f) => f !== id);
    localStorage.setItem(PREVIEW_USER_KEY, JSON.stringify(state));
    return;
  }
  await setDoc(docRef("savedUsers", uid), { favorites: favorite ? arrayUnion(id) : arrayRemove(id) }, { merge: true });
}

// `recent` is the leader's current map; the oldest entries are dropped so the
// record stays small.
export async function recordOpened(uid, id, recent) {
  const next = Object.fromEntries(
    Object.entries({ ...recent, [id]: Date.now() }).sort((a, b) => b[1] - a[1]).slice(0, RECENT_LIMIT)
  );
  if (PREVIEW) {
    const state = { favorites: [], ...read(PREVIEW_USER_KEY, {}), recent: next };
    localStorage.setItem(PREVIEW_USER_KEY, JSON.stringify(state));
    return next;
  }
  // mergeFields replaces the whole `recent` map (so dropped entries really go)
  // while leaving `favorites` alone.
  await setDoc(docRef("savedUsers", uid), { recent: next }, { mergeFields: ["recent"] });
  return next;
}
