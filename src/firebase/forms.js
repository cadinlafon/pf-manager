import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./config";
import { COLLECTIONS, col, docRef } from "./collections";
import { PREVIEW } from "../lib/preview";

// Signup forms live at leaderForms/{slug}; the document ID is the public link
// ending (/form/{slug}), which is what keeps link endings unique. Responses go
// in leaderForms/{slug}/submissions.
//
// In dev preview mode there is no signed-in user, so forms and submissions are
// kept in this browser's localStorage instead and never touch Firestore.

const submissionsCol = (slug) => collection(db, COLLECTIONS.forms, slug, "submissions");
const millis = (value) => (typeof value?.toMillis === "function" ? value.toMillis() : value ?? null);

// ── Preview store ────────────────────────────────────────────────────
const PREVIEW_KEY = "pf-leaders-preview-forms";
function readPreview() {
  try {
    return JSON.parse(localStorage.getItem(PREVIEW_KEY)) || { forms: {}, submissions: {} };
  } catch {
    return { forms: {}, submissions: {} };
  }
}
function writePreview(store) {
  localStorage.setItem(PREVIEW_KEY, JSON.stringify(store));
}

// ── Forms ────────────────────────────────────────────────────────────
export async function listForms() {
  if (PREVIEW) {
    const store = readPreview();
    return Object.entries(store.forms)
      .map(([slug, form]) => ({ slug, ...form, submissionCount: (store.submissions[slug] || []).length }))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  const snap = await getDocs(col("forms"));
  const forms = snap.docs.map((d) => ({ slug: d.id, ...d.data(), createdAt: millis(d.data().createdAt) }));
  await Promise.all(
    forms.map(async (form) => {
      try {
        form.submissionCount = (await getCountFromServer(submissionsCol(form.slug))).data().count;
      } catch {
        form.submissionCount = null;
      }
    })
  );
  return forms.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function getForm(slug) {
  if (PREVIEW) {
    const form = readPreview().forms[slug];
    return form ? { slug, ...form } : null;
  }
  const snap = await getDoc(docRef("forms", slug));
  return snap.exists() ? { slug, ...snap.data(), createdAt: millis(snap.data().createdAt) } : null;
}

// Throws { code: "slug-taken" } if that link ending is already in use.
export async function createForm(slug, { title, description, fields }, createdBy) {
  if (await getForm(slug)) throw Object.assign(new Error("slug taken"), { code: "slug-taken" });

  const form = { title, description, fields, status: "open", createdBy: createdBy.uid, createdByName: createdBy.name };
  if (PREVIEW) {
    const store = readPreview();
    store.forms[slug] = { ...form, createdAt: Date.now() };
    writePreview(store);
    return;
  }
  await setDoc(docRef("forms", slug), { ...form, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function updateForm(slug, { title, description, fields, status }) {
  if (PREVIEW) {
    const store = readPreview();
    store.forms[slug] = { ...store.forms[slug], title, description, fields, status };
    writePreview(store);
    return;
  }
  await updateDoc(docRef("forms", slug), { title, description, fields, status, updatedAt: serverTimestamp() });
}

// Deletes the form and every response to it.
export async function deleteForm(slug) {
  if (PREVIEW) {
    const store = readPreview();
    delete store.forms[slug];
    delete store.submissions[slug];
    writePreview(store);
    return;
  }
  const snap = await getDocs(submissionsCol(slug));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(docRef("forms", slug));
}

// ── Submissions ──────────────────────────────────────────────────────
export async function submitForm(slug, answers) {
  if (PREVIEW) {
    const store = readPreview();
    store.submissions[slug] = [...(store.submissions[slug] || []), { id: `s${Date.now()}`, answers, submittedAt: Date.now() }];
    writePreview(store);
    return;
  }
  await addDoc(submissionsCol(slug), { answers, submittedAt: serverTimestamp() });
}

export async function listSubmissions(slug) {
  const rows = PREVIEW
    ? readPreview().submissions[slug] || []
    : (await getDocs(submissionsCol(slug))).docs.map((d) => ({ id: d.id, ...d.data(), submittedAt: millis(d.data().submittedAt) }));
  return [...rows].sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
}

export async function deleteSubmission(slug, id) {
  if (PREVIEW) {
    const store = readPreview();
    store.submissions[slug] = (store.submissions[slug] || []).filter((row) => row.id !== id);
    writePreview(store);
    return;
  }
  await deleteDoc(doc(db, COLLECTIONS.forms, slug, "submissions", id));
}
